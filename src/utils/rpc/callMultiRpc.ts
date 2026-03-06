import z from "zod"
import { throttledPromiseAllSettled } from "../throttledPromise.js"
import { callRpc } from "./callRpc.js"

export type MultiRpcResponse<Output, K extends readonly unknown[]> = {
  success: false
  error: Error
  params: K
} | {
  success: true
  response: Output
  params: K
}

export async function callMultiRpc<Output, Input, K extends readonly unknown[]>(
  schema: z.ZodType<Output, Input>, params: [string, K][]
): Promise<MultiRpcResponse<Output, K>[]> {
  const responses = await throttledPromiseAllSettled(params.map(([method, param]) => () => callRpc(schema, method, param)))
  
  return params.map(([method, param], index) => {
    const response = responses[index]
    if (response == null) {
      return { success: false, error: new Error("Failed to retrieve response"), params: param } as const
    }
    if (response.status === "rejected") {
      const errorMessage = String(response.reason)
      const error = new Error(`Bitcoin RPC error for ${method} with params ${JSON.stringify(param)}: ${errorMessage}`)
      return { success: false, error, params: param } as const
    }
    return { success: true, response: response.value, params: param } as const
  })
}
