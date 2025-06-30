import z from "zod"
import { callRpc } from "./callRpc.js"

export type MultiRpcResponse<T, K extends readonly unknown[]> = {
  success: false
  error: Error
  params: K
} | {
  success: true
  response: T
  params: K
}

export async function callMultiRpc<T extends z.ZodTypeAny, K extends readonly unknown[]>(
  schema: T, params: [string, K][]
): Promise<MultiRpcResponse<z.infer<T>, K>[]> {
  const rpcSchema = z.array(z.object({
    result: schema.nullish().optional(),
    error: z.any().nullish().optional()
  }))
  
  const response = await callRpc(rpcSchema, 'sandshrew_multicall', params)
  const responseList = response.map((response, index) => {
    const [method, param] = params[index]!
    if (response.result == null) {
      const errorMessage = JSON.stringify(response.error ?? 'Unknown error')
      const error = new Error(`Bitcoin RPC error for ${method} with params ${JSON.stringify(param)}: ${errorMessage}`)
      return { success: false, error, params: param } as const
    }
    return { success: true, response: response.result, params: param } as const
  })
  
  return responseList
}
