// launch-factory: 웹 푸시 서비스 워커. 서버가 보낸 JSON { title, body?, url?, tag?, icon? } 를 알림으로 띄우고, 누르면 이 사이트 안의 쪽을 연다.
// 같은 출처 경로(/…)가 아니면 열지 않고 홈으로 간다 — 알림 내용이 밖으로 보내는 길이 되지 않게.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

function readPayload(event) {
  try {
    return event.data ? event.data.json() || {} : {}
  } catch {
    return {}
  }
}

self.addEventListener("push", (event) => {
  const data = readPayload(event)
  const title = typeof data.title === "string" && data.title ? data.title : "알림"
  const options = {
    ...(typeof data.body === "string" ? { body: data.body } : {}),
    ...(typeof data.tag === "string" ? { tag: data.tag } : {}),
    ...(typeof data.icon === "string" && /^\/[^/\\]/.test(data.icon) ? { icon: data.icon } : {}),
    data: { url: typeof data.url === "string" ? data.url : "/" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const raw = event.notification.data && event.notification.data.url
  const path = typeof raw === "string" && /^\/[^/\\]/.test(raw) ? raw : "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (new URL(w.url).pathname === path.split(/[?#]/)[0] && "focus" in w) return w.focus()
      }
      return self.clients.openWindow(path)
    }),
  )
})
