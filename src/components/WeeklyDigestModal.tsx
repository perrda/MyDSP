/** In-app period digest preview — Share / Copy HTML / Download / PDF (iOS Share-to-Mail/Files). */

import { useEffect, useMemo, useState } from 'react'
import { Modal } from './ui/Modal'
import {
  loadDigestHighlightEdits,
  saveDigestHighlightEdits,
} from '../domain/digestHighlightsPrefs'
import {
  BTC_ORANGE,
  DIGEST_PERIODS,
  type DigestPdfOrientation,
  type DigestPeriod,
  digestDeltaLabel,
  digestPeriodLabel,
} from '../domain/digestPeriod'
import { allocationDonutSvg, nwSparklineSvg } from '../domain/digestCharts'
import {
  buildDigestViewModel,
  canShareWeeklyDigest,
  copyWeeklyDigestHtml,
  downloadWeeklyDigest,
  downloadWeeklyDigestPdf,
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
  const [period, setPeriod] = useState<DigestPeriod>('weekly')
  const [pdfOrientation, setPdfOrientation] = useState<DigestPdfOrientation>('landscape')

  useEffect(() => {
    if (!open || !input) return
    setPeriod(input.period ?? 'weekly')
    const saved = loadDigestHighlightEdits()
    setHighlightsText(
      saved && saved.length > 0 ? saved.join('\n') : (input.highlights ?? []).join('\n'),
    )
  }, [open, input])

  const editedInput = useMemo<WeeklyDigestInput | null>(() => {
    if (!input) return null
    return {
      ...input,
      period,
      highlights: highlightsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }
  }, [input, highlightsText, period])

  const model = useMemo(
    () => (editedInput ? buildDigestViewModel(editedInput, period) : null),
    [editedInput, period],
  )

  if (!input || !editedInput || !model) return null

  const donut = allocationDonutSvg(model.slices, { size: 136 })
  const spark = nwSparklineSvg(model.series, {
    height: 96,
    up: model.deltaTone === 'missing' ? null : model.deltaTone !== 'down',
  })

  return (
    <Modal
      open={open}
      title={`${digestPeriodLabel(period)} digest`}
      onClose={onClose}
      size="wide"
      toolbar={
        <div className="digest-sticky-controls">
          <div className="digest-period-switch" role="tablist" aria-label="Digest period">
            {DIGEST_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                aria-pressed={period === p}
                className="digest-period-btn min-h-11"
                onClick={() => setPeriod(p)}
              >
                {digestPeriodLabel(p)}
              </button>
            ))}
          </div>
          <div className="digest-pdf-controls">
            <span className="digest-pdf-label">PDF A4</span>
            <div className="digest-orient-switch" role="group" aria-label="PDF page orientation">
              <button
                type="button"
                aria-pressed={pdfOrientation === 'landscape'}
                className="digest-period-btn min-h-11"
                onClick={() => setPdfOrientation('landscape')}
              >
                Landscape
              </button>
              <button
                type="button"
                aria-pressed={pdfOrientation === 'portrait'}
                className="digest-period-btn min-h-11"
                onClick={() => setPdfOrientation('portrait')}
              >
                Portrait
              </button>
            </div>
            <button
              type="button"
              className="btn-secondary min-h-11 digest-pdf-download"
              onClick={() => {
                downloadWeeklyDigestPdf(editedInput, pdfOrientation)
                onFlash?.(`Digest PDF (${pdfOrientation}) downloaded.`)
              }}
            >
              Download PDF
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm text-text-muted font-light mb-3 leading-relaxed">
        Preview below. On iPhone/iPad use <span className="text-text font-medium">Share</span> to
        Mail / Files — avoids the Safari HTML download screen. Nothing is emailed automatically.
      </p>

      <div className="weekly-digest-preview digest-visual-preview surface-nested p-3 mb-4 text-sm text-text">
        <p className="digest-window-copy">{model.windowCopy}</p>
        <div className="digest-kpi-grid">
          <div className="digest-kpi">
            <span className="digest-kpi__label">Net worth</span>
            <strong className="digest-kpi__value">{model.netWorthLabel}</strong>
          </div>
          <div className={`digest-kpi digest-kpi--${model.deltaTone}`}>
            <span className="digest-kpi__label">{digestDeltaLabel(period)}</span>
            <strong className="digest-kpi__value">{model.deltaValue}</strong>
          </div>
          <div className="digest-kpi">
            <span className="digest-kpi__label">Assets</span>
            <strong className="digest-kpi__value">{model.assetsLabel}</strong>
          </div>
          <div className="digest-kpi">
            <span className="digest-kpi__label">Liabilities</span>
            <strong className="digest-kpi__value">{model.liabilitiesLabel}</strong>
          </div>
        </div>
        <div className="digest-chart-grid">
          <figure className="digest-chart-card">
            <figcaption>Allocation</figcaption>
            <div
              className="digest-donut"
              // Safe: SVG built from numeric sleeves in allocationDonutSvg
              dangerouslySetInnerHTML={{ __html: donut }}
            />
            <ul className="digest-legend">
              {model.slices.length ? (
                model.slices.map((s) => (
                  <li key={s.name}>
                    <i style={{ background: s.color || BTC_ORANGE }} />
                    <span>
                      {s.name} {s.shareLabel}
                    </span>
                  </li>
                ))
              ) : (
                <li>Allocation —</li>
              )}
            </ul>
          </figure>
          <figure className="digest-chart-card">
            <figcaption>Net worth</figcaption>
            <div
              className="digest-spark"
              dangerouslySetInnerHTML={{ __html: spark }}
            />
            {model.seriesEmpty ? (
              <p className="digest-empty-series">No net-worth history in this window — Unpriced.</p>
            ) : null}
          </figure>
        </div>
        {model.portfolios.length ? (
          <ul className="digest-portfolios">
            {model.portfolios.map((p) => (
              <li key={p.name}>
                <span>{p.name}</span>
                <strong>{p.valueLabel}</strong>
              </li>
            ))}
          </ul>
        ) : null}
        {model.highlights.length ? (
          <ul className="digest-highlight-list">
            {model.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : (
          <p className="digest-empty-series">No highlights for this window.</p>
        )}
        <p className="digest-footer-note">{model.footer}</p>
      </div>

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
        onChange={(e) => {
          const next = e.target.value
          setHighlightsText(next)
          saveDigestHighlightEdits(
            next
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }}
        placeholder="One highlight per line"
      />
      <div className="digest-action-row flex flex-wrap gap-2">
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
