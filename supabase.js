const URL = 'https://dzllnccevmdjnoinjefr.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6bGxuY2Nldm1kam5vaW5qZWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjIyODksImV4cCI6MjA5MTY5ODI4OX0.Gl3Y-QRXHTSouG8xwMp0p98eUqBADKLC0zF9vuzBSP8'

const h = () => ({
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
})

// 타임아웃 fetch (기본 20초)
const fetchWithTimeout = (url, opts, ms = 20000) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(timer))
}

export const db = {
  get: async (table, query = '') => {
    const res = await fetchWithTimeout(
      `${URL}/rest/v1/${table}${query ? '?' + query : ''}`,
      { headers: h() }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  post: async (table, body) => {
    const res = await fetchWithTimeout(
      `${URL}/rest/v1/${table}`,
      { method: 'POST', headers: h(), body: JSON.stringify(body) }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  patch: async (table, query, body) => {
    const res = await fetchWithTimeout(
      `${URL}/rest/v1/${table}?${query}`,
      { method: 'PATCH', headers: h(), body: JSON.stringify(body) }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  del: async (table, query) => {
    const res = await fetchWithTimeout(
      `${URL}/rest/v1/${table}?${query}`,
      { method: 'DELETE', headers: h() }
    )
    if (!res.ok) throw new Error(await res.text())
  },
  // 서버 함수(RPC) 호출 - 로그인 검증 등 보안 작업용
  rpc: async (fnName, params = {}) => {
    const res = await fetchWithTimeout(
      `${URL}/rest/v1/rpc/${fnName}`,
      { method: 'POST', headers: h(), body: JSON.stringify(params) }
    )
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }
}
