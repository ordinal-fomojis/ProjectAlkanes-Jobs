import z from "zod"
import { BrcType } from "../constants.js"
import { RateLimitContext } from "../rateLimit.js"
import { UnisatBrcPath, unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  height: z.number()
})

export async function getBestBrcBlockHeight(type: BrcType, rateLimitContext?: RateLimitContext) {
  return (await unisatFetch(Schema, `${UnisatBrcPath[type]}/bestheight`, rateLimitContext)).height
}
