/** Designed A4 one-pager PDF for the digest — not a print of the modal chrome. */

import {
  BTC_ORANGE,
  type DigestPdfOrientation,
  type DigestPeriod,
  type DigestViewModel,
  digestPdfFilename,
} from './digestPeriod'

const A4_PORTRAIT = { w: 595.28, h: 841.89 }
const A4_LANDSCAPE = { w: 841.89, h: 595.28 }

function winAnsi(s: string): string {
  const out: string[] = []
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 32
    if (ch === '£') {
      out.push(String.fromCharCode(0xa3))
      continue
    }
    const mapped: Record<string, number> = {
      '–': 0x96,
      '—': 0x97,
      '•': 0x95,
      '‘': 0x91,
      '’': 0x92,
      '“': 0x93,
      '”': 0x94,
      '…': 0x85,
      '−': 0x2d,
      'Δ': 0x44,
      '₿': 0x42,
      '·': 0xb7,
    }
    if (mapped[ch] != null) {
      out.push(String.fromCharCode(mapped[ch]!))
      continue
    }
    if (code === 0x2022) {
      out.push(String.fromCharCode(0x95))
      continue
    }
    if (code < 128 || (code >= 160 && code <= 255)) {
      out.push(ch)
      continue
    }
    out.push('?')
  }
  return out.join('')
}

function pdfString(s: string): string {
  return `(${winAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`
}

function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

class PdfPage {
  readonly ops: string[] = []

  fillRect(x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
    this.ops.push(
      `${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    )
  }

  strokeRect(
    x: number,
    y: number,
    w: number,
    h: number,
    rgb: [number, number, number],
    width = 1,
  ) {
    this.ops.push(
      `${width} w ${rgb[0]} ${rgb[1]} ${rgb[2]} RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`,
    )
  }

  text(
    x: number,
    y: number,
    size: number,
    body: string,
    rgb: [number, number, number] = [0.07, 0.07, 0.07],
    bold = false,
  ) {
    const font = bold ? 'F2' : 'F1'
    this.ops.push(
      `BT /${font} ${size} Tf ${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(body)} Tj ET`,
    )
  }

  polyline(
    points: Array<[number, number]>,
    rgb: [number, number, number],
    width = 1.6,
    fill?: [number, number, number],
  ) {
    if (points.length < 2) return
    const [x0, y0] = points[0]!
    const move = `${x0.toFixed(2)} ${y0.toFixed(2)} m`
    const rest = points
      .slice(1)
      .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)} l`)
      .join(' ')
    if (fill) {
      this.ops.push(`${fill[0]} ${fill[1]} ${fill[2]} rg ${move} ${rest} f`)
    }
    this.ops.push(`${width} w ${rgb[0]} ${rgb[1]} ${rgb[2]} RG ${move} ${rest} S`)
  }

