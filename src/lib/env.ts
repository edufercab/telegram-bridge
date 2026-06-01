import { z } from 'zod'

const schema = z.object({
  API_KEY: z.string().min(32, 'API_KEY must be at least 32 characters — generate with: openssl rand -hex 32'),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{35,}$/, 'Invalid TELEGRAM_BOT_TOKEN format'),
  TELEGRAM_CHAT_ID: z.coerce.number().int(),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const result = schema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment variables:')
  for (const [field, errors] of Object.entries(result.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${(errors as string[]).join(', ')}`)
  }
  process.exit(1)
}

export const env = result.data
