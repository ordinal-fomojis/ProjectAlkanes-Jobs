import z from "zod"
import { callRpc } from "./callRpc.js"

export async function getBlockTimestamp(height: number): Promise<Date> {
  const hash = await callRpc(z.string(), 'btc_getblockhash', [height])
  const { time } = await callRpc(z.object({ time: z.number() }), 'btc_getblockheader', [hash])
  return new Date(time * 1000)
}
