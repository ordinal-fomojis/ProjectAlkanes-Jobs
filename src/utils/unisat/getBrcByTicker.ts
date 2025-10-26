import z from "zod"
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
  return await unisatFetch(UnisatBrcSchema, `/brc20/${encodeURIComponent(ticker)}/info`)
}

export async function getBrcsByTicker(tickers: string[]) {
  return await throttledPromiseAllSettled(tickers.map(ticker => () => getBrcByTicker(ticker)))
}
