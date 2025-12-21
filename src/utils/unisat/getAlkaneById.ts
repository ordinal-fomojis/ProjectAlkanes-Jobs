import z from "zod"
import { createRateLimitContext, RateLimitContext } from "../rateLimit.js"
import { unisatFetch, UnisatRateLimitOptions } from "./unisatFetch.js"

const BaseUnisatAlkaneSchema = z.object({
  alkaneid: z.string(),
  height: z.number(),
  txid: z.string(),
  timestamp: z.number(),
})

const UnisatAlkaneNonTokenSchema = BaseUnisatAlkaneSchema.extend({
  type: z.enum(["contract", "collection", "nft"])
})

const UnisatAlkaneTokenSchema = BaseUnisatAlkaneSchema.extend({
  type: z.literal("token"),
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
export type UnisatAlkaneToken = z.infer<typeof UnisatAlkaneTokenSchema>

export const UnisatAlkaneSchema = z.union([UnisatAlkaneNonTokenSchema, UnisatAlkaneTokenSchema])
export type UnisatAlkane = z.infer<typeof UnisatAlkaneSchema>

type AlkaneResponse = { id: string } & ({ exists: false } | { exists: true, data: UnisatAlkane })

async function getAlkaneById(id: string, rateLimitContext?: RateLimitContext) {
  return await unisatFetch(UnisatAlkaneSchema, `/alkanes/${encodeURIComponent(id)}/info`, rateLimitContext, true)
}

type PromiseResult<T> = {
    status: "fulfilled"
    value: T
} | {
    status: "rejected"
    reason: unknown
}

// Response of null indicates a successful request, but the alkane does not exist
export async function getAlkanesByIds(ids: string[], rateLimitContext?: RateLimitContext) {
  rateLimitContext ??= createRateLimitContext(UnisatRateLimitOptions)

  const results: PromiseResult<AlkaneResponse>[] = []
  for (const id of ids) {
    try {
      const alkane = await getAlkaneById(id, rateLimitContext)
      if (alkane == null) {
        results.push({ status: 'fulfilled', value: { id, exists: false } })
      } else {
        results.push({ status: 'fulfilled', value: { id, exists: true, data: alkane } })
      }
    } catch (error) {
      results.push({ status: "rejected", reason: error })
    }
  }
  return results
}
