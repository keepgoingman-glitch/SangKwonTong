const SUPABASE_URL = 'https://dzllnccevmdjnoinjefr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6bGxuY2Nldm1kam5vaW5qZWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjIyODksImV4cCI6MjA5MTY5ODI4OX0.Gl3Y-QRXHTSouG8xwMp0p98eUqBADKLC0zF9vuzBSP8'

function headers(extra) {
  return Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }, extra || {})
}

export async function dbGet(table, query) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + (query ? '?' + query : ''), { headers: headers() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function dbPost(table, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function dbPatch(table, query, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function dbDelete(table, query) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, { method: 'DELETE', headers: headers() })
  if (!res.ok) throw new Error(await res.text())
}
