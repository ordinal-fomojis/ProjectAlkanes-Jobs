import { z } from "zod"
import { unisatFetch } from "./unisatFetch.js"

const Schema = z.object({
  total: z.number(),
  detail: z.array(z.object({
    ticker: z.string(),
  }))
})

const PAGE_SIZE = 500
export async function getInteractedBrcTokensInBlock(height: number) {
  const tickers: string[] = []
  const { total, detail } = await getBrcHistoryByHeightPaged(height, 0)
  tickers.push(...detail.map(d => d.ticker))
  let page = 1
  while (tickers.length < total) {
    const { detail: nextDetail } = await getBrcHistoryByHeightPaged(height, page)
    tickers.push(...nextDetail.map(d => d.ticker))
    page++
  }
  return new Set(tickers)
}

async function getBrcHistoryByHeightPaged(height: number, page: number) {
  return await unisatFetch(Schema, `/brc20/history-by-height/${height}?start=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`)
}
