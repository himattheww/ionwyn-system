import { z } from 'zod'

export const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    PORT: z.coerce.number().int().default(3001),
  })
  .parse(process.env)
