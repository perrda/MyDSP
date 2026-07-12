import { useCallback, useEffect, useState } from 'react'
import { BrandMark } from './BrandMark'
import {
  clearAttempts,
  getLockoutRemaining,
  loadSecurity,
  recordFailedAttempt,
  triggerBiometric,
  verifyPin,
} from '../security/pin'

interface LockScreenProps {
  onUnlock: () => void
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lockoutMs, setLockoutMs] = useState(getLockoutRemaining())
  const security = loadSecurity()

  useEffect(() => {
    if (lockoutMs <= 0) return
    const t = window.setInterval(() => setLockoutMs(getLockoutRemaining()), 250)
    return () => window.clearInterval(t)
  }, [lockoutMs])

  useEffect(() => {
    if (!security.biometricEnabled) return
    void (async () => {
      const ok = await triggerBiometric()
      if (ok) {
        clearAttempts()
        onUnlock()
      }
    })()
  }, [security.biometricEnabled, onUnlock])

  const tryUnlock = useCallback(
    async (pin: string) => {
      if (getLockoutRemaining() > 0) {
        setLockoutMs(getLockoutRemaining())
        setError('Too many attempts — wait and retry.')
        return
      }
      const ok = await verifyPin(pin, security.pinHash)
      if (ok) {
        clearAttempts()
        setDigits('')
        setError(null)
        onUnlock()
        return
      }
      const fail = recordFailedAttempt()
      setDigits('')
      if (fail.locked) {
        setLockoutMs(fail.remainingMs)
        setError('Locked out for 30 seconds.')
      } else {
        setError('Incorrect PIN')
      }
    },
    [onUnlock, security.pinHash],
  )

  useEffect(() => {
    if (digits.length === 4) void tryUnlock(digits)
  }, [digits, tryUnlock])

  const press = (d: string) => {
    if (lockoutMs > 0) return
    setError(null)
    setDigits((prev) => (prev.length >= 4 ? prev : prev + d))
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-bg flex flex-col items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
    >
      <BrandMark size="lg" className="mb-6" />
      <p id="lock-title" className="wordmark text-2xl mb-2">
        M<span className="text-[0.85em] font-semibold tracking-normal">y</span>DSP
      </p>
      <p className="text-sm text-text-subtle mb-8 font-light">Enter PIN to unlock</p>

      <div className="flex gap-3 mb-6" aria-label={`PIN entered ${digits.length} of 4 digits`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3 h-3 border border-border-strong ${
              digits.length > i ? 'bg-accent border-accent' : 'bg-transparent'
            }`}
            aria-hidden
          />
        ))}
      </div>

      <div className="min-h-[1.5rem] mb-4" aria-live="polite">
        {error && <p className="text-sm text-accent">{error}</p>}
        {lockoutMs > 0 && (
          <p className="text-sm text-text-muted">Retry in {Math.ceil(lockoutMs / 1000)}s</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs" role="group" aria-label="PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
          key === '' ? (
            <span key="pad" />
          ) : (
            <button
              key={key}
              type="button"
              className="btn-ghost h-14 text-lg font-semibold"
              disabled={lockoutMs > 0}
              aria-label={key === '⌫' ? 'Delete last digit' : `Digit ${key}`}
              onClick={() => {
                if (key === '⌫') setDigits((p) => p.slice(0, -1))
                else press(key)
              }}
            >
              {key}
            </button>
          ),
        )}
      </div>

      {security.biometricEnabled && (
        <button
          type="button"
          className="btn-ghost btn-sm mt-8"
          onClick={() => void triggerBiometric().then((ok) => ok && onUnlock())}
        >
          Use biometrics
        </button>
      )}
    </div>
  )
}
