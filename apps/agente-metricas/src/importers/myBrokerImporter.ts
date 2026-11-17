import { NormalizedTrade } from "../types"

export function isMyBrokerCSV(headers: string[]) {
  return headers.includes("MyBroker Unique Column")
}

export function parseMyBroker(rows: any[]): NormalizedTrade[] {
  return rows.map(row => ({
    tradeId: row.id,
    account: row.account || "unknown",
    source: "myBroker",
    symbol: row.symbol,
    side: row.side === "buy" ? "long" : "short",
    quantity: Number(row.qty),
    entryTime: row.entry,
    exitTime: row.exit,
    pnl: Number(row.pnl),
    fees: Number(row.fees || 0),
    setup: row.setup || "manual"
  }))
}