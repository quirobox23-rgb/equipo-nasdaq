-- ═══════════════════════════════════════════════════════════════
--  NOVA METRICS (EdgeLog) — Esquema Supabase
--
--  Ejecutar completo en el SQL Editor de Supabase (proyecto nuevo o
--  existente). Es idempotente donde es razonable (CREATE TABLE IF
--  NOT EXISTS) pero pensado para correr una sola vez sobre un
--  proyecto limpio.
--
--  Reemplaza las siguientes piezas del código actual:
--   - useStore.js: licenseSlice.tier vivía en localStorage → ahora
--     vive en profiles.tier, columna que el cliente NO puede
--     escribir directamente (ver política de UPDATE más abajo).
--   - features.js: VALID_TESTER_CODES estaba hardcodeado en el
--     bundle JS (visible en el navegador) → ahora vive en la tabla
--     tester_codes, solo legible/usable a través de la función
--     activate_tester_code() (SECURITY DEFINER).
--   - TIER_LIMITS de features.js (maxAccounts / maxTotalTrades) →
--     replicado en get_tier_account_limit() / get_tier_trade_limit()
--     y aplicado con triggers BEFORE INSERT, para que el límite sea
--     real y no solo un candado de UI.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────
--  PROFILES
--  Una fila por usuario (id = auth.users.id). Se crea sola al
--  registrarse vía el trigger on_auth_user_created más abajo.
-- ───────────────────────────────────────────
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  tier                 text not null default 'free'
                         check (tier in ('free','intermedio','pro',
                                         'tester-free','tester-intermedio','tester-pro')),
  csv_imported_count   integer not null default 0,
  tester_code          text,
  tester_activated_at  timestamptz,
  created_at           timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- El usuario puede LEER su propio perfil...
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- ...pero NO puede escribir tier / csv_imported_count / tester_*
-- directamente. Esas columnas solo cambian vía las funciones
-- SECURITY DEFINER de abajo (activate_tester_code, increment_csv_import)
-- o, en el futuro, vía el webhook de Stripe con la service_role key.
-- No damos ninguna política de UPDATE/INSERT/DELETE a "authenticated"
-- a propósito: sin política, la operación queda bloqueada por RLS.

-- Crear el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ───────────────────────────────────────────
--  ACCOUNTS (cuentas de trading del usuario)
-- ───────────────────────────────────────────
create table if not exists public.accounts (
  id            text primary key default ('acc-' || extract(epoch from clock_timestamp())::text),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  broker        text,
  type          text,
  status        text,
  initial_capital numeric,
  currency      text default 'USD',
  drawdown_type text default 'trailing_eod',
  data          jsonb default '{}'::jsonb,  -- resto de campos flexibles del objeto Account
  created_at    timestamptz not null default now()
);

alter table public.accounts enable row level security;

create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);


-- ───────────────────────────────────────────
--  TRADES
-- ───────────────────────────────────────────
create table if not exists public.trades (
  id          text primary key default ('trade-' || gen_random_uuid()::text),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  text references public.accounts(id) on delete set null,
  date        date,
  time        time,
  pair        text,
  direction   text,
  result      text,
  r_pnl       numeric,
  dollar_pnl  numeric,
  setup       text,
  notes       text,
  data        jsonb default '{}'::jsonb,  -- resto de campos flexibles del objeto Trade (exits, etc.)
  created_at  timestamptz not null default now()
);

create index if not exists trades_user_id_idx on public.trades(user_id);
create index if not exists trades_account_id_idx on public.trades(account_id);

alter table public.trades enable row level security;

create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id);
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);


-- ───────────────────────────────────────────
--  LÍMITES POR TIER — server-side (espejo de TIER_LIMITS en features.js)
-- ───────────────────────────────────────────
create or replace function public.base_tier(t text)
returns text language sql immutable as $$
  select case t
    when 'tester-free'       then 'free'
    when 'tester-intermedio' then 'intermedio'
    when 'tester-pro'        then 'pro'
    else t
  end
$$;

create or replace function public.get_tier_account_limit(t text)
returns integer language sql immutable as $$
  select case public.base_tier(t)
    when 'free' then 5
    else 2147483647  -- "sin límite" para Intermedio y Pro (igual que TIER_LIMITS en features.js)
  end
$$;

create or replace function public.get_tier_trade_limit(t text)
returns integer language sql immutable as $$
  -- Sin límite de trades en ningún plan (igual que TIER_LIMITS en features.js)
  select 2147483647
$$;

create or replace function public.enforce_account_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_tier text;
  current_count integer;
begin
  select tier into user_tier from public.profiles where id = new.user_id;
  select count(*) into current_count from public.accounts where user_id = new.user_id;
  if current_count >= public.get_tier_account_limit(user_tier) then
    raise exception 'Límite de cuentas alcanzado para tu plan (%).', user_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_account_limit on public.accounts;
create trigger trg_enforce_account_limit
  before insert on public.accounts
  for each row execute procedure public.enforce_account_limit();

create or replace function public.enforce_trade_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  user_tier text;
  current_count integer;
begin
  select tier into user_tier from public.profiles where id = new.user_id;
  select count(*) into current_count from public.trades where user_id = new.user_id;
  if current_count >= public.get_tier_trade_limit(user_tier) then
    raise exception 'Límite de operaciones alcanzado para tu plan (%). Mejora de plan para seguir importando.', user_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_trade_limit on public.trades;
create trigger trg_enforce_trade_limit
  before insert on public.trades
  for each row execute procedure public.enforce_trade_limit();


