/**
 * Share Remote URL only for multi-device setup — never include the passphrase.
 */

export function buildSyncSetupText(remoteUrl: string): string {
  const url = remoteUrl.trim()
  return [
    'MyDSP sync setup URL',
    '(Remote URL only — enter your passphrase separately on each device)',
    '',
    url || '(no Remote URL set)',
    '',
    'Paste into Settings → Sync → Remote URL, then enter the same passphrase.',
  ].join('\n')
}

export async function copySyncSetupUrl(remoteUrl: string): Promise<boolean> {
  const url = remoteUrl.trim()
  if (!url) return false
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}

export function downloadSyncSetupUrl(remoteUrl: string): void {
  const text = buildSyncSetupText(remoteUrl)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'mydsp-sync-setup-url.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Draw a simple “Scan/setup URL” card on a canvas (URL as text — no QR deps).
 * Returns false when URL is empty or canvas unavailable.
 */
export function drawSyncSetupCard(
  canvas: HTMLCanvasElement,
  remoteUrl: string,
): boolean {
  const url = remoteUrl.trim()
  if (!url) return false
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const w = 360
  const h = 220
  canvas.width = w
  canvas.height = h

  ctx.fillStyle = '#0f1419'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#e85d04'
  ctx.lineWidth = 2
  ctx.strokeRect(8, 8, w - 16, h - 16)

  ctx.fillStyle = '#e85d04'
  ctx.font = 'bold 11px ui-monospace, monospace'
  ctx.fillText('MyDSP · SCAN / SETUP URL', 24, 36)

  ctx.fillStyle = '#e8eaed'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.fillText('Remote URL only', 24, 62)

  ctx.fillStyle = '#9aa0a6'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText('Never shares your passphrase', 24, 82)

  ctx.fillStyle = '#e8eaed'
  ctx.font = '12px ui-monospace, monospace'
  const maxWidth = w - 48
  const words = url.split('')
  let line = ''
  let y = 110
  for (const ch of words) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, 24, y)
      line = ch
      y += 18
      if (y > h - 36) break
    } else {
      line = test
    }
  }
  if (line && y <= h - 28) ctx.fillText(line, 24, y)

  return true
}
