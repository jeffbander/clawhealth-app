/**
 * AES-256-GCM encryption for PHI at rest
 * HIPAA Technical Safeguard: 164.312(a)(2)(iv) - Encryption
 * NEVER log encrypted or decrypted values
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // 96-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const ENCODING = 'base64' as const

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) throw new Error('ENCRYPTION_KEY not set')
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

/**
 * Encrypt PHI data for storage in database
 * Returns base64-encoded: iv:tag:ciphertext
 */
export function encryptPHI(plaintext: string): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  // Pack: iv(12) + tag(16) + ciphertext
  const packed = Buffer.concat([iv, tag, encrypted])
  return packed.toString(ENCODING)
}

/**
 * Decrypt PHI data retrieved from database
 * Returns plaintext string
 */
export function decryptPHI(encoded: string): string {
  if (!encoded) return ''
  const key = getKey()
  const packed = Buffer.from(encoded, ENCODING)

  const iv = packed.subarray(0, IV_LENGTH)
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString('utf8')
}

/**
 * Encrypt a JSON-serializable object as PHI
 */
export function encryptJSON(obj: unknown): string {
  return encryptPHI(JSON.stringify(obj))
}

/**
 * Decrypt and parse JSON PHI
 */
export function decryptJSON<T>(encoded: string): T {
  return JSON.parse(decryptPHI(encoded)) as T
}

/**
 * Generate a new 32-byte encryption key (hex)
 * Use for initial setup: node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('hex'))"
 */
export function generateKey(): string {
  return randomBytes(32).toString('hex')
}
