// Smoke test manual — NO forma parte del build ni de la app.
// Ejecutar con: node scripts/smoke-test-import.mjs
import { parseCSV, parseCSVWithMapping, analyzeCSV } from '../src/data/csvParser.js'
import { headerSignatureHash } from '../src/importers/mappingEngine.js'

let failures = 0
function check(label, cond) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} · ${label}`)
  if (!cond) failures++
}

// ── 1. Regresión: formatos legacy siguen detectándose igual ──
const tradovateCSV = [
  'symbol,buyPrice,sellPrice,pnl,qty,boughtTimestamp,soldTimestamp,buyFillId',
  'MNQ,19500,19530,60,2,2025-04-18 09:15:00,2025-04-18 09:20:00,f1',
].join('\n')
{
  const a = analyzeCSV(tradovateCSV)
  check('Tradovate: analyzeCSV confident=true, format=tradovate', a.confident && a.format === 'tradovate')
  const r = parseCSV(tradovateCSV, { accountId: 'acc-1' })
  check('Tradovate: 1 trade parseado', r.count === 1)
  check('Tradovate: format label correcto', r.label === 'Tradovate / Apex')
}

// ── 2. TradeLocker (formato nuevo) ──
const tradeLockerCSV = [
  'Id,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Profit,Swap,Commission',
  '1,2025-05-01 10:00:00,2025-05-01 10:30:00,EURUSD,buy,1,1.0800,1.0850,50,0,-2',
  '2,2025-05-02 11:00:00,,GBPUSD,sell,1,1.2500,,0,0,0', // sin cierre → abierta
].join('\n')
{
  const a = analyzeCSV(tradeLockerCSV)
  check('TradeLocker: analyzeCSV confident=true, format=tradelocker', a.confident && a.format === 'tradelocker')
  const r = parseCSV(tradeLockerCSV, { accountId: 'acc-1' })
  check('TradeLocker: 1 trade cerrado importado (2ª fila abierta ignorada)', r.count === 1)
  check('TradeLocker: 1 operación abierta detectada', r.openIgnored === 1)
}

// ── 3. NinjaTrader (formato nuevo) ──
const ninjaTraderCSV = [
  'Instrument,Account,Strategy,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
  'ES 06-25,Sim101,MyStrat,Long,1,5000,5010,05/01/2025 09:30:00,05/01/2025 09:45:00,500,2.5',
].join('\n')
{
  const a = analyzeCSV(ninjaTraderCSV)
  check('NinjaTrader: analyzeCSV confident=true, format=ninjatrader', a.confident && a.format === 'ninjatrader')
  const r = parseCSV(ninjaTraderCSV, { accountId: 'acc-1' })
  check('NinjaTrader: 1 trade parseado', r.count === 1)
}

// ── 4. MT5 (formato nuevo, cabeceras Time/Price duplicadas) ──
const mt5CSV = [
  'Time,Position,Symbol,Type,Volume,Price,S/L,T/P,Time,Price,Commission,Swap,Profit',
  '2025-05-01 08:00:00,1001,EURUSD,buy,0.1,1.0800,0,0,2025-05-01 09:00:00,1.0850,-1,0,50',
].join('\n')
{
  const a = analyzeCSV(mt5CSV)
  check('MT5: analyzeCSV confident=true, format=mt5', a.confident && a.format === 'mt5')
  const r = parseCSV(mt5CSV, { accountId: 'acc-1' })
  check('MT5: 1 trade parseado', r.count === 1)
}

// ── 5. Formato totalmente desconocido → asistente de mapeo manual ──
const unknownCSV = [
  'MiColumnaRara,Otra,Fecha Entrada,Fecha Salida,Instrumento,Resultado Neto',
  'x,y,2025-06-01 10:00,2025-06-01 10:20,XAUUSD,120',
].join('\n')
{
  const a = analyzeCSV(unknownCSV)
  check('Desconocido: analyzeCSV confident=false', a.confident === false)
  const mapping = { openTime: 2, closeTime: 3, symbol: 4, pnl: 5 }
  const r = parseCSVWithMapping(unknownCSV, mapping, { accountId: 'acc-1' })
  check('Mapeo manual: 1 trade parseado', r.count === 1)
  check('Mapeo manual: format=manual-mapping', r.format === 'manual-mapping')
  const sig = headerSignatureHash(a.headers)
  check('Mapeo manual: firma de cabeceras generada', typeof sig === 'string' && sig.length > 0)
}

// ── 6. Deduplicación sigue funcionando entre importaciones ──
{
  const first  = parseCSV(tradeLockerCSV, { accountId: 'acc-1' })
  const second = parseCSV(tradeLockerCSV, { accountId: 'acc-1', existingTrades: first.trades })
  check('Dedup: 2ª importación del mismo CSV no repite trades', second.count === 0 && second.duplicates === 1)
}

// ── 7. Regresión: Rithmic, Bulenox, E2T siguen funcionando igual ──
const rithmicCSV = [
  'Some report header line',
  'Completed Orders',
  'Status,Buy/Sell,Symbol,Avg Fill Price,Create Time (RDT),Qty Filled,Closed Profit/Loss,Commission',
  'Filled,BUY,MNQ,19500,2025-04-18 09:15:00,1,0,1.5',
  'Filled,SELL,MNQ,19530,2025-04-18 09:20:00,1,60,1.5',
  'Filled,BUY,NQ,19000,2025-04-19 09:15:00,1,0,1.5', // sin cierre → posición abierta
].join('\n')
{
  const a = analyzeCSV(rithmicCSV)
  check('Rithmic: analyzeCSV confident=true, format=rithmic', a.confident && a.format === 'rithmic')
  const r = parseCSV(rithmicCSV, { accountId: 'acc-1' })
  check('Rithmic: 1 trade cerrado emparejado', r.count === 1)
  check('Rithmic: 1 posición abierta detectada (nuevo, antes se ignoraba en silencio)', r.openIgnored === 1)
}

const bulenoxCSV = [
  'Account,Date/Time,Symbol,Side,Order type,Quantity,Price,Gross P/L,Fee,Net P/L,Connection name',
  'ACC1,18/04/2025 09:15:00,MNQ,Buy,Market,1,"19500,00",0,"1,50",0,Rithmic',
  'ACC1,18/04/2025 09:19:00,MNQ,Sell,Market,1,"19530,00","60,00","1,50","57,00",Rithmic',
].join('\n')
{
  const a = analyzeCSV(bulenoxCSV)
  check('Bulenox: analyzeCSV confident=true, format=bulenox', a.confident && a.format === 'bulenox')
  const r = parseCSV(bulenoxCSV, { accountId: 'acc-1' })
  check('Bulenox: 1 trade agrupado', r.count === 1)
}

const e2tCSV = [
  'SYMBOL,QTY,BUY PRICE,BUY TIME,DURATION,SELL TIME,SELL PRICE,P&L',
  'ES,1,5000,05/01/2025 09:30:00,15m,05/01/2025 09:45:00,5010,500',
].join('\n')
{
  const a = analyzeCSV(e2tCSV)
  check('E2T: analyzeCSV confident=true, format=e2t', a.confident && a.format === 'e2t')
  const r = parseCSV(e2tCSV, { accountId: 'acc-1' })
  check('E2T: 1 trade parseado', r.count === 1)
}

// ── 8. TradingView (filas Entry/Exit pareadas por Trade number) ──
const tradingViewCSV = [
  'Trade number,Type,Date and time,Signal,Price USD,Size (qty),Size (value),Net PnL USD,Return %,Favorable excursion USD,Favorable excursion %,Adverse excursion USD,Adverse excursion %,Cumulative PnL USD,Cumulative PnL %,Duration (bars)',
  '1,Exit long,2026-04-13 08:30,Bracket Take Profit,25303.5,2,101089,125,0.12,125,0.12,-109,-0.11,125,0.25,3',
  '1,Entry long,2026-04-13 08:15,Buy market order,25272.25,2,101089,125,0.12,125,0.12,-109,-0.11,125,0.25,3',
  '2,Entry long,2026-04-14 08:00,Buy market order,25400,2,101242,0,0,0,0,0,0,125,0.25,0', // sin Exit → abierta
].join('\n')
{
  const a = analyzeCSV(tradingViewCSV)
  check('TradingView: analyzeCSV confident=true, format=tradingview', a.confident && a.format === 'tradingview')
  const r = parseCSV(tradingViewCSV, { accountId: 'acc-1', defaultSymbol: 'BTCUSD' })
  check('TradingView: 1 trade emparejado (2º sin Exit ignorado)', r.count === 1)
  check('TradingView: 1 operación abierta detectada', r.openIgnored === 1)
  check('TradingView: símbolo por defecto aplicado', r.trades[0]?.pair === 'BTC')
}

// ── 9. MT4 (Ticket/Item, Time/Price duplicados, incluye Taxes) ──
const mt4CSV = [
  'Ticket,Open Time,Type,Size,Item,Price,S/L,T/P,Close Time,Price,Commission,Taxes,Swap,Profit',
  '100234,2025-05-01 08:00:00,buy,0.10,EURUSD,1.0800,0,0,2025-05-01 09:00:00,1.0850,-2,0,-0.5,47.5',
  '100235,2025-05-02 08:00:00,sell,0.20,GBPUSD,1.2500,0,0,,,-3,0,0,0', // sin Close Time → abierta
].join('\n')
{
  const a = analyzeCSV(mt4CSV)
  check('MT4: analyzeCSV confident=true, format=mt4', a.confident && a.format === 'mt4')
  const r = parseCSV(mt4CSV, { accountId: 'acc-1' })
  check('MT4: 1 trade cerrado importado', r.count === 1)
  check('MT4: 1 operación abierta detectada', r.openIgnored === 1)
}

// ── 10. Interactive Brokers (sección "Trades" dentro de un CSV multi-sección) ──
const ibCSV = [
  'Statement,Header,Field Name,Field Value',
  'Statement,Data,BrokerName,Interactive Brokers',
  'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
  'Trades,Data,Order,Stocks,USD,AAPL,"2025-05-01, 10:30:00",-100,150.25,150.25,15025,-1.5,-15000,25,0,O',
  'Trades,Data,Order,Stocks,USD,MSFT,"2025-05-02, 11:00:00",50,300.00,300.00,-15000,-1,15000,0,0,O', // Realized P/L=0 → abierta
  'Open Positions,Header,DataDiscriminator,Symbol,Quantity',
  'Open Positions,Data,Summary,MSFT,50',
].join('\n')
{
  const a = analyzeCSV(ibCSV)
  check('IB: analyzeCSV confident=true, format=interactive_brokers', a.confident && a.format === 'interactive_brokers')
  const r = parseCSV(ibCSV, { accountId: 'acc-1' })
  check('IB: 1 trade cerrado importado (ignora otras secciones del CSV)', r.count === 1)
  check('IB: 1 ejecución de apertura (Realized P/L=0) detectada', r.openIgnored === 1)
}

// ── 11. Confianza expuesta correctamente ──
{
  const legacyResult = parseCSV(tradovateCSV, { accountId: 'acc-1' })
  check('Confianza: formato legacy (Tradovate) = 100%', legacyResult.confidence === 100)
  const sigResult = parseCSV(mt4CSV, { accountId: 'acc-1' })
  check('Confianza: formato por firma (MT4) entre 60 y 100', sigResult.confidence >= 60 && sigResult.confidence <= 100)
}

// ── 12. Tradovate/Apex Performance real: cortos, pérdidas, "$(x)", dedupe ──
const apexCSV = [
  'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration',
  'MNQU6,-2,0,0.25,1001,2001,2,28996.75,29072.00,$301.00,09/02/2026 02:52:25,09/01/2026 20:33:02,6h 19min 22sec',
  'MNQU6,-2,0,0.25,1002,2002,1,29473.00,29444.75,$(56.50),09/09/2026 11:02:06,09/09/2026 11:32:26,30min 20sec',
  'MNQU6,-2,0,0.25,1003,2003,1,29450.25,29442.50,$(15.50),09/09/2026 13:08:47,09/09/2026 13:39:44,30min 57sec',
  'MNQU6,-2,0,0.25,1004,2003,1,29467.00,29442.50,"$(1,049.00)",09/09/2026 13:24:16,09/09/2026 13:39:44,15min 27sec',
].join('\n')
{
  const r = parseCSV(apexCSV, { accountId: 'acc-A' })
  const [shortWin, longLoss] = [r.trades.find(t => t.dollarPnl === 301), r.trades.find(t => t.dollarPnl === -56.5)]
  check('Apex: 4 trades, PnL total = -820', r.count === 4 && Math.round(r.trades.reduce((s, t) => s + t.dollarPnl, 0) * 100) === -82000)
  check('Apex: vendido antes de comprar = Short, fecha/hora de la venta', shortWin?.direction === 'Short' && shortWin?.date === '2026-09-01' && shortWin?.time === '20:33' && shortWin?.entryPrice === 29072)
  check('Apex: largo perdedor sigue siendo Long, entrada 11:02', longLoss?.direction === 'Long' && longLoss?.time === '11:02' && longLoss?.exitTime === '11:32')
  const existing = r.trades.map(t => ({ ...t, accountId: 'acc-A' }))
  check('Apex: reimportar en la misma cuenta = todo duplicado', parseCSV(apexCSV, { accountId: 'acc-A', existingTrades: existing }).count === 0)
  check('Apex: mismo CSV en otra cuenta se importa entero', parseCSV(apexCSV, { accountId: 'acc-B', existingTrades: existing }).count === 4)
}

// ── 13. Tradovate clásico (formato A) con "$" y CSV re-guardado con Excel (;) ──
{
  const a = 'Product,Buy Price,Sell Price,P/L,Paired Qty,Bought Timestamp,Sold Timestamp,Pair ID\nMNQU6,100,90,$(56.50),1,09/09/2026 11:02:06,09/09/2026 11:32:26,p1\nMNQU6,100,110,"$1,200.00",1,09/09/2026 12:02:06,09/09/2026 12:32:26,p2'
  const ra = parseCSV(a, { accountId: 'acc-1' })
  check('Tradovate A: PnL con "$" y miles leído bien', ra.trades.map(t => t.dollarPnl).sort((x, y) => x - y).join() === '-56.5,1200')
  const excel = 'symbol;buyPrice;sellPrice;pnl;qty;boughtTimestamp;soldTimestamp;buyFillId\nMNQU6;29473,00;29444,75;-56,50 $;1;25/09/2026 11:02:06;25/09/2026 11:32:26;x1'
  const re = parseCSV(excel, { accountId: 'acc-1' })
  check('Excel (;, coma decimal, DD/MM): 1 trade, -56.5, 2026-09-25', re.count === 1 && re.trades[0].dollarPnl === -56.5 && re.trades[0].date === '2026-09-25' && re.trades[0].direction === 'Long')
}

// ── 14. Comisión por contrato de la cuenta (PnL bruto → neto) ──
{
  const r = parseCSV(apexCSV, { accountId: 'acc-C', commissionPerContract: 1.08 })
  const shortWin = r.trades.find(t => t.grossPnl === 301)
  check('Comisión: 2 contratos × $1.08 restados al trade', shortWin?.dollarPnl === 298.84 && shortWin?.fees === 2.16)
  check('Comisión: total neto = bruto − comisiones', Math.round(r.trades.reduce((s, t) => s + t.dollarPnl, 0) * 100) === -82000 - 5 * 108)
  check('Comisión: sin configurar no cambia nada', parseCSV(apexCSV, { accountId: 'acc-D' }).trades.every(t => t.grossPnl === undefined))
}

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} FALLO(S)`)
process.exit(failures === 0 ? 0 : 1)
