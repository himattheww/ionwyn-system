import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import express, { type Request, type Response, Router } from 'express'
import { InvalidClientMetadataError, InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { db, unwrap } from './db.js'

const ACCESS_TTL = 60 * 60
const REFRESH_TTL = 90 * 24 * 60 * 60
const CODE_TTL = 5 * 60

const allowedRedirect = (uri: string) =>
  /^https:\/\/claude\.(ai|com)\/api\/mcp\/auth_callback$/.test(uri) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri)

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const newSecret = () => randomBytes(32).toString('base64url')
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

type Pending = { clientId: string; redirectUri: string; codeChallenge: string; state?: string; resource?: string; exp: number }

type Options = { baseUrl: URL; secret: string; isOwner: (req: Request, res: Response) => Promise<boolean> }

export function mcpAuth({ baseUrl, secret, isOwner }: Options) {
  const sign = (body: string) => createHmac('sha256', secret).update(body).digest('base64url')
  const pack = (data: Pending) => {
    const body = Buffer.from(JSON.stringify(data)).toString('base64url')
    return `${body}.${sign(body)}`
  }
  const unpack = (value: string): Pending | null => {
    const [body = '', signature = ''] = value.split('.')
    const expected = Buffer.from(sign(body))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as Pending
    return data.exp > Date.now() ? data : null
  }

  async function issueTokens(clientId: string, resource: string | null): Promise<OAuthTokens> {
    const access = newSecret()
    const refresh = newSecret()
    const now = Date.now()
    unwrap(
      await db
        .from('mcp_tokens')
        .insert([
          { token_hash: hash(access), kind: 'access', client_id: clientId, resource, expires_at: new Date(now + ACCESS_TTL * 1000).toISOString() },
          { token_hash: hash(refresh), kind: 'refresh', client_id: clientId, resource, expires_at: new Date(now + REFRESH_TTL * 1000).toISOString() },
        ])
        .select('token_hash'),
    )
    await db.from('mcp_tokens').delete().lt('expires_at', new Date(now).toISOString())
    return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, refresh_token: refresh }
  }

  async function takeToken(token: string, kind: 'access' | 'refresh', clientId?: string) {
    let query = db.from('mcp_tokens').select('client_id, resource, expires_at').eq('token_hash', hash(token)).eq('kind', kind).gt('expires_at', new Date().toISOString())
    if (clientId) query = query.eq('client_id', clientId)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data
  }

  const provider: OAuthServerProvider = {
    clientsStore: {
      async getClient(clientId) {
        const { data, error } = await db.from('mcp_clients').select('info').eq('client_id', clientId).maybeSingle()
        if (error) throw error
        return data?.info as OAuthClientInformationFull | undefined
      },
      async registerClient(client) {
        if (!client.redirect_uris.every((uri) => allowedRedirect(String(uri)))) {
          throw new InvalidClientMetadataError('redirect_uri tidak diizinkan')
        }
        const info = client as OAuthClientInformationFull
        unwrap(await db.from('mcp_clients').insert({ client_id: info.client_id, info }).select('client_id').single())
        return info
      },
    },

    async authorize(client, params, res) {
      const req = res.req
      if (!(await isOwner(req, res))) {
        const back = `/authorize?${new URLSearchParams(req.query as Record<string, string>)}`
        return res.redirect(`/masuk/?next=${encodeURIComponent(back)}`)
      }
      const request = pack({
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state,
        resource: params.resource?.href,
        exp: Date.now() + 10 * 60_000,
      })
      res.type('html').send(consentPage(client.client_name ?? 'Aplikasi tanpa nama', request))
    },

    async challengeForAuthorizationCode(client, code) {
      const { data, error } = await db
        .from('mcp_codes')
        .select('code_challenge')
        .eq('code_hash', hash(code))
        .eq('client_id', client.client_id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (error) throw error
      if (!data) throw new InvalidGrantError('Kode otorisasi tidak valid')
      return data.code_challenge
    },

    async exchangeAuthorizationCode(client, code, _verifier, redirectUri) {
      const { data, error } = await db
        .from('mcp_codes')
        .delete()
        .eq('code_hash', hash(code))
        .eq('client_id', client.client_id)
        .gt('expires_at', new Date().toISOString())
        .select('redirect_uri, resource')
        .maybeSingle()
      if (error) throw error
      if (!data || (redirectUri && redirectUri !== data.redirect_uri)) throw new InvalidGrantError('Kode otorisasi tidak valid')
      return issueTokens(client.client_id, data.resource)
    },

    async exchangeRefreshToken(client, refreshToken) {
      const row = await takeToken(refreshToken, 'refresh', client.client_id)
      if (!row) throw new InvalidGrantError('Refresh token tidak valid')
      await db.from('mcp_tokens').delete().eq('token_hash', hash(refreshToken))
      return issueTokens(client.client_id, row.resource)
    },

    async verifyAccessToken(token) {
      const row = await takeToken(token, 'access')
      if (!row) throw new InvalidTokenError('Token tidak valid')
      return { token, clientId: row.client_id, scopes: [], expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000) }
    },
  }

  const router = Router()
  const resourceUrl = new URL('/mcp', baseUrl)

  router.post('/consent', express.urlencoded({ extended: false }), async (req, res) => {
    const pending = unpack(String(req.body.request ?? ''))
    if (!pending) return res.status(400).type('text').send('Permintaan sudah kedaluwarsa. Ulangi dari Claude.')
    if (!(await isOwner(req, res))) return res.status(403).type('text').send('Perlu login sebagai pemilik Ionwyn.')
    const target = new URL(pending.redirectUri)
    if (pending.state) target.searchParams.set('state', pending.state)
    if (req.body.decision !== 'allow') {
      target.searchParams.set('error', 'access_denied')
      return res.redirect(target.href)
    }
    const code = newSecret()
    unwrap(
      await db
        .from('mcp_codes')
        .insert({
          code_hash: hash(code),
          client_id: pending.clientId,
          redirect_uri: pending.redirectUri,
          code_challenge: pending.codeChallenge,
          resource: pending.resource ?? null,
          expires_at: new Date(Date.now() + CODE_TTL * 1000).toISOString(),
        })
        .select('code_hash')
        .single(),
    )
    target.searchParams.set('code', code)
    res.redirect(target.href)
  })

  router.use(mcpAuthRouter({ provider, issuerUrl: baseUrl, resourceServerUrl: resourceUrl, resourceName: 'Ionwyn Learn' }))

  const bearer = requireBearerAuth({ verifier: provider, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl) })

  return { router, bearer }
}

function consentPage(clientName: string, request: string) {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Izinkan akses · Ionwyn</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/design/system.css" />
    <link rel="stylesheet" href="/styles/masuk.css" />
  </head>
  <body>
    <main class="sign-in">
      <p class="eyebrow">Ionwyn Learn</p>
      <h1>Izinkan akses?</h1>
      <p class="muted"><strong>${escapeHtml(clientName)}</strong> meminta izin membaca dan mengubah jalur belajar di Ionwyn Learn: melihat progres, membuat jalur, dan mengubah topik.</p>
      <form method="post" action="/consent" class="sign-in-form">
        <input type="hidden" name="request" value="${escapeHtml(request)}" />
        <button class="btn btn-primary" name="decision" value="allow" type="submit">Izinkan</button>
        <button class="btn" name="decision" value="deny" type="submit">Tolak</button>
      </form>
    </main>
  </body>
</html>`
}
