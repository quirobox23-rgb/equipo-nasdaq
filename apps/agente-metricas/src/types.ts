export type NormalizedTrade = {
  tradeId: string
  account: string
  source: string
  symbol: string
  side: "long" | "short"
  quantity: number
  entryTime: string
  exitTime: string
  pnl: number
  fees: number
  setup: string
}