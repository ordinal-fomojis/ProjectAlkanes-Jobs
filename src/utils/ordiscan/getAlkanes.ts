import { bigDecimal } from 'js-big-decimal'
import z from "zod"
import { AlkaneToken } from "../../database/collections.js"
import { throttledPromiseAllSettled } from "../throttledPromise.js"
import { ordiscanFetch } from "./ordiscanFetch.js"

const UNSYNCED_FACTORY_CLONE_ID = "UNKNOWN"

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

const ZERO = new bigDecimal(0)
const HUNDRED = new bigDecimal(100)

export async function getAlkaneTokens(tokens: Pick<AlkaneToken, 'alkaneId' | 'clonedFrom'>[], blockHeight: number) {
  return await throttledPromiseAllSettled(tokens.map(existingToken => async () => {
    const token = await ordiscanFetch(FullAlkanesSchema, `alkane/${existingToken.alkaneId}`)
    const factoryClone = existingToken.clonedFrom === UNSYNCED_FACTORY_CLONE_ID
      ? (token.deploy_txid == null ? null : await getAlkaneFactoryClone(token.deploy_txid))
      : existingToken.clonedFrom
    
    // WORKAROUND: Hardcode DIESEL data as it is incorrect on Ordiscan
    if (token.id === '2:0') {
      token.mint_count_cap = '359200'
      token.amount_per_mint = '312500000'
    }

    const preminedSupply = toAlkaneValue(token.premined_supply)
    const amountPerMint = token.amount_per_mint == null ? null : toAlkaneValue(token.amount_per_mint)

    const mintCountCap = token.mint_count_cap == null ? null : new bigDecimal(token.mint_count_cap)

    const maxSupply = mintCountCap == null ? null
      : (amountPerMint == null ? preminedSupply : preminedSupply.add(amountPerMint.multiply(mintCountCap)))
    const percentageMinted = mintCountCap == null || mintCountCap.compareTo(ZERO) === 0 ? null
      : new bigDecimal(token.current_mint_count).multiply(HUNDRED).divide(mintCountCap)
    const preminedPercentage = maxSupply == null || maxSupply.compareTo(ZERO) === 0 ? null
      : preminedSupply.multiply(HUNDRED).divide(maxSupply)
    const hasPremine = preminedSupply.compareTo(ZERO) > 0

    const alkane: AlkaneToken = {
      alkaneId: token.id,
      name: token.name,
      symbol: token.symbol,
      logoUrl: token.logo_url,
      preminedSupply: preminedSupply.stripTrailingZero().getValue(),
      amountPerMint: amountPerMint?.stripTrailingZero().getValue() ?? null,
      maxSupply: maxSupply?.stripTrailingZero().getValue() ?? null,
      currentSupply: toAlkaneValue(token.current_supply).stripTrailingZero().getValue(),
      mintCountCap: token.mint_count_cap,
      approximateMintCountCap: token.mint_count_cap == null ? null : parseInt(token.mint_count_cap, 10),
      currentMintCount: token.current_mint_count,
      mintedOut: token.mint_count_cap != null && (BigInt(token.current_mint_count) >= BigInt(token.mint_count_cap)),
      deployTxid: token.deploy_txid,
      synced: true,
      blockSyncedAt: blockHeight,
      deployTimestamp: token.deploy_timestamp == null ? null : new Date(token.deploy_timestamp),
      clonedFrom: factoryClone,
      percentageMinted: percentageMinted == null ? null : parseFloat(percentageMinted.getValue()),
      preminedPercentage: preminedPercentage == null ? null : parseFloat(preminedPercentage.getValue()),
      hasPremine
    }

    // WORKAROUND: Hardcode DEISEL data as it is incorrect on Ordiscan
    if (alkane.alkaneId === '2:0') {
      alkane.maxSupply = '1562500'
      alkane.preminedPercentage = parseFloat(new bigDecimal(alkane.preminedSupply).multiply(HUNDRED).divide(new bigDecimal(alkane.maxSupply)).getValue())
      const userMintedAmount = new bigDecimal(alkane.currentSupply).subtract(new bigDecimal(alkane.preminedSupply))
      const maxExludingPremine = new bigDecimal(alkane.maxSupply).subtract(new bigDecimal(alkane.preminedSupply))
      alkane.currentMintCount = parseInt(userMintedAmount.divide(new bigDecimal('3.125')).round().getValue())
      alkane.percentageMinted = parseFloat(userMintedAmount.multiply(HUNDRED).divide(maxExludingPremine).getValue())
    }

    return alkane
  }))
}

