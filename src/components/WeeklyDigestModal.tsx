/** In-app Weekly Digest preview — Share / Copy / Download (fixes iOS download dead-end). */

import { useEffect, useMemo, useState } from 'react'
import { Modal } from './ui/Modal'
import {
  buildWeeklyDigestContent,
  canShareWeeklyDigest,
  copyWeeklyDigestHtml,
  downloadWeeklyDigest,
  shareWeeklyDigest,
  type WeeklyDigestInput,
} from '../domain/weeklyDigest'

type Props = {
  open: boolean
  input: WeeklyDigestInput | null
  onClose: () => void
  onFlash?: (msg: string) => void
}

export function WeeklyDigestModal({ open, input, onClose, onFlash }: Props) {
  const [busy, setBusy] = useState(false)
  const [highlightsText, setHighlightsText] = useState('')
  useEffect(() => {
    if (!input) return
    setHighlightsText((input.highlights ?? []).join('\n'))
  }, [input])
  const editedInput = useMemo<WeeklyDigestInput | null>(() => {
    if (!input) return null
    return {
      ...input,
      highlights: highlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }
  }, [input, highlightsText])
  const previewHtml = useMemo(
    () => (editedInput ? buildWeeklyDigestContent(editedInput) : ''),
    [editedInput],
  )

  if (!input || !editedInput) return null

  return (
    <Modal open={open} title="Weekly digest" onClose={onClose} size="sheet">
      <p className="text-sm text-text-muted font-light mb-3 leading-relaxed">
        Preview below. On iPhone/iPad use <span className="text-text font-medium">Share</span> to
        Mail / Files — avoids the Safari HTML download screen. Nothing is emailed automatically.
      </p>
      <div
        className="weekly-digest-preview surface-nested p-3 mb-4 max-h-[45vh] overflow-y-auto text-sm text-text prose-digest"
        // Safe: content is built from escaped portfolio numbers/strings in buildWeeklyDigestContent
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
      <label
        htmlFor="weekly-digest-highlights"
        className="block text-xs font-bold uppercase tracking-widest text-text-subtle mb-2"
      >
        Highlights to include
      </label>
      <textarea
        id="weekly-digest-highlights"
        className="weekly-digest-highlights-textarea w-full mb-4"
        rows={4}
        value={highlightsText}
        onChange={(e) => setHighlightsText(e.target.value)}
        placeholder="One highlight per line"
      />
      <div className="flex flex-wrap gap-2">
        {canShareWeeklyDigest() ? (
          <button
            type="button"
            className="btn-primary min-h-11"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                try {
                  const result = await shareWeeklyDigest(editedInput)
                  if (result === 'shared') onFlash?.('Digest shared.')
                  else if (result === 'downloaded') onFlash?.('Digest downloaded.')
                } finally {
                  setBusy(false)
                }
              })()
            }}
          >
          {busy ? 'Sharing…' : 'Share'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-secondary min-h-11"
          onClick={() => {
            void (async () => {
              const ok = await copyWeeklyDigestHtml(editedInput)
              onFlash?.(ok ? 'Digest HTML copied — paste into Mail.' : 'Copy failed — try Share or Download.')
            })()
          }}
        >
          Copy HTML
        </button>
        <button
          type="button"
          className="btn-ghost min-h-11"
          onClick={() => {
            downloadWeeklyDigest(editedInput)
            onFlash?.('Digest downloaded.')
          }}
        >
          Download
        </button>
        <button type="button" className="btn-ghost min-h-11" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
