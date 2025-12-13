import z from "zod"
import { createRateLimitContext, RateLimitContext } from "../rateLimit.js"
import { UnisatAlkaneSchema } from "./getAlkaneById.js"
import { unisatFetch, UnisatRateLimitOptions } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(UnisatAlkaneSchema)
})

const PAGE_SIZE = 500

export async function getAllAlkaneTokens(rateLimitContext?: RateLimitContext) {
  rateLimitContext ??= createRateLimitContext(UnisatRateLimitOptions)

  const tokens: z.infer<typeof UnisatAlkaneSchema>[] = []
  const { total, detail } = await getPagedAlkaneTokens(0, rateLimitContext)
  tokens.push(...detail)
  let page = 1
  while (tokens.length < total) {
    const { detail: nextDetail } = await getPagedAlkaneTokens(page, rateLimitContext)
    tokens.push(...nextDetail)
    page++
  }

  // Filtering must be done at the end, as we need the total count of tokens for pagination
  return tokens.filter(token => token.type === "token")
}

async function getPagedAlkaneTokens(page: number, rateLimitContext: RateLimitContext) {
  return await unisatFetch(Schema, `/alkanes/info-list?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&sortBy=timestamp&order=asc&type=token`, rateLimitContext)
}