-- ───────────────────────────────────────────
--  CÓDIGOS DE TESTER — ya no viven en el bundle JS
-- ───────────────────────────────────────────
create table if not exists public.tester_codes (
  code    text primary key,
  role    text not null check (role in ('tester-free','tester-intermedio','tester-pro')),
  active  boolean not null default true
);

-- Semilla con los mismos códigos que había en features.js. Cambialos
-- o desactivalos (active = false) directamente en la tabla, sin tocar
-- código ni redeploy.
insert into public.tester_codes (code, role) values
  ('NOVA-TESTER-2026',            'tester-pro'),
  ('NOVA-REVIEW-2026',            'tester-pro'),
  ('NOVA-TESTER-FREE-2026',       'tester-free'),
  ('NOVA-TESTER-INTERMEDIO-2026', 'tester-intermedio'),
  -- Alumnos VIP de Santos (bootcamp): mismo acceso que Intermedio.
  -- El código se compara tal cual, así que va en minúsculas y mayúsculas.
  ('stvip26',                     'tester-intermedio'),
  ('STVIP26',                     'tester-intermedio')
on conflict (code) do nothing;

alter table public.tester_codes enable row level security;
-- Sin políticas de select/insert/update para "authenticated": la tabla
-- solo es legible desde dentro de la función SECURITY DEFINER de abajo,
-- nunca directamente por el cliente.

create or replace function public.activate_tester_code(input_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_role text;
begin
  select role into matched_role
  from public.tester_codes
  where code = input_code and active = true;

  if matched_role is null then
    return null; -- código inválido o desactivado
  end if;

  update public.profiles
  set tier = matched_role,
      tester_code = input_code,
      tester_activated_at = now()
  where id = auth.uid();

  return matched_role;
end;
$$;


-- ───────────────────────────────────────────
--  CONTADOR DE IMPORTACIÓN CSV — incremento server-side
-- ───────────────────────────────────────────
create or replace function public.increment_csv_import(amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.profiles
  set csv_imported_count = csv_imported_count + amount
  where id = auth.uid()
  returning csv_imported_count into new_count;
  return new_count;
end;
$$;


-- ───────────────────────────────────────────
--  PANEL DE ADMINISTRACIÓN — lista de alumnos (/admin)
-- ───────────────────────────────────────────
-- Cada alumno solo puede leer su propio perfil (RLS). La lista
-- completa solo sale de esta función, y solo si quien la llama tiene
-- su email en admin_emails. Aunque alguien encuentre la ruta /admin,
-- la base de datos no le devuelve nada.
create table if not exists public.admin_emails (
  email text primary key
);

-- Pon aquí los emails del equipo (los mismos que VITE_ADMIN_EMAILS).
insert into public.admin_emails (email) values
  ('admin@ejemplo.com')
on conflict (email) do nothing;

alter table public.admin_emails enable row level security;
-- Sin políticas: solo legible desde las funciones SECURITY DEFINER.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

create or replace function public.admin_list_users()
returns table (
  id                  uuid,
  email               text,
  tier                text,
  tester_code         text,
  tester_activated_at timestamptz,
  created_at          timestamptz,
  last_sign_in_at     timestamptz,
  accounts_count      bigint,
  trades_count        bigint,
  last_trade_date     date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.email,
    p.tier,
    p.tester_code,
    p.tester_activated_at,
    p.created_at,
    u.last_sign_in_at,
    (select count(*) from public.accounts a where a.user_id = p.id),
    (select count(*) from public.trades t where t.user_id = p.id),
    (select max(t.date) from public.trades t where t.user_id = p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.admin_list_users() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list_users() to authenticated;

-- Cuentas de todos los alumnos con su PnL (panel /admin). Mismo
-- criterio que la app (src/lib/tradeDollar.js): el $ del trade y, si
-- no tiene, R × riesgo por trade de la cuenta (100 por defecto).
create or replace function public.admin_list_accounts()
returns table (
  id            text,
  user_id       uuid,
  firm          text,
  prop_firm     text,
  type          text,
  phase         text,
  status        text,
  size          numeric,
  trades_count  bigint,
  pnl           numeric,
  withdrawn     numeric,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.user_id,
    coalesce(nullif(a.data->>'firm', ''), a.name),
    nullif(a.data->>'propFirm', ''),
    a.type,
    a.data->>'phase',
    a.status,
    coalesce(case when (a.data->>'size') ~ '^[0-9.]+$' then (a.data->>'size')::numeric end, a.initial_capital),
    coalesce(t.n, 0),
    round(coalesce(t.pnl, 0), 2),
    coalesce((
      select sum((w->>'amount')::numeric)
      from jsonb_array_elements(case when jsonb_typeof(a.data->'withdrawals') = 'array' then a.data->'withdrawals' else '[]'::jsonb end) w
      where (w->>'amount') ~ '^-?[0-9.]+$'
    ), 0),
    a.created_at
  from public.accounts a
  left join lateral (
    select
      count(*) as n,
      sum(case
            when coalesce(tr.dollar_pnl, 0) <> 0 then tr.dollar_pnl
            else coalesce(tr.r_pnl, 0) * coalesce(case when (a.data->>'riskPerTrade') ~ '^[0-9.]+$' then nullif((a.data->>'riskPerTrade')::numeric, 0) end, 100)
          end) as pnl
    from public.trades tr
    where tr.account_id = a.id
  ) t on true
  order by a.created_at desc;
end;
$$;

revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;
