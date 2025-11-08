import z from "zod"
import { normaliseTicker } from "../brc-ticker.js"
import { BrcType } from "../constants.js"
import { createRateLimitContext, RateLimitContext } from "../rateLimit.js"
import { UnisatBrcSchema } from "./getBrcByTicker.js"
import { UnisatBrcPath, unisatFetch, UnisatRateLimitOptions } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(UnisatBrcSchema)
})

const PAGE_SIZE = 500

export async function getAllBrcTokens(type: BrcType, rateLimitContext?: RateLimitContext) {
  rateLimitContext ??= createRateLimitContext(UnisatRateLimitOptions)

  const tokens: z.infer<typeof UnisatBrcSchema>[] = []
  const { total, detail } = await getPagedBrcTokens(0, type, rateLimitContext)
  tokens.push(...detail)
  let page = 1
  while (tokens.length < total) {
    const { detail: nextDetail } = await getPagedBrcTokens(page, type, rateLimitContext)
    tokens.push(...nextDetail)
    page++
  }
  for (const token of tokens) {
    token.ticker = normaliseTicker(token.ticker)
  }
  return tokens
}

async function getPagedBrcTokens(page: number, type: BrcType, rateLimitContext: RateLimitContext) {
  return await unisatFetch(Schema, `${UnisatBrcPath[type]}/status?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&sort=deploy`, rateLimitContext)
}
