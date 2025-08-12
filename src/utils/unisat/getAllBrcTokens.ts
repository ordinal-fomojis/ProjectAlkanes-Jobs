import z from "zod"
import { UnisatBrcSchema } from "./getBrcByTicker.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(UnisatBrcSchema)
})

const PAGE_SIZE = 500
export async function getAllBrcTokens() {
  const tokens: z.infer<typeof UnisatBrcSchema>[] = []
  const { total, detail } = await getPagedBrcTokens(0)
  tokens.push(...detail)
  let page = 1
  while (tokens.length < total) {
    const { detail: nextDetail } = await getPagedBrcTokens(page)
    tokens.push(...nextDetail)
    page++
  }
  return tokens
}

async function getPagedBrcTokens(page: number) {
  return await unisatFetch(Schema, `/brc20/status?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&sort=deploy`)
}
