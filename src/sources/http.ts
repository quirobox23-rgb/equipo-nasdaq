export async function getJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': 'Mozilla/5.0 (oficina-nasdaq)', Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return (await res.json()) as T
}

export async function getTexto(url: string, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (oficina-nasdaq)' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return res.text()
}
