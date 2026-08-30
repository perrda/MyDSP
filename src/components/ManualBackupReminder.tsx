import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from './ui/Modal'
import { createFullBackup } from '../storage/backupStore'
import {
  dueManualBackupPrompt,
  snoozeManualBackupPrompt,
} from '../storage/manualBackupReminder'
import { triggerSuccessFlash } from '../utils/successFlash'

/**
 * Hourly Yes/No popup to take a manual full backup on this device.
 * Snooze and last-manual timestamps stay device-local.
 */
export function ManualBackupReminder() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const check = useCallback(() => {
    if (busy) return
    setOpen(dueManualBackupPrompt())
  }, [busy])

  useEffect(() => {
    check()
    const id = window.setInterval(check, 30_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [check])

  return (
    <ConfirmDialog
      open={open}
      title="Create Manual Backup now?"
      body="Save a full snapshot on this device so recent changes are not lost. Yes takes a backup now. No asks again in one hour."
      confirmLabel="Yes"
      cancelLabel="No"
      variant="default"
      onConfirm={() => {
        void (async () => {
          setBusy(true)
          try {
            await createFullBackup('manual', 'Hourly reminder')
            snoozeManualBackupPrompt()
            triggerSuccessFlash()
          } catch {
            snoozeManualBackupPrompt()
          } finally {
            setBusy(false)
            setOpen(false)
          }
        })()
      }}
      onClose={() => {
        snoozeManualBackupPrompt()
        setOpen(false)
      }}
    />
  )
}
