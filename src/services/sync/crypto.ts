/** AES-GCM + PBKDF2 encryption for sync bundles. */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

/** Copy into a real ArrayBuffer view — Node/jsdom `Uint8Array.buffer` is not always BufferSource. */
function asCryptoBytes(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  return copy
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asCryptoBytes(salt), iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedBlob {
  salt: string
  iv: string
  ciphertext: string
}

export async function encryptJson(data: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return {
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    ciphertext: bufToB64(new Uint8Array(cipher)),
  }
}

export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const salt = b64ToBytes(blob.salt)
  const iv = asCryptoBytes(b64ToBytes(blob.iv))
  const key = await deriveKey(passphrase, salt)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    asCryptoBytes(b64ToBytes(blob.ciphertext)),
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function checksum(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}
