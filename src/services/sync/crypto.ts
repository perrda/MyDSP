/** AES-GCM + PBKDF2 encryption for sync bundles. */

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  // Always copy the view's bytes — never use .buffer alone (SharedArrayBuffer / offset views).
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

/** Decode base64 into a fresh ArrayBuffer-backed view (WebCrypto BufferSource-safe). */
function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

/** Copy any Uint8Array into a standalone ArrayBuffer view for WebCrypto. */
function asCryptoBytes(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(view.byteLength)
  out.set(view)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  // Pass a copied view (not salt.buffer) so byteOffset/byteLength and TS BufferSource are correct.
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
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asCryptoBytes(iv) },
    key,
    plain,
  )
  return {
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    ciphertext: bufToB64(new Uint8Array(cipher)),
  }
}

export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const salt = b64ToBuf(blob.salt)
  const iv = b64ToBuf(blob.iv)
  const key = await deriveKey(passphrase, salt)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    b64ToBuf(blob.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function checksum(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}
