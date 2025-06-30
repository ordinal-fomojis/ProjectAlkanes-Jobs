import z from "zod"
import { callRpc } from "./callRpc.js"

export async function getMempoolTransactionIds() {
  return await callRpc(z.array(z.string()), 'btc_getrawmempool')
}
