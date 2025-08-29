import { bigDecimal } from 'js-big-decimal'
import { BrcToken } from '../database/collections.js'
import { getAllBrcTokens } from './unisat/getAllBrcTokens.js'

const ZERO = new bigDecimal(0)
const HUNDRED = new bigDecimal(100)

export function mapBrcTokenToDbModel(
  token: Awaited<ReturnType<typeof getAllBrcTokens>>[number], { synced, initialised }: { synced: boolean, initialised: boolean }
) {
  const max = new bigDecimal(token.max)
  const minted = new bigDecimal(token.minted)
  const percentageMinted = max.compareTo(ZERO) === 0 ? HUNDRED : minted.divide(max).multiply(HUNDRED)
  return {
    synced,
    initialised,
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
    mintedOut: minted.compareTo(max) >= 0,
    mintable: !token.selfMint,
    deployTimestamp: new Date(token.deployBlocktime * 1000),
    percentageMinted: parseFloat(percentageMinted.getValue()),
    currentMintCount: token.mintTimes,
    tickerLength: Buffer.from(token.ticker, 'utf-8').length
  } satisfies Omit<BrcToken, 'ticker'>
}
