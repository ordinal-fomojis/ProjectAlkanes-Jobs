import { z } from "zod"
import { normaliseTicker } from "../brc-ticker.js"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(z.object({
    ticker: z.string(),
  }))
})

const PAGE_SIZE = 500

export async function getInteractedBrcTokensInBlock(height: number) {
  const defaultTokens = await getInteractedBrcTokensInBlockByType(height, 'default')
  const sixByteTokens = await getInteractedBrcTokensInBlockByType(height, '6-byte')
  return new Set([...defaultTokens, ...sixByteTokens])
}

async function getInteractedBrcTokensInBlockByType(height: number, type: 'default' | '6-byte') {
  const tickers: string[] = []
  const { total, detail } = await getBrcHistoryByHeightPaged(height, 0, type)
  tickers.push(...detail.map(d => d.ticker))
  let page = 1
  while (tickers.length < total) {
    const { detail: nextDetail } = await getBrcHistoryByHeightPaged(height, page, type)
    tickers.push(...nextDetail.map(d => d.ticker))
    page++
  }
  return tickers.map(normaliseTicker)
}

async function getBrcHistoryByHeightPaged(height: number, page: number, type: 'default' | '6-byte') {
  const path = type === '6-byte' ? 'brc20-prog' : 'brc20'
  return await unisatFetch(Schema, `/${path}/history-by-height/${height}?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
}
