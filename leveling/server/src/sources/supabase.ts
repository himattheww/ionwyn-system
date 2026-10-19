export interface SupabaseConfig {
  url?: string
  key?: string
  email?: string
  password?: string
}

type Row = Record<string, unknown>

async function accessToken(config: Required<Pick<SupabaseConfig, 'url' | 'key'>> & SupabaseConfig) {
  if (!config.email) return config.key
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.key, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password })
  })
  if (!response.ok) throw new Error(`Login Supabase gagal (${response.status})`)
  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

export async function supabaseRows(config: SupabaseConfig, table: string, query: string) {
  const { url, key } = config
  if (!url || !key) throw new Error('URL atau key Supabase belum diisi')
  const token = await accessToken({ ...config, url, key })
  const rows: Row[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${url}/rest/v1/${table}?${query}&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, authorization: `Bearer ${token}` }
    })
    if (!response.ok) throw new Error(`Gagal membaca ${table} (${response.status}): ${(await response.text()).slice(0, 200)}`)
    const page = (await response.json()) as Row[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
