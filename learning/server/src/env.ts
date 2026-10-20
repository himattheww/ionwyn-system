import { z } from 'zod'

export const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    AI_PROVIDER: z.enum(['cli', 'api', 'off']).default(process.env.VERCEL ? 'off' : 'cli'),
    CLAUDE_CLI_PATH: z.string().default('claude'),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional(),
    PORT: z.coerce.number().int().default(3001),
  })
  .parse(process.env)
