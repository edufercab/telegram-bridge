import { createMiddleware } from 'hono/factory'
import { ValidationError } from '../lib/errors'

const MAX_BODY_BYTES = 64 * 1024 // 64 KB

export const bodyLimitMiddleware = createMiddleware(async (c, next) => {
  const contentLength = c.req.header('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    throw new ValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`)
  }
  await next()
})