  donut(
    cx: number,
    cy: number,
    rOut: number,
    rIn: number,
    slices: Array<{ sweep: number; rgb: [number, number, number] }>,
  ) {
    let angle = Math.PI / 2
    const step = Math.PI / 36
    for (const slice of slices) {
      const start = angle
      const end = angle - slice.sweep
      const outer: Array<[number, number]> = []
      const inner: Array<[number, number]> = []
      for (let a = start; a >= end - 1e-9; a -= step) {
        const t = Math.max(a, end)
        outer.push([cx + rOut * Math.cos(t), cy + rOut * Math.sin(t)])
        inner.push([cx + rIn * Math.cos(t), cy + rIn * Math.sin(t)])
      }
      const path = [...outer, ...inner.reverse()]
      if (path.length >= 3) {
        const [x0, y0] = path[0]!
        const rest = path
          .slice(1)
          .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)} l`)
          .join(' ')
        this.ops.push(
          `${slice.rgb[0]} ${slice.rgb[1]} ${slice.rgb[2]} rg ${x0.toFixed(2)} ${y0.toFixed(2)} m ${rest} h f`,
        )
      }
      angle = end
    }
  }
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

const ORANGE = hexRgb(BTC_ORANGE)
const INK: [number, number, number] = [0.08, 0.08, 0.08]
const MUTED: [number, number, number] = [0.4, 0.4, 0.4]
const LINE: [number, number, number] = [0.88, 0.88, 0.88]
const PAPER: [number, number, number] = [1, 1, 1]
const CHIP: [number, number, number] = [0.98, 0.96, 0.93]
const RED = hexRgb('#ef4444')

function drawKpi(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  tone: 'up' | 'down' | 'flat' | 'missing',
) {
  page.fillRect(x, y, w, h, CHIP)
  page.strokeRect(x, y, w, h, ORANGE, 1.2)
  page.text(x + 8, y + h - 16, 8, label.toUpperCase(), ORANGE, true)
  const valueRgb = tone === 'down' ? RED : tone === 'up' ? ORANGE : INK
  page.text(x + 8, y + 12, 13, value, valueRgb, true)
}

function drawSpark(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  h: number,
  series: DigestViewModel['series'],
  tone: DigestViewModel['deltaTone'],
) {
  page.strokeRect(x, y, w, h, LINE, 0.8)
  if (series.length < 2) {
    page.text(x + w / 2 - 4, y + h / 2, 12, '—', MUTED)
    return
  }
  const values = series.map((p) => p.netWorth)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1
    min -= pad
    max += pad
  }
  const pts: Array<[number, number]> = series.map((p, i) => {
    const px = x + 6 + (i / (series.length - 1)) * (w - 12)
    const py = y + 6 + (1 - (p.netWorth - min) / (max - min)) * (h - 12)
    return [px, py]
  })
  const rgb = tone === 'down' ? RED : ORANGE
  const wash: [number, number, number] = tone === 'down' ? [1, 0.92, 0.92] : [1, 0.94, 0.86]
  const area: Array<[number, number]> = [
    [pts[0]![0], y + 2],
    ...pts,
    [pts[pts.length - 1]![0], y + 2],
  ]
  page.polyline(area, wash, 0.1, wash)
  page.polyline(pts, rgb, 1.8)
}

function assemblePdf(pageW: number, pageH: number, content: string): Uint8Array {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${latin1(content).length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]

  const chunks: Uint8Array[] = [latin1('%PDF-1.4\n')]
  const offsets = [0]
  let pos = chunks[0]!.length
  objects.forEach((body, i) => {
    const obj = `${i + 1} 0 obj\n${body}\nendobj\n`
    const bytes = latin1(obj)
    offsets.push(pos)
    chunks.push(bytes)
    pos += bytes.length
  })
  const xrefStart = pos
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  chunks.push(latin1(xref))
  return concatBytes(chunks)
}

export function buildDigestPdfBytes(
  model: DigestViewModel,
  orientation: DigestPdfOrientation = 'landscape',
): Uint8Array {
  const { w, h } = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT
  const page = new PdfPage()
  page.fillRect(0, 0, w, h, PAPER)
  page.fillRect(0, h - 36, w, 36, ORANGE)
  page.text(28, h - 23, 16, model.title, [1, 1, 1], true)
  page.text(w - 200, h - 20, 9, model.generatedLabel, [1, 1, 1])

  page.text(28, h - 54, 9, model.windowCopy, MUTED)

  const kpiY = h - 128
  const kpiH = 48
  const gap = 10
  const kpiW = (w - 56 - gap * 3) / 4
  const kpis = [
    { label: 'Net worth', value: model.netWorthLabel, tone: 'flat' as const },
    { label: model.deltaLabel, value: model.deltaValue, tone: model.deltaTone },
    { label: 'Assets', value: model.assetsLabel, tone: 'flat' as const },
    { label: 'Liabilities', value: model.liabilitiesLabel, tone: 'flat' as const },
  ]
  kpis.forEach((k, i) => {
    drawKpi(page, 28 + i * (kpiW + gap), kpiY, kpiW, kpiH, k.label, k.value, k.tone)
  })

  const chartTop = kpiY - 18
  const chartH = orientation === 'landscape' ? 210 : 200
  const donutSize = orientation === 'landscape' ? 190 : 168
  const donutX = 28
  const donutY = chartTop - donutSize
  page.text(donutX, chartTop, 9, 'ALLOCATION', ORANGE, true)
  const usable = model.slices.filter((s) => s.value > 0)
  const total = usable.reduce((s, r) => s + r.value, 0)
  if (total > 0 && usable.length) {
    page.donut(
      donutX + donutSize / 2,
      donutY + donutSize / 2 - 8,
      donutSize * 0.36,
      donutSize * 0.22,
      usable.map((s) => ({
        sweep: (s.value / total) * Math.PI * 2,
        rgb: hexRgb(s.color),
      })),
    )
    usable.forEach((s, i) => {
      const ly = donutY + 28 - i * 16
      page.fillRect(donutX + donutSize - 4, ly, 7, 7, hexRgb(s.color))
      page.text(donutX + donutSize + 8, ly, 9, `${s.name}  ${s.shareLabel}`, INK)
    })
  } else {
    page.text(donutX + 40, donutY + donutSize / 2, 12, '—', MUTED)
  }

  const sparkX = orientation === 'landscape' ? 280 : 28
  const sparkW = orientation === 'landscape' ? w - sparkX - 28 : w - 56
  const sparkY = orientation === 'landscape' ? donutY + 24 : donutY - chartH - 8
  const sparkH = orientation === 'landscape' ? donutSize - 48 : 150
  page.text(sparkX, sparkY + sparkH + 14, 9, 'NET WORTH', ORANGE, true)
  drawSpark(page, sparkX, sparkY, sparkW, sparkH, model.series, model.deltaTone)
  if (model.seriesEmpty) {
    page.text(sparkX + 8, sparkY + 14, 8, 'No history in this window', MUTED)
  }

  let listY = orientation === 'landscape' ? sparkY - 20 : sparkY - 22
  page.text(28, listY, 9, 'HIGHLIGHTS', ORANGE, true)
  listY -= 16
  const lines = model.highlights.length ? model.highlights : ['No highlights for this window']
  for (const line of lines.slice(0, orientation === 'landscape' ? 6 : 10)) {
    page.text(28, listY, 10, `• ${line}`, INK)
    listY -= 14
  }

  if (model.portfolios.length) {
    listY -= 8
    page.text(28, listY, 9, 'PORTFOLIOS', ORANGE, true)
    listY -= 14
    for (const p of model.portfolios.slice(0, 4)) {
      page.text(28, listY, 10, `${p.name}  ${p.valueLabel}`, INK)
      listY -= 13
    }
  }

  page.text(28, 22, 8, model.footer, MUTED)
  page.fillRect(0, 0, w, 8, ORANGE)

  return assemblePdf(w, h, page.ops.join('\n'))
}

export function downloadBinaryPdf(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadDigestPdf(
  model: DigestViewModel,
  orientation: DigestPdfOrientation,
  period: DigestPeriod,
  generatedAt: Date,
): void {
  downloadBinaryPdf(buildDigestPdfBytes(model, orientation), digestPdfFilename(period, orientation, generatedAt))
}
