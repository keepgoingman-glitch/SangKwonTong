// Vercel Serverless Function — 웹 푸시 발송
// GitHub 레포에 /api/send-push.js 로 업로드 (api 폴더가 없으면 만들기)
// 상담 저장 시 프론트에서 이 함수를 호출 → 저장된 모든 구독으로 푸시 발송
//
// ⚠ 배포 전 필수:
//   1) Vercel 프로젝트 → Settings → Environment Variables 에 아래 3개 추가
//      VAPID_PUBLIC  = BA4viCmG__RR2DkCKbNLGNP0Lha8lN0pVX8aSbVvYhqlOswkuTojSVcvWDBL5vMm8eHkMLH8l2vEdsZGQa3Asho
//      VAPID_PRIVATE = jrJt_qoDDOrZhD4y-EphprQo19TOedBX9EIDA3YRE6M
//      SUPABASE_URL  = https://dzllnccevmdjnoinjefr.supabase.co
//      SUPABASE_ANON = (상권통에서 쓰는 anon key)
//   2) package.json 의 dependencies 에 "web-push" 추가 (아래 안내 참고)

const webpush = require('web-push')

module.exports = async (req, res) => {
  // CORS
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

  // 요청 바디 파싱
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch(e) { body = {} } }
  const title = body.title || '🔔 신규 상담 요청'
  const message = body.body || '새로운 상담 요청이 접수되었습니다.'
  const url = body.url || '/'

  try {
    // 저장된 구독 전부 조회
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
        // 만료된 구독(410/404) 정리
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
