import z from "zod"
import { callMultiRpc } from "./callMultiRpc.js"

export async function getRawTransactions(txids: string[]) {
  return await callMultiRpc(z.string(), txids.map(id => ['btc_getrawtransaction', [id]]))
}
