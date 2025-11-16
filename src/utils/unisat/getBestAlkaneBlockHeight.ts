import z from "zod"
import { RateLimitContext } from "../rateLimit.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  bestHeight: z.number()
})

export async function getBestAlkaneBlockHeight(rateLimitContext?: RateLimitContext) {
  return (await unisatFetch(Schema, `/alkanes/status`, rateLimitContext)).bestHeight
}
