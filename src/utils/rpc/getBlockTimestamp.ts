import z from "zod"
import { callRpc } from "./callRpc.js"

export async function getBlockTimestamp(height: number): Promise<Date> {
  const hash = await callRpc(z.string(), 'getblockhash', [height])
  const { time } = await callRpc(z.object({ time: z.number() }), 'getblockheader', [hash])
  return new Date(time * 1000)
}
