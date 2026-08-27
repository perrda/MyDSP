/** Honest Today Markets copy — watchlist and movers must match Markets. */

export function todayMoversEmptyCopy(watchedCount: number): string {
  if (watchedCount > 0) {
    return `${watchedCount} ticker${watchedCount === 1 ? '' : 's'} watched — no 24h movers.`
  }
  return 'No tickers on the Markets watchlist yet.'
}

export function todayWatchlistQuietCopy(watchedCount: number): string {
  return todayMoversEmptyCopy(watchedCount)
}
