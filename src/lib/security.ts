import { timingSafeEqual, createHash } from 'crypto'
import path from 'path'

/**
 * Constant-time API key comparison to prevent timing attacks.
 * Both values are hashed first so the comparison is always fixed-length
 * regardless of the input length.
 */
export function apiKeyMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
]

/**
 * Validates a URL for use in send-photo to prevent SSRF attacks.
 * Only allows http/https, rejects private/loopback IP ranges.
 */
export function validatePhotoUrl(rawUrl: string): { valid: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { valid: false, reason: 'Malformed URL' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only http and https URLs are allowed' }
  }

  const hostname = parsed.hostname
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: 'URLs pointing to private or loopback addresses are not allowed' }
    }
  }

  if (hostname === 'localhost') {
    return { valid: false, reason: 'URLs pointing to localhost are not allowed' }
  }

  return { valid: true }
}

/**
 * Validates a local file path for use in send-photo to prevent path traversal attacks.
 * The resolved path must be absolute and must not contain null bytes.
 */
export function validateLocalFilePath(filePath: string): { valid: boolean; reason?: string } {
  if (filePath.includes('\0')) {
    return { valid: false, reason: 'Path contains null bytes' }
  }

  const resolved = path.resolve(filePath)

  if (!path.isAbsolute(resolved)) {
    return { valid: false, reason: 'Path must be absolute' }
  }

  const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])
  const ext = path.extname(resolved).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}` }
  }

  return { valid: true }
}
