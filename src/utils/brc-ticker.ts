import { BrcType } from "./constants.js"

export function normaliseTicker(ticker: string) {
  if (tickerLength(ticker) === 6) {
    return ticker.toLowerCase()
  }
  return ticker
}

export function tickerLength(ticker: string) {
  return Buffer.from(ticker, 'utf-8').length
}

export function brcType(ticker: string) {
  return tickerLength(ticker) === 6 ? BrcType.SixByte : BrcType.Default
}

// Unisat API has issues with standard URL encoding (e.g. fails with %2F for '/')
// However, the standard API accepts hex-encoded tickers, so we use that instead to allow for tickers with special characters.
// For 6 byte tickers, the API doesn't support this, but six byte tickers are always alphabetic, so we can just use them as is.
// This is how the Unisat front end handles tickers in API requests.
export function tickerToPathQuery(ticker: string) {
  const bytes = Buffer.from(ticker, 'utf-8')
  if (bytes.length === 6)
    return ticker.toLowerCase()
  return bytes.toString('hex')
}
