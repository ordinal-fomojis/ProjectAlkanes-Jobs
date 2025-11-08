import { z } from "zod"
import { BITCOIN_NETWORK, BrcType, UNISAT_API_KEY } from "../constants.js"
import { createRateLimitContext, RateLimitContext, rateLimitFetch, RateLimitOptions } from "../rateLimit.js"

export const UnisatBrcPath = {
  [BrcType.Default]: '/brc20',
  [BrcType.SixByte]: '/brc20-prog'
}

export const UnisatRateLimitOptions: RateLimitOptions = {
  requestsPerSecond: 2.5,
  isRateLimitError: (error) => {
    if (error.status !== 403) return false
    try {
      const err = JSON.parse(error.text) as { code?: number }
      return err.code === -2006
    } catch {
      return false
    }
  }
}

export async function unisatFetch<Output, Input>(schema: z.ZodType<Output, Input>, path: string, rateLimitContext: RateLimitContext | undefined) {
  const baseUrl = `https://open-api${BITCOIN_NETWORK === 'mainnet' ? '' : '-testnet'}.unisat.io/v1/indexer`
  
  const unisatSchema = z.object({
    code: z.union([z.literal(0), z.literal(-1)]),
    msg: z.string().default('Unisat did not return a message'),
    data: schema.nullable()
  })

  const { code, msg, data } = await rateLimitFetch(unisatSchema, `${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${UNISAT_API_KEY}` }
  }, rateLimitContext ?? createRateLimitContext(UnisatRateLimitOptions))

  if (code === -1 || data == null) {
    throw new Error(`Unisat request to ${path} failed with message: ${msg}`)
  }
  return data
}
