import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Delete } from 'lucide-react'
import { BrandMark } from './BrandMark'
import {
  clearAttempts,
  getBiometricLabel,
  getLockoutRemaining,
  isBiometricSupported,
  loadSecurity,
  recordFailedAttempt,
  triggerBiometric,
  verifyPin,
} from '../security/pin'

interface LockScreenProps {
  onUnlock: () => void
}

/**
 * Full-screen PIN lock. Biometrics require a user tap on iOS Safari / PWA
 * (Face ID / Touch ID will not fire from a passive mount effect).
 */
export function LockScreen({ onUnlock }: LockScreenProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lockoutMs, setLockoutMs] = useState(getLockoutRemaining())
  const [bioBusy, setBioBusy] = useState(false)
  const [bioHint, setBioHint] = useState<string | null>(null)
  const security = loadSecurity()
  const bioLabel = getBiometricLabel()
  const showBiometrics =
    security.biometricEnabled && isBiometricSupported()

  useEffect(() => {
    if (lockoutMs <= 0) return
    const t = window.setInterval(() => setLockoutMs(getLockoutRemaining()), 250)
    return () => window.clearInterval(t)
  }, [lockoutMs])

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
    setBioHint(null)
    setDigits((prev) => (prev.length >= 4 ? prev : prev + d))
  }

  const onBiometric = async () => {
    if (lockoutMs > 0 || bioBusy) return
    setBioBusy(true)
    setError(null)
    setBioHint(null)
    try {
      const ok = await triggerBiometric()
      if (ok) {
        clearAttempts()
        onUnlock()
        return
      }
      setBioHint(`${bioLabel} cancelled or unavailable — use your PIN.`)
    } finally {
      setBioBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] bg-bg flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-bg-elevated/80 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <BrandMark size="lg" className="mb-6" />
        <p id="lock-title" className="wordmark text-2xl mb-2 text-text">
          M<span className="text-[0.85em] font-semibold tracking-normal">y</span>DSP
        </p>
        <p className="text-sm text-text-subtle mb-8 font-light text-center">
          Enter your 4-digit PIN to unlock
        </p>

        <div className="flex gap-3 mb-6" aria-label={`PIN entered ${digits.length} of 4 digits`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`w-3.5 h-3.5 border transition-colors ${
                digits.length > i
                  ? 'bg-accent border-accent'
                  : 'bg-transparent border-border-strong'
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="min-h-[2.5rem] mb-4 text-center px-2" aria-live="polite">
          {error ? <p className="text-sm text-accent font-medium">{error}</p> : null}
          {lockoutMs > 0 ? (
            <p className="text-sm text-text-muted">Retry in {Math.ceil(lockoutMs / 1000)}s</p>
          ) : null}
          {!error && bioHint ? <p className="text-sm text-text-muted">{bioHint}</p> : null}
        </div>

        <div className="grid grid-cols-3 gap-3 w-full" role="group" aria-label="PIN keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
            key === '' ? (
              <span key="pad" />
            ) : (
              <button
                key={key}
                type="button"
                className="btn-ghost h-14 min-h-14 text-lg font-semibold tracking-tight"
                disabled={lockoutMs > 0}
                aria-label={key === '⌫' ? 'Delete last digit' : `Digit ${key}`}
                onClick={() => {
                  if (key === '⌫') {
                    setError(null)
                    setDigits((p) => p.slice(0, -1))
                  } else press(key)
                }}
              >
                {key === '⌫' ? <Delete size={20} strokeWidth={1.75} className="mx-auto" /> : key}
              </button>
            ),
          )}
        </div>

        {showBiometrics ? (
          <button
            type="button"
            className="btn-secondary mt-8 inline-flex items-center justify-center gap-2 min-h-12 w-full"
            disabled={lockoutMs > 0 || bioBusy}
            onClick={() => void onBiometric()}
          >
            <Fingerprint size={18} strokeWidth={1.75} />
            {bioBusy ? `Waiting for ${bioLabel}…` : `Unlock with ${bioLabel}`}
          </button>
        ) : null}

        <p className="mt-6 text-[11px] text-text-subtle text-center font-light max-w-xs leading-relaxed">
          Your data stays on this device. PIN and {bioLabel.toLowerCase()} never leave your
          iPhone or iPad.
        </p>
      </div>
    </div>
  )
}
