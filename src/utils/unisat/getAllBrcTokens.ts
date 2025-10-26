import z from "zod"
import { normaliseTicker } from "../brc-ticker.js"
import { UnisatBrcSchema } from "./getBrcByTicker.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(UnisatBrcSchema)
})

const PAGE_SIZE = 500

export async function getAllBrcTokens() {
  const defaultTokens = await getAllBrcTokensByType('default')
  const sixByteTokens = await getAllBrcTokensByType('6-byte')
  return [...defaultTokens, ...sixByteTokens]
}

async function getAllBrcTokensByType(type: 'default' | '6-byte') {
  const tokens: z.infer<typeof UnisatBrcSchema>[] = []
  const { total, detail } = await getPagedBrcTokens(0, type)
  tokens.push(...detail)
  let page = 1
  while (tokens.length < total) {
    const { detail: nextDetail } = await getPagedBrcTokens(page, type)
    tokens.push(...nextDetail)
    page++
  }
  for (const token of tokens) {
    token.ticker = normaliseTicker(token.ticker)
  }
  return tokens
}

async function getPagedBrcTokens(page: number, type: 'default' | '6-byte') {
  const path = type === '6-byte' ? 'brc20-prog' : 'brc20'
  return await unisatFetch(Schema, `/${path}/status?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}&sort=deploy`)
}
