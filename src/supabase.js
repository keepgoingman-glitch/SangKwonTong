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
  // 전체 조회: Supabase API는 1회 최대 1000건만 반환하므로 페이지 단위로 끝까지 받아옴
  // query의 limit은 무시(전체 조회), order가 있으면 페이지 경계 안정화를 위해 id를 보조 정렬키로 추가
  getAll: async (table, query = '', pageSize = 1000) => {
    const params = (query || '').split('&').filter(p => p && !/^(limit|offset)=/.test(p))
      .map(p => (p.startsWith('order=') && !/(^|[=,])id\./.test(p)) ? p + ',id.asc' : p)
    if (!params.some(p => p.startsWith('order='))) params.push('order=id.asc')
    const base = params.join('&')
    let all = []
    for (let offset = 0; offset < 100000; offset += pageSize) {
      const res = await fetchWithTimeout(
        `${URL}/rest/v1/${table}?${base}&limit=${pageSize}&offset=${offset}`,
        { headers: h() }
      )
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json()
      all = all.concat(rows)
      if (rows.length < pageSize) break
    }
    return all
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
