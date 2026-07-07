// 서비스 워커 — 웹 푸시 백그라운드 수신 (앱을 꺼도 동작)
// GitHub public/sw.js 로 업로드

self.addEventListener('push', function(event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch(e) { data = { title: '새 상담', body: event.data ? event.data.text() : '' } }
  const title = data.title || '🔔 신규 상담 요청'
  const options = {
    body: data.body || '새로운 상담 요청이 접수되었습니다.',
    icon: '/icon-app.png',
    badge: '/icon-app.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'aircon-lead',
    renotify: true,
    data: { url: data.url || '/' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const c of list) { if ('focus' in c) return c.focus() }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
