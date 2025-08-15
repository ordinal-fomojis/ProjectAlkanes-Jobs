import { bigDecimal } from 'js-big-decimal'
import { BrcToken } from '../database/collections.js'
import { getAllBrcTokens } from './unisat/getAllBrcTokens.js'

const HUNDRED = new bigDecimal(100)

export function mapBrcTokenToDbModel(
  token: Awaited<ReturnType<typeof getAllBrcTokens>>[number], { synced, initialised } : { synced: boolean, initialised: boolean}
) {
  const max = new bigDecimal(token.max)
  const minted = new bigDecimal(token.minted)
  const percentageMinted = minted.divide(max).multiply(HUNDRED)
  return {
    synced: synced,
    initialised: initialised,
    selfMint: token.selfMint,
    holdersCount: token.holdersCount,
    inscriptionNumber: token.inscriptionNumber,
    inscriptionId: token.inscriptionId,
    max: token.max,
    limit: token.limit,
    minted: token.minted,
    totalMinted: token.totalMinted,
    confirmedMinted: token.confirmedMinted,
    confirmedMinted1h: token.confirmedMinted1h,
    confirmedMinted24h: token.confirmedMinted24h,
    decimal: token.decimal,
    deployHeight: token.deployHeight,
    completeHeight: token.completeHeight,
    completeBlocktime: token.completeBlocktime,
    inscriptionNumberStart: token.inscriptionNumberStart,
    inscriptionNumberEnd: token.inscriptionNumberEnd,
    mintedOut: max.compareTo(minted) >= 0,
    mintable: !token.selfMint,
    deployTimestamp: new Date(token.deployBlocktime * 1000),
    percentageMinted: parseFloat(percentageMinted.getValue()),
    currentMintCount: token.mintTimes
  } satisfies Omit<BrcToken, 'ticker'>
}
