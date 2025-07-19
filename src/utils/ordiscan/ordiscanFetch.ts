import z from "zod"
import { ORDISCAN_API_KEY } from "../constants.js"
import { retrySchemaFetch } from "../retryFetch.js"

const RATE_LIMIT = 100 // requests per minute
const RATE_LIMIT_MS = (60000 / RATE_LIMIT) * 1.05 // 5% buffer to avoid hitting rate limit
let LastRequestTime: number | null = null

export async function ordiscanFetch<Output, Def extends z.ZodTypeDef, Input>(schema: z.ZodType<Output, Def, Input>, path: string, params: Record<string, string> = {}) {
  const responseSchema = z.object({
    data: schema.nullish().optional(),
    error: z.any().nullish().optional()
  })
  const urlParams = new URLSearchParams(params).toString()
  const nextRequestTime = LastRequestTime == null ? null : LastRequestTime + RATE_LIMIT_MS
  const delay = nextRequestTime == null ? 0 : Math.max(0, nextRequestTime - Date.now())
  LastRequestTime = nextRequestTime ?? Date.now()
  
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay))
  }

  const response = await retrySchemaFetch(responseSchema, `https://api.ordiscan.com/v1/${path}?${urlParams}`, {
    headers: { 'Authorization': `Bearer ${ORDISCAN_API_KEY}` }
  })
  if (response.data != null) {
    return response.data
  } else {
    throw new Error(`Ordiscan error: ${JSON.stringify(response.error ?? 'Unknown error')}`)
  }
}
