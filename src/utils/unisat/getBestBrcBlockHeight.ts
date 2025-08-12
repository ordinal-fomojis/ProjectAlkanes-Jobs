import z from "zod"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  height: z.number()
})

export async function getBestBrcBlockHeight() {
  return (await unisatFetch(Schema, '/brc20/bestheight')).height
}
