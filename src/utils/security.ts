// Security, encryption, and data protection utilities

// === HASHING ===

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function sha512(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// === ENCRYPTION / DECRYPTION ===

export interface EncryptionResult {
  ciphertext: string
  iv: string
  salt: string
}

export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(
  plaintext: string,
  password: string
): Promise<EncryptionResult> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  
  const plaintextBuffer = new TextEncoder().encode(plaintext)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBuffer
  )
  
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)))
  const ivStr = btoa(String.fromCharCode(...iv))
  const saltStr = btoa(String.fromCharCode(...salt))
  
  return { ciphertext, iv: ivStr, salt: saltStr }
}

export async function decrypt(
  encrypted: EncryptionResult,
  password: string
): Promise<string> {
  const salt = Uint8Array.from(atob(encrypted.salt), c => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0))
  
  const key = await deriveKey(password, salt)
  
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  
  return new TextDecoder().decode(plaintextBuffer)
}

// === DATA SANITIZATION ===

export function sanitizeHtml(html: string): string {
  const div = document.createElement('div')
  div.textContent = html
  return div.innerHTML
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

export function stripTags(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export function sanitizeSql(input: string): string {
  return input.replace(/['";\\]/g, '')
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]/, '')
    .substring(0, 255)
}

// === INPUT VALIDATION ===

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isValidPhoneUK(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, '')
  return /^(\+44|0)[1-9]\d{9}$/.test(cleaned)
}

export function isValidPostcodeUK(postcode: string): boolean {
  const cleaned = postcode.replace(/\s/g, '').toUpperCase()
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/.test(cleaned)
}

// === TOKEN GENERATION ===

export function generateRandomToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export function generateUUID(): string {
  return crypto.randomUUID()
}

export function generateOTP(length: number = 6): string {
  const digits = '0123456789'
  let otp = ''
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  
  for (let i = 0; i < length; i++) {
    otp += digits[array[i] % 10]
  }
  
  return otp
}

// === PASSWORD STRENGTH ===

export interface PasswordStrength {
  score: number // 0-4
  feedback: string[]
  isStrong: boolean
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0
  
  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters')
  } else if (password.length < 12) {
    score += 1
    feedback.push('Consider using 12+ characters for better security')
  } else {
    score += 2
  }
  
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('Use both uppercase and lowercase letters')
  }
  
  if (/\d/.test(password)) {
    score += 1
  } else {
    feedback.push('Include at least one number')
  }
  
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1
  } else {
    feedback.push('Include at least one special character')
  }
  
  const common = ['password', '123456', 'qwerty', 'abc123', 'letmein']
  if (common.some(c => password.toLowerCase().includes(c))) {
    score = Math.max(0, score - 2)
    feedback.push('Avoid common passwords')
  }
  
  const isStrong = score >= 3 && password.length >= 12
  
  return { score: Math.min(4, score), feedback, isStrong }
}

// === RATE LIMITING ===

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimits = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimits.get(key)
  
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    rateLimits.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: maxAttempts - 1, resetAt }
  }
  
  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  
  entry.count++
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt
  }
}

export function resetRateLimit(key: string): void {
  rateLimits.delete(key)
}

// === CSRF PROTECTION ===

let csrfToken: string | null = null

export function generateCsrfToken(): string {
  csrfToken = generateRandomToken(32)
  return csrfToken
}

export function validateCsrfToken(token: string): boolean {
  return csrfToken !== null && token === csrfToken
}

// === CONTENT SECURITY ===

export function detectXSS(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /eval\(/i,
    /expression\(/i
  ]
  
  return xssPatterns.some(pattern => pattern.test(input))
}

export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(;.*--)/,
    /('.*or.*'.*=.*')/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

// === SECURE STORAGE ===

export async function secureStore(
  key: string,
  value: string,
  password: string
): Promise<void> {
  const encrypted = await encrypt(value, password)
  localStorage.setItem(key, JSON.stringify(encrypted))
}

export async function secureRetrieve(
  key: string,
  password: string
): Promise<string | null> {
  const stored = localStorage.getItem(key)
  if (!stored) return null
  
  try {
    const encrypted: EncryptionResult = JSON.parse(stored)
    return await decrypt(encrypted, password)
  } catch {
    return null
  }
}

export function secureDelete(key: string): void {
  localStorage.removeItem(key)
}

// === DATA MASKING ===

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 4) return phone
  
  const visible = cleaned.slice(-4)
  const masked = '*'.repeat(cleaned.length - 4)
  return masked + visible
}

export function maskCardNumber(card: string): string {
  const cleaned = card.replace(/\D/g, '')
  if (cleaned.length < 4) return card
  
  const visible = cleaned.slice(-4)
  const masked = '*'.repeat(Math.max(0, cleaned.length - 4))
  return masked + visible
}

export function maskNino(nino: string): string {
  if (nino.length < 4) return nino
  return `${nino.slice(0, 2)}${'*'.repeat(nino.length - 4)}${nino.slice(-2)}`
}

// === AUDIT LOGGING ===

export interface AuditLog {
  timestamp: string
  action: string
  userId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

const auditLogs: AuditLog[] = []

export function logAudit(
  action: string,
  details?: Record<string, unknown>,
  userId?: string
): void {
  auditLogs.push({
    timestamp: new Date().toISOString(),
    action,
    userId,
    details,
    userAgent: navigator.userAgent
  })
  
  if (auditLogs.length > 1000) {
    auditLogs.splice(0, auditLogs.length - 1000)
  }
}

export function getAuditLogs(
  filter?: Partial<AuditLog>
): AuditLog[] {
  if (!filter) return [...auditLogs]
  
  return auditLogs.filter(log => {
    return Object.entries(filter).every(([key, value]) => {
      return log[key as keyof AuditLog] === value
    })
  })
}

export function clearAuditLogs(): void {
  auditLogs.length = 0
}
