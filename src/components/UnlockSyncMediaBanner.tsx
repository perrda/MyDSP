/** Unlock cloud sync on media pages so YouTube / News extras pull from Mini. */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field } from './ui/Modal'
import { runOneButtonSync } from '../services/sync/oneButtonSync'

export function UnlockSyncMediaBanner({
  testId,
  title,
  body,
  onUnlocked,
}: {
  testId: string
  title: string
  body: string
  onUnlocked?: () => void
}) {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = async () => {
    const passphrase = pass.trim()
    if (passphrase.length < 8) {
      setError('Use the same passphrase as Mini (at least 8 characters).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await runOneButtonSync(passphrase)
      setPass('')
      onUnlocked?.()
      window.dispatchEvent(new CustomEvent('mydsp-youtube-changed'))
      window.dispatchEvent(new CustomEvent('mydsp-news-changed'))
      window.dispatchEvent(new CustomEvent('mydsp-markets-changed'))
      if (result.message) {
        /* parent toast / status already updates via auto-sync */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed — check the passphrase.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="youtube-unlock-sync-banner mb-4 px-3 py-2.5 text-sm border border-amber-500/45 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-lg md:rounded-none"
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-xs mt-0.5 opacity-90">{body}</p>
      <form
        className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end max-w-xl"
        onSubmit={(e) => {
          e.preventDefault()
          void unlock()
        }}
      >
        <div className="min-w-0 flex-1">
          <Field label="Sync passphrase" error={error ?? undefined}>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full min-w-0 bg-surface-hover border border-border rounded text-sm px-3 py-2 text-text"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Same passphrase as Mini"
              disabled={busy}
            />
          </Field>
        </div>
        <button
          type="submit"
          className="btn-primary btn-sm min-h-11 shrink-0"
          disabled={busy}
          data-testid={`${testId}-submit`}
        >
          {busy ? 'Pulling…' : 'Unlock & pull'}
        </button>
      </form>
      <Link to="/settings#sync" className="btn-ghost btn-sm mt-2 inline-flex min-h-11">
        Or open Settings → Sync
      </Link>
    </div>
  )
}
