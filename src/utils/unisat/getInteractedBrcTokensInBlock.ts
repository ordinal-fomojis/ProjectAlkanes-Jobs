import { z } from "zod"
import { normaliseTicker } from "../brc-ticker.js"
import { BrcType } from "../constants.js"
import { createRateLimitContext, RateLimitContext } from "../rateLimit.js"
import { UnisatBrcPath, unisatFetch, UnisatRateLimitOptions } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(z.object({
    ticker: z.string(),
  }))
})

const PAGE_SIZE = 500

export async function getInteractedBrcTokensInBlock(type: BrcType, height: number, rateLimitContext?: RateLimitContext) {
  rateLimitContext ??= createRateLimitContext(UnisatRateLimitOptions)

  const tickers: string[] = []
  const { total, detail } = await getBrcHistoryByHeightPaged(type, height, 0, rateLimitContext)
  tickers.push(...detail.map(d => d.ticker))
  let page = 1
  while (tickers.length < total) {
    const { detail: nextDetail } = await getBrcHistoryByHeightPaged(type, height, page, rateLimitContext)
    tickers.push(...nextDetail.map(d => d.ticker))
    page++
  }
  return new Set(tickers.map(normaliseTicker))
}

async function getBrcHistoryByHeightPaged(type: BrcType, height: number, page: number, rateLimitContext: RateLimitContext) {
  return await unisatFetch(Schema, `${UnisatBrcPath[type]}/history-by-height/${height}?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`, rateLimitContext)
}