export async function getAlkaneIdsAfterTimestamp(minTimestamp: Date | null) {
  const alkanes: AlkaneToken[] = []
  let page = 1
  let result: AlkaneToken[] = []
  do {
    result = await getPagedAlkaneIds(page)

    for (const token of result) {
      if (minTimestamp == null || token.deployTimestamp == null || token.deployTimestamp >= minTimestamp) {
        alkanes.push(token)
      } else {
        return alkanes
      }
    }
    page++
  } while(result.length !== 0)

  return alkanes
}

async function getPagedAlkaneIds(page: number): Promise<AlkaneToken[]> {
  return (await ordiscanFetch(z.array(BaseAlkanesSchema), 'alkanes', {
    sort: 'newest',
    type: 'TOKEN',
    page: page.toString()
  })).map(token => {
    const preminedSupply = toAlkaneValue(token.premined_supply)
    const amountPerMint = token.amount_per_mint == null ? null : toAlkaneValue(token.amount_per_mint)

    const mintCountCap = token.mint_count_cap == null ? null : new bigDecimal(token.mint_count_cap)

    const maxSupply = mintCountCap == null ? null
      : (amountPerMint == null ? preminedSupply : preminedSupply.add(amountPerMint.multiply(mintCountCap)))
    const preminedPercentage = maxSupply == null || maxSupply.compareTo(ZERO) === 0 ? null
      : preminedSupply.multiply(HUNDRED).divide(maxSupply)
    const hasPremine = preminedSupply.compareTo(ZERO) > 0

    return {
      alkaneId: token.id,
      name: token.name,
      symbol: token.symbol,
      logoUrl: token.logo_url,
      preminedSupply: preminedSupply.stripTrailingZero().getValue(),
      amountPerMint: amountPerMint?.stripTrailingZero().getValue() ?? null,
      maxSupply: maxSupply?.stripTrailingZero().getValue() ?? null,
      currentSupply: "0",
      mintCountCap: token.mint_count_cap,
      approximateMintCountCap: token.mint_count_cap == null ? null : parseInt(token.mint_count_cap, 10),
      currentMintCount: 0,
      mintedOut: true,
      deployTxid: token.deploy_txid,
      synced: false,
      blockSyncedAt: 0,
      deployTimestamp: token.deploy_timestamp == null ? null : new Date(token.deploy_timestamp),
      clonedFrom: UNSYNCED_FACTORY_CLONE_ID,
      percentageMinted: null,
      preminedPercentage: preminedPercentage == null ? null : parseFloat(preminedPercentage.getValue()),
      hasPremine
    }
  })
}

const AlkaneTxSchema = z.object({
  protostones: z.array(z.object({
    type: z.string(),
    alkaneId: z.string().nullable().optional()
  }))
})

async function getAlkaneFactoryClone(txid: string) {
  const { protostones } = await ordiscanFetch(AlkaneTxSchema, `tx/${txid}/alkanes`)
  const factoryClone = protostones.find(p => p.type === 'FACTORY_CLONE')
  return factoryClone?.alkaneId ?? null
}

const DIVISOR = new bigDecimal(100_000_000)
function toAlkaneValue(val: string | number) {
  return new bigDecimal(val).divide(DIVISOR, 8)
}
