import { z } from "zod"
import { normaliseTicker } from "../brc-ticker.js"
import { RateLimitContext } from "../rateLimit.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(z.object({
    ticker: z.string(),
  }))
})

const PAGE_SIZE = 500

export async function getInteractedBrcTokensInBlock(height: number, rateLimitContext?: RateLimitContext) {
  const defaultTokens = await getInteractedBrcTokensInBlockByType(height, 'default', rateLimitContext)
  const sixByteTokens = await getInteractedBrcTokensInBlockByType(height, '6-byte', rateLimitContext)
  return new Set([...defaultTokens, ...sixByteTokens])
}

async function getInteractedBrcTokensInBlockByType(height: number, type: 'default' | '6-byte', rateLimitContext: RateLimitContext | undefined) {
  const tickers: string[] = []
  const { total, detail } = await getBrcHistoryByHeightPaged(height, 0, type, rateLimitContext)
  tickers.push(...detail.map(d => d.ticker))
  let page = 1
  while (tickers.length < total) {
    const { detail: nextDetail } = await getBrcHistoryByHeightPaged(height, page, type, rateLimitContext)
    tickers.push(...nextDetail.map(d => d.ticker))
    page++
  }
  return tickers.map(normaliseTicker)
}

async function getBrcHistoryByHeightPaged(height: number, page: number, type: 'default' | '6-byte', rateLimitContext: RateLimitContext | undefined) {
  const path = type === '6-byte' ? 'brc20-prog' : 'brc20'
  return await unisatFetch(Schema, `/${path}/history-by-height/${height}?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`, rateLimitContext)
}
