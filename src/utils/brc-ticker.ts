export function normaliseTicker(ticker: string) {
  if (tickerLength(ticker) === 6) {
    return ticker.toLowerCase()
  }
  return ticker
}

export function tickerLength(ticker: string) {
  return Buffer.from(ticker, 'utf-8').length
}
