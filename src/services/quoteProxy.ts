/** Shared MyDSP quote / feed Worker base URL. */

export function quoteProxyBaseUrl(): string {
  try {
    const envUrl =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      typeof import.meta.env.VITE_QUOTE_PROXY_URL === 'string'
        ? import.meta.env.VITE_QUOTE_PROXY_URL.trim()
        : ''
    if (envUrl) return envUrl.replace(/\/$/, '')
  } catch {
    /* ignore */
  }
  return 'https://mydsp-quote.dave-perry.workers.dev'
}

/** Wrap a remote HTTPS URL through the dedicated quote/feed Worker. */
export function quoteProxyUrl(target: string): string {
  return `${quoteProxyBaseUrl()}/quote?url=${encodeURIComponent(target)}`
}
