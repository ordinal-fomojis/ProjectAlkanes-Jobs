import z from "zod"
import { unisatFetch } from "./unisatFetch.js"

const BestBlockHeightSchema = z.object({
  height: z.number()
})

export async function getBestBrcBlockHeight() {
  return (await unisatFetch(BestBlockHeightSchema, '/brc20/bestheight')).height
}
