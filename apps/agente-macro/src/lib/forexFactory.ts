// forexFactory.ts — carga automática de la semana de noticias desde el
// calendario de Forex Factory (feed JSON público de faireconomy.media).
//
// Se usa cuando una semana NO tiene archivo en src/data/weeks/: así las
// semanas nuevas aparecen solas, sin tener que crear el week_<lunes>.json a
// mano. Si el archivo existe, manda el archivo (tus ediciones ganan).
//
// Solo impacto alto y medio (las de 3 y 2 estrellas de Investing): High →
// 'high', Medium → 'med'. Solo USD, como el resto de semanas de la app. Horas en ET.
//
// Limitaciones del feed: solo publica la semana actual y la siguiente, y no
// trae el dato real ("actual"); ese sigue entrando a mano desde /terminal.

export interface WeekEvent {
  date: string            // YYYY-MM-DD (hora de Nueva York)
  time?: string           // HH:mm (hora de Nueva York, ET)
  country?: string
  currency?: string
  name: string
  impact?: 'high' | 'med' | 'low'
  prev?: string | number | null
  forecast?: string | number | null
  actual?: string | number | null
  type?: 'macro' | 'earnings' | 'central-bank' | 'speech' | 'other'
  affects?: string[]
}

interface FFItem {
  title: string
  country: string   // en el feed es la divisa: USD, EUR…
  date: string      // ISO con zona, p. ej. 2026-10-06T08:30:00-04:00
  impact: string    // High | Medium | Low | Holiday
  forecast?: string
  previous?: string
}

const FEEDS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
]

// Hora de Nueva York (ET), la que ya muestra la app ("14:00 ET") y la de
// referencia para alumnos de Argentina y México.
const LOCAL_TZ = 'America/New_York'
const CURRENCIES = ['USD']
const IMPACT: Record<string, 'high' | 'med'> = { High: 'high', Medium: 'med' }

// Activos afectados por defecto, alineados con EVENT_CATALOG (mentorEngine.ts).
const AFFECTS_RULES: [RegExp, string[]][] = [
  [/\b(CPI|PCE|Non-Farm|Nonfarm|Federal Funds Rate|FOMC Statement|FOMC Press|Fed Chair|Warsh|Powell|GDP)\b/i, ['USD', 'NQ', 'GOLD', 'VIX']],
  [/\b(PPI|Unemployment Rate|Average Hourly Earnings|Bond Auction|Note Auction)\b/i, ['USD', 'NQ', 'GOLD']],
  [/\b(Speaks|Testifies)\b/i, ['USD', 'TLT']],
  [/\b(Crude Oil|Natural Gas)\b/i, ['USD', 'OIL']],
]

function affectsFor(name: string): string[] {
  for (const [re, affects] of AFFECTS_RULES) if (re.test(name)) return affects
  return ['USD', 'NQ']
}

/** Fecha ISO con zona → fecha y hora de Nueva York. */
export function toNewYork(iso: string): { date: string; time: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: LOCAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map(p => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Convierte el feed de Forex Factory en eventos de la semana del lunes dado (lunes a viernes). */
export function mapForexFactory(items: FFItem[], monday: string): WeekEvent[] {
  const friday = addDays(monday, 4)
  const events: WeekEvent[] = []
  for (const it of items) {
    const impact = IMPACT[it.impact]
    if (!impact || !CURRENCIES.includes(it.country)) continue
    const when = toNewYork(it.date)
    if (!when || when.date < monday || when.date > friday) continue
    const name = it.title.trim()
    events.push({
      date: when.date,
      time: when.time,
      country: it.country === 'USD' ? 'USA' : it.country,
      currency: it.country,
      name,
      impact,
      prev: it.previous || null,
      forecast: it.forecast || null,
      actual: null,
      type: 'macro',
      affects: affectsFor(name),
    })
  }
  return events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

async function fetchFeed(url: string): Promise<FFItem[]> {
  try {
    // El feed limita las peticiones: se cachea una hora.
    const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Eventos de 2 y 3 estrellas de la semana que empieza en `monday` (YYYY-MM-DD). */
export async function getForexFactoryWeek(monday: string): Promise<WeekEvent[]> {
  const feeds = await Promise.all(FEEDS.map(fetchFeed))
  const all = feeds.flat()
  // El mismo evento puede venir en los dos feeds cuando se solapan.
  const seen = new Set<string>()
  const unique = all.filter(it => {
    const k = `${it.date}|${it.title}|${it.country}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return mapForexFactory(unique, monday)
}
