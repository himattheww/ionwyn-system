export type Source = { title: string; url: string }

async function isReachable(url: string) {
  if (!URL.canParse(url) || !/^https?:$/.test(new URL(url).protocol)) return false
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 learning-app link-check' },
      signal: AbortSignal.timeout(8000),
    })
    await res.body?.cancel()
    return res.status >= 200 && res.status <= 399
  } catch {
    return false
  }
}

export async function keepReachable(sources: Source[]) {
  const checks = await Promise.all(sources.map((s) => isReachable(s.url)))
  return sources.filter((_, i) => checks[i])
}
