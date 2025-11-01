import z from "zod"
import { RateLimitContext } from "../rateLimit.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  height: z.number()
})

export async function getBestBrcBlockHeight(type: 'default' | '6-byte', rateLimitContext?: RateLimitContext) {
  const path = type === '6-byte' ? 'brc20-prog' : 'brc20'
  return (await unisatFetch(Schema, `/${path}/bestheight`, rateLimitContext)).height
}
