import { z } from "zod"
import { BITCOIN_NETWORK, UNISAT_API_KEY } from "../constants.js"
import { retrySchemaFetch } from "../retryFetch.js"

const RATE_LIMIT = 5 // requests per second
const RATE_LIMIT_MS = (1000 / RATE_LIMIT) * 1.05 // 5% buffer to avoid hitting rate limit
let LastRequestTime: number | null = null

export async function unisatFetch<Output, Input>(schema: z.ZodType<Output, Input>, path: string) {
  const baseUrl = `https://open-api${BITCOIN_NETWORK === 'mainnet' ? '' : '-testnet'}.unisat.io/v1/indexer`
  
  const unisatSchema = z.object({
    code: z.union([z.literal(0), z.literal(-1)]),
    msg: z.string().default('Unisat did not return a message'),
    data: schema.nullable()
  })

  const nextRequestTime = LastRequestTime == null ? null : LastRequestTime + RATE_LIMIT_MS
  const delay = nextRequestTime == null ? 0 : Math.max(0, nextRequestTime - Date.now())
  LastRequestTime = nextRequestTime ?? Date.now()
  
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay))
  }

  const { code, msg, data } = await retrySchemaFetch(unisatSchema, `${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${UNISAT_API_KEY}` }
  })

  if (code === -1 || data == null) {
    throw new Error(`Unisat request to ${path} failed with message: ${msg}`)
  }
  return data
}
