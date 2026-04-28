// Service Worker – HERSKO App v2
// Handles push notifications and notification click events

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// Handle push events (from a future backend push service)
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(data.title || '📝 ארוחת ערב חסרה', {
      body: data.body || 'עוד לא מילאת מה אכלת הערב — לחץ למילוי',
      icon: '/mishk-habayit/favicon.svg',
      badge: '/mishk-habayit/favicon.svg',
      tag: 'dinner-reminder',
      renotify: false,
      data: { url: '/mishk-habayit/dinners' },
    })
  )
})

// Open the app to the dinners page when notification is tapped
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const target = e.notification.data?.url || '/mishk-habayit/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(all => {
      for (const c of all) {
        if (c.url.includes('/mishk-habayit/') && 'focus' in c) {
          c.navigate(target)
          return c.focus()
        }
      }
      return clients.openWindow(target)
    })
  )
})
