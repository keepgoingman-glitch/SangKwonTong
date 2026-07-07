// Vercel Serverless Function — 웹 푸시 발송 (ES Module 버전)
// GitHub 레포 /api/send-push.js
// ※ 프로젝트 package.json에 "type":"module"이 있어 ES 모듈 문법(import/export) 사용
//
// ⚠ 배포 전 필수:
//   1) Vercel → Settings → Environment Variables 에 4개 추가:
//      VAPID_PUBLIC  = BA4viCmG__RR2DkCKbNLGNP0Lha8lN0pVX8aSbVvYhqlOswkuTojSVcvWDBL5vMm8eHkMLH8l2vEdsZGQa3Asho
//      VAPID_PRIVATE = jrJt_qoDDOrZhD4y-EphprQo19TOedBX9EIDA3YRE6M
//      SUPABASE_URL  = https://dzllnccevmdjnoinjefr.supabase.co
//      SUPABASE_ANON = (상권통 anon key)
//   2) 환경변수 추가 후 반드시 Redeploy
//   3) package.json dependencies 에 "web-push": "^3.6.7"

import webpush from 'web-push'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const PUB = process.env.VAPID_PUBLIC
  const PRIV = process.env.VAPID_PRIVATE
  const SB_URL = process.env.SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_ANON
  if (!PUB || !PRIV || !SB_URL || !SB_KEY) {
    return res.status(500).json({ error: '환경변수 미설정 (VAPID/SUPABASE)' })
  }

  webpush.setVapidDetails('mailto:admin@sangkwontong.app', PUB, PRIV)

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch(e) { body = {} } }
  body = body || {}
  const title = body.title || '🔔 신규 상담 요청'
  const message = body.body || '새로운 상담 요청이 접수되었습니다.'
  const url = body.url || '/'

  try {
    const r = await fetch(SB_URL + '/rest/v1/push_subscriptions?select=*', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    })
    const subs = await r.json()
    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(200).json({ sent: 0, note: '등록된 구독 없음' })
    }

    const payload = JSON.stringify({ title, body: message, url, tag: 'aircon-lead-' + Date.now() })
    let sent = 0, failed = 0
    await Promise.all(subs.map(async (s) => {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
      try { await webpush.sendNotification(sub, payload); sent++ }
      catch (e) {
        failed++
        if (e.statusCode === 410 || e.statusCode === 404) {
          await fetch(SB_URL + '/rest/v1/push_subscriptions?id=eq.' + s.id, {
            method: 'DELETE', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
          }).catch(()=>{})
        }
      }
    }))
    return res.status(200).json({ sent, failed })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
