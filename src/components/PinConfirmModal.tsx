/** Modal PIN keypad for confirming sensitive Settings actions (disable PIN, etc.). */

import { useCallback, useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import { Modal } from './ui/Modal'
import {
  clearAttempts,
  getLockoutRemaining,
  recordFailedAttempt,
  verifyPin,
} from '../security/pin'

interface PinConfirmModalProps {
  open: boolean
  title?: string
  subtitle?: string
  pinHash: string
  onClose: () => void
  onVerified: () => void
}

export function PinConfirmModal({
  open,
  title = 'Confirm with PIN',
  subtitle = 'Enter your 4-digit PIN',
  pinHash,
  onClose,
  onVerified,
}: PinConfirmModalProps) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lockoutMs, setLockoutMs] = useState(getLockoutRemaining())

  useEffect(() => {
    if (!open) {
      setDigits('')
      setError(null)
      return
    }
    setLockoutMs(getLockoutRemaining())
  }, [open])

  useEffect(() => {
    if (!open || lockoutMs <= 0) return
    const t = window.setInterval(() => setLockoutMs(getLockoutRemaining()), 250)
    return () => window.clearInterval(t)
  }, [open, lockoutMs])

  const tryUnlock = useCallback(
    async (pin: string) => {
      if (getLockoutRemaining() > 0) {
        setLockoutMs(getLockoutRemaining())
        setError('Too many attempts — wait and retry.')
        return
      }
      const ok = await verifyPin(pin, pinHash)
      if (ok) {
        clearAttempts()
        setDigits('')
        setError(null)
        onVerified()
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
    [onVerified, pinHash],
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
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-text-muted font-light mb-4 text-center">{subtitle}</p>
      <div className="flex gap-3 mb-4 justify-center" aria-label={`PIN entered ${digits.length} of 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 border ${
              digits.length > i ? 'bg-accent border-accent' : 'border-border-strong'
            }`}
            aria-hidden
          />
        ))}
      </div>
      <div className="min-h-[1.75rem] mb-3 text-center" aria-live="polite">
        {error ? <p className="text-sm text-accent font-medium">{error}</p> : null}
        {lockoutMs > 0 ? (
          <p className="text-sm text-text-muted">Retry in {Math.ceil(lockoutMs / 1000)}s</p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto" role="group" aria-label="PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
          key === '' ? (
            <span key="pad" />
          ) : (
            <button
              key={key}
              type="button"
              className="btn-ghost h-12 min-h-12 text-lg font-semibold"
              disabled={lockoutMs > 0}
              aria-label={key === '⌫' ? 'Delete last digit' : `Digit ${key}`}
              onClick={() => {
                if (key === '⌫') {
                  setError(null)
                  setDigits((p) => p.slice(0, -1))
                } else press(key)
              }}
            >
              {key === '⌫' ? <Delete size={18} strokeWidth={1.75} className="mx-auto" /> : key}
            </button>
          ),
        )}
      </div>
    </Modal>
  )
}
