import { BrcToken } from "../database/collections.js"
import { getBlockTimestamp } from "./rpc/getBlockTimestamp.js"
import { throttledPromiseAllSettled } from "./throttledPromise.js"
import { UnisatBrcToken } from "./unisat/getBrcByTicker.js"

export async function populateBrcTimestamp(fetchedTokens: UnisatBrcToken[], dbTokens: BrcToken[]): Promise<(UnisatBrcToken & { deployBlocktime: number })[]> {
  const tickerMap = new Map(dbTokens.map(token => [token.ticker, token]))

  const missingTimestamps = fetchedTokens.filter(token => token.deployBlocktime == null && tickerMap.get(token.ticker)?.initialised !== true)
  const blockHeights = Array.from(new Set(missingTimestamps.map(token => token.deployHeight)))
  const timestamps = new Map(await throttledPromiseAllSettled(blockHeights.map(height => async () => {
    return [height, (await getBlockTimestamp(height)).getTime() / 1000] as const
  })).then(results => results.filter(r => r.status === 'fulfilled').map(r => r.value)))

  return fetchedTokens.map(token => {
    if (token.deployBlocktime != null) {
      return token
    }
    const dbToken = tickerMap.get(token.ticker)
    if (dbToken?.initialised === true) {
      return { ...token, deployBlocktime: dbToken.deployTimestamp.getTime() / 1000 }
    }
    const timestamp = timestamps.get(token.deployHeight)
    return { ...token, deployBlocktime: timestamp }
  }).filter(token => token.deployBlocktime != null) as (UnisatBrcToken & { deployBlocktime: number })[]
}
