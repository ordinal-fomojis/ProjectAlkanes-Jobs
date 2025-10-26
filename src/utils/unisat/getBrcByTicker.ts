import z from "zod"
import { normaliseTicker, tickerLength } from "../brc-ticker.js"
import { throttledPromiseAllSettled } from "../throttledPromise.js"
import { unisatFetch } from "./unisatFetch.js"

export const UnisatBrcSchema = z.object({
  ticker: z.string(),
  selfMint: z.boolean(),
  holdersCount: z.number(),
  inscriptionNumber: z.number(),
  inscriptionId: z.string(),
  max: z.string(),
  limit: z.string(),
  minted: z.string(),
  totalMinted: z.string(),
  confirmedMinted: z.string(),
  confirmedMinted1h: z.string(),
  confirmedMinted24h: z.string(),
  mintTimes: z.number(),
  decimal: z.number(),
  deployHeight: z.number(),
  deployBlocktime: z.number().optional()
})
export type UnisatBrcToken = z.infer<typeof UnisatBrcSchema>

export async function getBrcByTicker(ticker: string) {
  const path = tickerLength(ticker) === 6 ? 'brc20-prog' : 'brc20'
  return await unisatFetch(UnisatBrcSchema, `/${path}/${encodeURIComponent(normaliseTicker(ticker))}/info`)
}

export async function getBrcsByTicker(tickers: string[]) {
  return await throttledPromiseAllSettled(tickers.map(ticker => () => getBrcByTicker(ticker)))
}
