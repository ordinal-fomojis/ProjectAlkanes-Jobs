import z from "zod"
import { throttledPromiseAllSettled } from "../throttledPromise.js"
import { ordiscanFetch } from "./ordiscanFetch.js"

interface AlkaneToken {
  alkaneId: string
  name: string | null
  symbol: string | null
  logoUrl: string | null
  preminedSupply: number
  amountPerMint: number | null
  mintCountCap: number | null
  currentSupply: number
  currentMintCount: number
  deployTxid: string | null
  deployTimestamp: Date | null
  synced: boolean
  blockSyncedAt: number
}

const BaseAlkanesSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  logo_url: z.string().nullable(),
  premined_supply: z.string(),
  amount_per_mint: z.string().nullable(),
  mint_count_cap: z.string().nullable(),
  deploy_txid: z.string().nullable(),
  deploy_timestamp: z.string().nullable()
})

const FullAlkanesSchema = BaseAlkanesSchema.extend({
  current_supply: z.string(),
  current_mint_count: z.number()
})

const RATE_LIMIT = 100 // requests per minute

export async function getAlkaneTokens(alkaneIds: string[]) {
  const start = performance.now()
  return await throttledPromiseAllSettled(alkaneIds.map((id, i) => async () => {
    const allowedToStartAt = start + (i * (60000 / RATE_LIMIT)) * 1.1
    const timeTilStart = allowedToStartAt - performance.now()
    if (timeTilStart > 0) {
      await new Promise(r => setTimeout(r, timeTilStart))
    }
    
    const token = await ordiscanFetch(FullAlkanesSchema, `alkane/${id}`)
    const alkane: AlkaneToken = {
      alkaneId: token.id,
      name: token.name,
      symbol: token.symbol,
      logoUrl: token.logo_url,
      preminedSupply: parseInt(token.premined_supply),
      amountPerMint: token.amount_per_mint == null ? null : parseInt(token.amount_per_mint),
      mintCountCap: token.mint_count_cap == null ? null : parseInt(token.mint_count_cap),
      deployTxid: token.deploy_txid,
      currentSupply: parseInt(token.current_supply),
      currentMintCount: token.current_mint_count,
      synced: true,
      blockSyncedAt: 0,
      deployTimestamp: token.deploy_timestamp == null ? null : new Date(token.deploy_timestamp)
    }
    return alkane
  }))
}

export async function getAlkaneIdsAfterTimestamp(minTimestamp: Date | null) {
  const alkanes: AlkaneToken[] = []
  let page = 1
  while (true) {
    const result = await getPagedAlkaneIds(page)
    if (result.length === 0) {
      return alkanes
    }

    for (const token of result) {
      if (minTimestamp == null || token.deployTimestamp == null || token.deployTimestamp >= minTimestamp) {
        alkanes.push(token)
      } else {
        return alkanes
      }
    }
    page++
  }
}

async function getPagedAlkaneIds(page: number): Promise<AlkaneToken[]> {
  return (await ordiscanFetch(z.array(BaseAlkanesSchema), 'alkanes', {
    sort: 'newest',
    type: 'TOKEN',
    page: page.toString()
  })).map(a => ({
    alkaneId: a.id,
    name: a.name,
    symbol: a.symbol,
    logoUrl: a.logo_url,
    preminedSupply: parseInt(a.premined_supply),
    amountPerMint: a.amount_per_mint == null ? null : parseInt(a.amount_per_mint),
    mintCountCap: a.mint_count_cap == null ? null : parseInt(a.mint_count_cap),
    deployTxid: a.deploy_txid,
    currentSupply: 0,
    currentMintCount: 0,
    synced: false,
    blockSyncedAt: 0,
    deployTimestamp: a.deploy_timestamp == null ? null : new Date(a.deploy_timestamp)
  }))
}
