import type { Context } from 'hono'
import { AppError } from '../lib/errors'

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.statusCode as Parameters<typeof c.json>[1],
    )
  }

  // Avoid leaking internal error details in production
  const isDev = process.env['NODE_ENV'] === 'development'
  console.error('Unhandled error:', err)

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDev ? err.message : 'Internal server error',
      },
    },
    500,
  )
}
