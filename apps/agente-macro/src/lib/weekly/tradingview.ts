// Links de TradingView → imagen.
//
// TradingView guarda cada captura como imagen pública y no la borra:
//   captura  https://www.tradingview.com/x/T9m9ZLHB/          → s3.tradingview.com/snapshots/t/T9m9ZLHB.png
//   idea     https://www.tradingview.com/chart/NQ1!/UETkJUeE-… → s3.tradingview.com/u/UETkJUeE.png
// (la carpeta es la primera letra del id, en minúscula). El link de un
// gráfico guardado (/chart/AbC123/) no tiene imagen: devuelve null.

export type TvLink =
  | { ok: true; image: string; url: string }
  | { ok: false; reason: 'vacio' | 'no-tradingview' | 'grafico' | 'desconocido' }

const ID = '([A-Za-z0-9]{8})'

export function parseTvLink(raw: string): TvLink {
  const text = raw.trim()
  if (!text) return { ok: false, reason: 'vacio' }
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { ok: false, reason: 'no-tradingview' }
  }
  const host = u.hostname.toLowerCase()
  if (host !== 'tradingview.com' && !host.endsWith('.tradingview.com')) return { ok: false, reason: 'no-tradingview' }
  const path = u.pathname

  // Ya es la imagen (s3.tradingview.com/snapshots/t/T9m9ZLHB.png).
  if (host === 's3.tradingview.com' && /\.png$/i.test(path)) return { ok: true, image: u.href, url: u.href }

  const snap = path.match(new RegExp(`^/x/${ID}/?$`))
  if (snap) {
    const id = snap[1]
    return { ok: true, image: `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`, url: `https://www.tradingview.com/x/${id}/` }
  }

  // Idea publicada: /chart/SIMBOLO/ID-titulo/
  const idea = path.match(new RegExp(`^/chart/[^/]+/${ID}-[^/]*/?$`))
  if (idea) {
    const id = idea[1]
    return { ok: true, image: `https://s3.tradingview.com/${id[0].toLowerCase()}/${id}.png`, url: u.href }
  }

  if (/^\/chart\//.test(path)) return { ok: false, reason: 'grafico' }
  return { ok: false, reason: 'desconocido' }
}

export const TV_LINK_HELP: Record<Exclude<TvLink, { ok: true }>['reason'], string> = {
  vacio: 'En TradingView tocá la cámara → "Copiar link" y pegalo acá.',
  'no-tradingview': 'Ese link no es de TradingView.',
  grafico: 'Ese es el link del gráfico, no de la captura. En TradingView tocá la cámara → "Copiar link".',
  desconocido: 'No reconozco ese link. Usá el de la captura: cámara → "Copiar link" (queda tradingview.com/x/…).',
}

// ── Título del gráfico ───────────────────────────────────────────────────
// Activo y temporalidad se eligen con botones para que el título quede
// siempre igual ("MNQ · 15 min — Zonas del miércoles").

export const ACTIVOS = ['MNQ', 'VIX', 'DXY', 'NAS100', 'US10Y']
export const ACTIVO_DEFAULT = 'MNQ'
export const TEMPORALIDADES = ['5 min', '15 min', '1 h', '4 h', 'Diario', 'Semanal']

/** "MNQ · 15 min — Zonas del miércoles" (los gráficos viejos solo tienen el título libre). */
export function chartTitle(c: { activo?: string; temporalidad?: string; titulo: string }): string {
  const head = [c.activo?.trim(), c.temporalidad?.trim()].filter(Boolean).join(' · ')
  const what = c.titulo.trim()
  return head && what ? `${head} — ${what}` : head || what
}

/** Qué le falta a un gráfico para poder guardarse (vacío si está completo o si todavía no tiene link). */
export function chartMissing(c: { activo?: string; temporalidad?: string; link: string }): string[] {
  if (!c.link.trim()) return []
  return [!c.activo?.trim() && 'el activo', !c.temporalidad?.trim() && 'la temporalidad'].filter(Boolean) as string[]
}
