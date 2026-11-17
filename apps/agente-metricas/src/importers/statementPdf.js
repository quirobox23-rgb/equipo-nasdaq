// ─────────────────────────────────────────────
//  EDGELOG · Account statement en PDF (TradeLocker)
//
//  Algunas firmas (Alpha Capital…) solo dejan bajar el "Account
//  statement" en PDF. Aquí se saca el texto del PDF y la tabla
//  "Transactions" se convierte en un CSV con las mismas columnas que
//  el export de TradeLocker, así que lo importa parseTradeLocker con
//  todo lo de siempre (fechas DD/MM, duplicados, comisión…).
//
//  Cada fila del PDF es una ejecución (fill). Se juntan en operaciones
//  siguiendo la posición neta de cada símbolo: abre al salir de cero y
//  cierra al volver a cero; el resultado es la suma del "Settled PnL".
//
//  El texto llega troceado (celdas partidas en dos líneas, filas
//  cortadas entre páginas), así que cada fila se lee por patrones y no
//  por posición de columna.
// ─────────────────────────────────────────────

export function isPdfBuffer(buffer) {
  const b = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength))
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 // %PDF
}

/** Trozos de texto del PDF en orden de lectura. pdfjs: la librería pdfjs-dist. */
export async function extractPdfTokens(pdfjs, buffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const tokens = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const { items } = await page.getTextContent()
    for (const it of items) {
      const s = (it.str || '').trim()
      if (s) tokens.push(s)
    }
  }
  return tokens
}

const num = (s) => parseFloat(String(s).replace(/,/g, ''))

// Una fila (ejecución) a partir de sus trozos de texto
function parseFill(posId, text) {
  const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text)
  const t = /\b(\d{1,2}:\d{2})\b/.exec(text)
  const side = /\b(Buy|Sell)\b/.exec(text)
  // Precio · Order ID · Settled PnL (o —) · Commission (o —)
  const g = /(-?[\d,]+\.\d+)\s+(\d{5,})\s+(-?[\d,]+\.\d+|—)(?:\s+(-?[\d,]+\.\d+|—))?/.exec(text)
  if (!d || !t || !side || !g) return null
  const rest = text.replace(g[0], ' ').replace(d[0], ' ')
  const size = /\b(\d+\.\d+)\b/.exec(rest)
  const symbol = /\b([A-Z][A-Z0-9]{2,})\b/.exec(rest)
  if (!size || !symbol) return null
  return {
    posId,
    time: `${d[0]} ${t[1]}`,
    sortKey: `${d[3]}${d[2]}${d[1]}${t[1].padStart(5, '0')}`,
    side: side[1],
    size: num(size[1]),
    symbol: symbol[1],
    price: num(g[1]),
    pnl: g[3] === '—' ? null : num(g[3]),
    commission: g[4] && g[4] !== '—' ? num(g[4]) : 0,
  }
}

/** Tabla "Transactions" del statement → texto CSV formato TradeLocker. null si no es un statement. */
export function statementTokensToCsv(tokens) {
  const start = tokens.findIndex(s => s === 'Transactions')
  if (start < 0) return null
  const end = tokens.findIndex((s, i) => i > start && /^Totals\b/.test(s))
  const body = tokens.slice(start + 1, end < 0 ? undefined : end)

  // Trocear por "Transaction ID": cada fila empieza con "<posición>:"
  const rows = []
  let cur = null
  for (const s of body) {
    const m = /^(\d+):$/.exec(s) || /^(\d+):\s/.exec(s)
    if (m) { if (cur) rows.push(cur); cur = { posId: m[1], parts: [s.slice(m[0].length)] } }
    else if (cur) cur.parts.push(s)
  }
  if (cur) rows.push(cur)

  const fills = rows.map(r => parseFill(r.posId, r.parts.join(' '))).filter(Boolean)
  if (!fills.length) return null

  // Por símbolo y en orden de tiempo: una operación empieza con la
  // posición plana y termina cuando vuelve a cero (el prefijo del
  // Transaction ID lo comparten varias operaciones, no sirve para
  // agruparlas). Los cierres parciales suman a la misma operación.
  fills.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const wavg = (list) => {
    const q = list.reduce((s, f) => s + f.size, 0)
    return q ? list.reduce((s, f) => s + f.price * f.size, 0) / q : 0
  }
  const lines = ['ID,Symbol,Open Time,Volume,Side,Close Time,Open Price,Close Price,Swap,Commission,Profit']
  const open = new Map() // símbolo → { net, opens, closes }
  for (const f of fills) {
    const signed = f.side === 'Buy' ? f.size : -f.size
    let cur = open.get(f.symbol)
    if (!cur) { cur = { net: 0, opens: [], closes: [] }; open.set(f.symbol, cur) }
    const isOpen = cur.net === 0 || Math.sign(signed) === Math.sign(cur.net)
    ;(isOpen ? cur.opens : cur.closes).push(f)
    cur.net = Math.round((cur.net + signed) * 1e6) / 1e6
    if (cur.net !== 0) continue
    const first = cur.opens[0], last = cur.closes[cur.closes.length - 1]
    const all = [...cur.opens, ...cur.closes]
    lines.push([
      `${first.posId}-${first.sortKey}`, f.symbol, first.time,
      cur.opens.reduce((s, x) => s + x.size, 0).toFixed(2),
      first.side.toUpperCase(), last.time,
      wavg(cur.opens).toFixed(5), wavg(cur.closes).toFixed(5),
      '0.00', all.reduce((s, x) => s + x.commission, 0).toFixed(2),
      all.reduce((s, x) => s + (x.pnl || 0), 0).toFixed(2),
    ].join(','))
    open.delete(f.symbol)
  }
  return lines.length > 1 ? lines.join('\n') : null
}
