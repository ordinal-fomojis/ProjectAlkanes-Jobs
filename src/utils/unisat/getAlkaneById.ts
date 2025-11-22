import z from "zod"
import { createRateLimitContext, RateLimitContext } from "../rateLimit.js"
import { unisatFetch, UnisatRateLimitOptions } from "./unisatFetch.js"

export const UnisatAlkaneSchema = z.object({
  alkaneid: z.string(),
  height: z.number(),
  txid: z.string(),
  timestamp: z.number(),
  logo: z.string(),
  tokenData: z.object({
    name: z.string(),
    symbol: z.string(),
    divisibility: z.number(),
    totalSupply: z.string(),
    maxSupply: z.string(),
    premine: z.string(),
    perMint: z.string(),
    minted: z.number(),
    cap: z.number(),
    mintable: z.boolean(),
    holders: z.number()
  })
})
export type UnisatAlkaneToken = z.infer<typeof UnisatAlkaneSchema>

export async function getAlkaneById(id: string, rateLimitContext?: RateLimitContext) {
  return await unisatFetch(UnisatAlkaneSchema, `/alkanes/${encodeURIComponent(id)}/info`, rateLimitContext)
}

type PromiseResult<T> = {
    status: "fulfilled"
    value: T
} | {
    status: "rejected"
    reason: unknown
}

export async function getAlkanesByIds(ids: string[], rateLimitContext?: RateLimitContext) {
  rateLimitContext ??= createRateLimitContext(UnisatRateLimitOptions)

  const results: PromiseResult<z.output<typeof UnisatAlkaneSchema>>[] = []
  for (const id of ids) {
    try {
      results.push({ status: 'fulfilled', value: await getAlkaneById(id, rateLimitContext) })
    } catch (error) {
      results.push({ status: "rejected", reason: error })
    }
  }
  return results
}
