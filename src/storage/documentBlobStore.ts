/** IndexedDB blob store for document attachments. */

const DB_NAME = 'mydsp_document_blobs'
const STORE = 'blobs'
const DB_VERSION = 1

/** Soft limits for sync/backup payload size */
export const MAX_BLOB_BYTES = 2 * 1024 * 1024
export const MAX_TOTAL_BLOB_BYTES = 20 * 1024 * 1024

export interface DocumentBlobPayload {
  id: number
  mimeType: string
  fileName?: string
  base64: string
  size: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function putDocumentBlob(docId: number, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, docId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Blob put failed'))
  })
  db.close()
}

export async function getDocumentBlob(docId: number): Promise<Blob | null> {
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(docId)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Blob get failed'))
  })
  db.close()
  return blob
}

export async function deleteDocumentBlob(docId: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(docId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Blob delete failed'))
  })
  db.close()
}

export async function listDocumentBlobIds(): Promise<number[]> {
  const db = await openDb()
  const ids = await new Promise<number[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => Number(k)).filter(Number.isFinite))
    req.onerror = () => reject(req.error ?? new Error('Blob keys failed'))
  })
  db.close()
  return ids
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

/** Export blobs for sync/backup. Skips oversized files. */
export async function exportDocumentBlobs(
  ids: Iterable<number>,
): Promise<{ payloads: DocumentBlobPayload[]; skipped: number[]; totalBytes: number }> {
  const payloads: DocumentBlobPayload[] = []
  const skipped: number[] = []
  let totalBytes = 0

  for (const id of new Set([...ids].filter((n) => Number.isFinite(n) && n > 0))) {
    const blob = await getDocumentBlob(id)
    if (!blob) {
      skipped.push(id)
      continue
    }
    if (blob.size > MAX_BLOB_BYTES || totalBytes + blob.size > MAX_TOTAL_BLOB_BYTES) {
      skipped.push(id)
      continue
    }
    const base64 = await blobToBase64(blob)
    payloads.push({
      id,
      mimeType: blob.type || 'application/octet-stream',
      size: blob.size,
      base64,
    })
    totalBytes += blob.size
  }

  return { payloads, skipped, totalBytes }
}

export async function importDocumentBlobs(payloads: DocumentBlobPayload[]): Promise<number> {
  let n = 0
  for (const p of payloads) {
    if (!p?.id || !p.base64) continue
    const blob = base64ToBlob(p.base64, p.mimeType || 'application/octet-stream')
    await putDocumentBlob(p.id, blob)
    n++
  }
  return n
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
