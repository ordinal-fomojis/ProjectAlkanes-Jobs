import { bigDecimal } from 'js-big-decimal'
import { AlkaneToken } from '../database/collections.js'
import { UnisatAlkaneToken } from './unisat/getAlkaneById.js'

const ZERO = new bigDecimal(0)
const HUNDRED = new bigDecimal(100)

export function mapAlkaneTokenToDbModel(
  token: UnisatAlkaneToken, { synced, initialised }: { synced: boolean, initialised: boolean }
) {
  const preminedSupply = toAlkaneValue(token.tokenData.premine, token)
  const amountPerMint = toAlkaneValue(token.tokenData.perMint, token)
  const maxSupply = toAlkaneValue(token.tokenData.maxSupply, token)

  const mintCountCap = (amountPerMint.compareTo(ZERO) === 0
    ? new bigDecimal(token.tokenData.cap)
    : (maxSupply.subtract(preminedSupply)).divide(amountPerMint)).round()

  const percentageMinted = mintCountCap.compareTo(ZERO) === 0 ? HUNDRED
    : new bigDecimal(token.tokenData.minted).multiply(HUNDRED).divide(mintCountCap)
  const preminedPercentage = maxSupply.compareTo(ZERO) === 0 ? new bigDecimal(0)
    : preminedSupply.multiply(HUNDRED).divide(maxSupply)
  const hasPremine = preminedSupply.compareTo(ZERO) > 0
  
  const mintCountCapStr = mintCountCap.stripTrailingZero().getValue()

  return {
    synced,
    initialised,
    name: token.tokenData.name,
    symbol: token.tokenData.symbol,
    logoUrl: token.logo,
    preminedSupply: preminedSupply.stripTrailingZero().getValue(),
    amountPerMint: amountPerMint.stripTrailingZero().getValue(),
    maxSupply: maxSupply.stripTrailingZero().getValue(),
    currentSupply: toAlkaneValue(token.tokenData.totalSupply, token).stripTrailingZero().getValue(),
    mintCountCap: mintCountCapStr,
    approximateMintCountCap: parseInt(mintCountCapStr, 10),
    currentMintCount: token.tokenData.minted,
    mintedOut: (BigInt(token.tokenData.minted) >= BigInt(mintCountCapStr)),
    deployTxid: token.txid,
    deployTimestamp: new Date(token.timestamp * 1000),
    percentageMinted: parseFloat(percentageMinted.getValue()),
    preminedPercentage: parseFloat(preminedPercentage.getValue()),
    // Unisat returns mintable as false for '2:0' (DIESEL) even though it is mintable
    mintable: token.alkaneid === '2:0' || token.tokenData.mintable,
    holdersCount: token.tokenData.holders,
    hasPremine
  } satisfies Omit<AlkaneToken, 'alkaneId' | 'pendingMints'>
}

function toAlkaneValue(val: string | number, token: UnisatAlkaneToken) {
  const divisor = new bigDecimal(10n ** BigInt(token.tokenData.divisibility))
  return new bigDecimal(val).divide(divisor, token.tokenData.divisibility)
}
