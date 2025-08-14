import { z } from "zod"
import { BITCOIN_RPC_URL } from "../constants.js"
import { retrySchemaFetch } from "../retryFetch.js"

export async function callRpc<Output, Input>(schema: z.ZodType<Output, Input>, method: string, params: unknown[] = []) {
  const rpcSchema = z.object({
    error: z.any().nullish().optional(),
    result: schema.nullish().optional()
  })
  const response = await retrySchemaFetch(rpcSchema, BITCOIN_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: "2.0", 
      id: 1, 
      method: method,
      params
    })
  })
  if (response.result != null) {
    return response.result
  } else {
    throw new Error(`Bitcoin RPC error: ${JSON.stringify(response.error ?? 'Unknown error')}`)
  }
}
