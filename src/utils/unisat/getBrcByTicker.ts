import z from "zod"
import { normaliseTicker, tickerLength } from "../brc-ticker.js"
import { RateLimitContext } from "../rateLimit.js"
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

export async function getBrcByTicker(ticker: string, rateLimitContext?: RateLimitContext) {
  const path = tickerLength(ticker) === 6 ? 'brc20-prog' : 'brc20'
  return await unisatFetch(UnisatBrcSchema, `/${path}/${encodeURIComponent(normaliseTicker(ticker))}/info`, rateLimitContext)
}

export async function getBrcsByTicker(tickers: string[], rateLimitContext?: RateLimitContext) {
  const results: PromiseSettledResult<z.output<typeof UnisatBrcSchema>>[] = []
  for (const ticker of tickers) {
    try {
      results.push({ status: 'fulfilled', value: await getBrcByTicker(ticker, rateLimitContext) })
    } catch (error) {
      results.push({ status: "rejected", reason: error })
    }
  }
  return results
}
