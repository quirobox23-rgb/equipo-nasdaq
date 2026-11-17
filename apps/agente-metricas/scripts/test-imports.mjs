// Batería de pruebas de importación de CSV — ver tests/imports/README.md
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCSV } from '../src/data/csvParser.js'
import { impliedCommission } from '../src/lib/commissionCalc.js'
import { decodeFileBuffer } from '../src/lib/decodeText.js'
import { statementTokensToCsv } from '../src/importers/statementPdf.js'
import { groupIntoOperations } from '../src/lib/operations.js'

const dir   = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'imports')
const cases = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8'))
const near  = (a, b, tol = 0.01) => Math.abs(a - b) <= tol

// El parser loguea cada importación: aquí solo interesa el resultado
const log = console.log
console.log = () => {}

let failed = 0
for (const c of cases) {
  const errors = []
  // .pdf-tokens.json: texto ya extraído de un PDF con pdf.js (como hace el modal)
  const raw  = fs.readFileSync(path.join(dir, c.file))
  const text = c.file.endsWith('.pdf-tokens.json') ? statementTokensToCsv(JSON.parse(raw)) : decodeFileBuffer(raw)
  const base = { accountId: 'acc-test', riskConstant: 100 }
  const gross = parseCSV(text, base)
  const sum   = (r) => Math.round(r.trades.reduce((s, t) => s + t.dollarPnl, 0) * 100) / 100
  const qty   = gross.trades.reduce((s, t) => s + (Math.abs(t.qty) || 1), 0)

  if (c.format && gross.format !== c.format) errors.push(`formato ${gross.format}, esperado ${c.format}`)
  if (c.trades != null && gross.count !== c.trades) errors.push(`${gross.count} trades, esperado ${c.trades}`)
  if (c.grossPnl != null && !near(sum(gross), c.grossPnl)) errors.push(`PnL bruto ${sum(gross)}, esperado ${c.grossPnl}`)
  const dates = gross.trades.map(t => t.date).sort()
  if (c.firstDate && dates[0] !== c.firstDate) errors.push(`primera fecha ${dates[0]}, esperada ${c.firstDate}`)
  if (c.lastDate && dates.at(-1) !== c.lastDate) errors.push(`última fecha ${dates.at(-1)}, esperada ${c.lastDate}`)
  if (c.contracts != null && qty !== c.contracts) errors.push(`${qty} contratos, esperado ${c.contracts}`)
  // Operaciones completas (parciales agrupados) y fecha/hora completas
  if (c.operations != null) {
    const ops = groupIntoOperations(gross.trades)
    if (ops.length !== c.operations) errors.push(`${ops.length} operaciones, esperadas ${c.operations}`)
    if (!near(sum({ trades: ops }), sum(gross))) errors.push('el PnL de las operaciones no coincide con el de los trades')
  }
  const sinHora = gross.trades.filter(t => !t.entryAt || !t.exitAt).length
  if (sinHora) errors.push(`${sinHora} trades sin fecha y hora completas de entrada/salida`)
  // Reimportar sobre trades viejos (sin entryAt/exitAt): no duplica y los completa
  {
    const old = gross.trades.map(({ entryAt, exitAt, ...t }) => t)
    const again = parseCSV(text, { ...base, existingTrades: old })
    if (again.count !== 0) errors.push(`${again.count} trades duplicados al reimportar`)
    if (again.backfill.length !== old.length) errors.push(`${again.backfill.length} de ${old.length} trades completados al reimportar`)
  }
  if (c.withdrawals != null) {
    const ws = gross.withdrawals || []
    const total = Math.round(ws.reduce((s, w) => s + w.amount, 0) * 100) / 100
    if (ws.length !== c.withdrawals.count) errors.push(`${ws.length} retiros, esperados ${c.withdrawals.count}`)
    if (!near(total, c.withdrawals.total)) errors.push(`retiros por $${total}, esperado $${c.withdrawals.total}`)
    // Reimportar el mismo reporte no vuelve a traer los retiros
    const again = parseCSV(text, { ...base, existingWithdrawals: ws })
    if (again.withdrawals.length) errors.push(`${again.withdrawals.length} retiros duplicados al reimportar`)
  }

  if (c.commissionPerContract != null && c.netPnl != null) {
    const net = parseCSV(text, { ...base, commissionPerContract: c.commissionPerContract })
    if (!near(sum(net), c.netPnl, 0.05)) errors.push(`PnL neto ${sum(net)}, esperado ${c.netPnl}`)
  }
  if (c.platform) {
    const calc = impliedCommission(gross.trades, c.platform.balanceBefore, c.platform.balanceAfter)
    if (!calc) errors.push('no se pudo calcular la comisión con el balance de la plataforma')
    else if (c.commissionPerContract != null && !near(calc.perContract, c.commissionPerContract, 0.02))
      errors.push(`comisión calculada ${calc.perContract}, esperada ${c.commissionPerContract}`)
  }

  if (errors.length) { failed++; log(`✗ ${c.file}\n    ${errors.join('\n    ')}`) }
  else log(`✓ ${c.file} (${c.firm || ''})`)
}

log(`\n${cases.length - failed}/${cases.length} casos OK`)
process.exit(failed ? 1 : 0)
