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
