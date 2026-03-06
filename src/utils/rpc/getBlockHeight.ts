import z from "zod"
import { callRpc } from "./callRpc.js"

export async function getBlockHeight() {
  return await callRpc(z.number(), 'getblockcount')
}
