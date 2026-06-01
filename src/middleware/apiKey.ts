import { createMiddleware } from 'hono/factory'
import { env } from '../lib/env'
import { UnauthorizedError } from '../lib/errors'
import { apiKeyMatches } from '../lib/security'

export const apiKeyMiddleware = createMiddleware(async (c, next) => {
  const key = c.req.header('X-API-Key') ?? ''

  // Constant-time comparison prevents timing-based key enumeration
  if (!apiKeyMatches(key, env.API_KEY)) {
    throw new UnauthorizedError()
  }

  await next()
})
