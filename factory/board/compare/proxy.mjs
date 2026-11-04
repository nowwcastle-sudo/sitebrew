// 후보 중계(v0.2.6 T2 · 설계 D2) — 후보 사이트(`next start`)와 비교 대시보드 사이에 서는 아주 작은 역방향 프록시.
// 후보 사이트는 보안 헤더 `frame-ancestors 'none'` 을 보내므로 대시보드 iframe 에 그대로는 뜨지 않는다. 사이트 파일·빌드는 건드리지 않고, 이 중계가 응답만 두 가지 고친다:
//   ① text/html 응답의 CSP `frame-ancestors …` 를 대시보드 출처 하나로 바꾼다(CSP 헤더가 없으면 더하지 않는다 — 막는 것을 늘리지도, 없던 것을 만들지도 않는다).
//   ② 첫 `</head>` 앞에 `<script src="/__sitebrew/bridge.js"></script>` 를 한 번 넣는다(bridge.js 는 쪽·스크롤을 대시보드와 맞춘다).
// HTML 이 아닌 응답(이미지·JS·CSS·JSON)과 본문 없는 응답(HEAD·204·304)은 본문을 건드리지 않는다.
// 바인딩은 127.0.0.1 뿐이다. 새 의존 0 — node:http 만 쓴다.
import http from 'node:http'

export const BRIDGE_PATH = '/__sitebrew/bridge.js'
export const BRIDGE_TAG = `<script src="${BRIDGE_PATH}"></script>`
const HOST = '127.0.0.1'
// 연결마다 달라지는 헤더 — 중계가 새로 정한다.
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'proxy-connection', 'upgrade'])

/** CSP 헤더 값(문자열 또는 여러 줄) 안의 frame-ancestors 지시문을 대시보드 출처 하나로 바꾼다. 지시문이 없으면 값을 그대로 둔다. */
export function rewriteCsp(value, dashboardOrigin) {
  if (Array.isArray(value)) return value.map((v) => rewriteCsp(v, dashboardOrigin))
  return String(value).replace(/frame-ancestors[^;,]*/gi, `frame-ancestors ${dashboardOrigin}`)
}

/** HTML 바이트에 bridge 태그를 첫 `</head>` 앞에 한 번 넣는다(`</head>` 가 없으면 끝에). 바이트를 건드리지 않도록 latin1(바이트 1:1)로 위치만 찾는다. */
export function injectBridge(buf) {
  if (buf.includes(BRIDGE_TAG)) return buf
  const text = buf.toString('latin1')
  const at = text.search(/<\/head\s*>/i)
  const tag = Buffer.from(BRIDGE_TAG, 'latin1')
  return at < 0 ? Buffer.concat([buf, tag]) : Buffer.concat([buf.subarray(0, at), tag, buf.subarray(at)])
}

const isHtml = (headers) => /\btext\/html\b/i.test(String(headers['content-type'] ?? ''))
const hasBody = (method, status) => method !== 'HEAD' && status !== 204 && status !== 304 && !(status >= 100 && status < 200)
const plainEncoding = (headers) => !headers['content-encoding'] || /^identity$/i.test(String(headers['content-encoding']))

/** 응답 머리: 연결 헤더를 빼고, CSP 는 대시보드 출처로 고친다(본문을 고치는 응답이든 아니든 같다). */
function responseHeaders(upstreamHeaders, dashboardOrigin) {
  const out = {}
  for (const [k, v] of Object.entries(upstreamHeaders)) {
    if (HOP_BY_HOP.has(k)) continue
    out[k] = /^content-security-policy(-report-only)?$/i.test(k) ? rewriteCsp(v, dashboardOrigin) : v
  }
  return out
}

/**
 * @param {{ upstreamPort: number, dashboardOrigin: string, bridgeSource: string }} o
 * @returns {Promise<{ port: number, origin: string, close(): Promise<void> }>}
 */
export function startProxy({ upstreamPort, dashboardOrigin, bridgeSource }) {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url.split('?')[0] === BRIDGE_PATH) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(bridgeSource)
      return
    }
    // 요청은 그대로 넘긴다(Host 도 — 상위 서버의 리다이렉트 Location 이 중계 주소를 가리키게). 압축만 끈다: 본문을 고칠 수 있어야 한다.
    const headers = { ...req.headers, 'accept-encoding': 'identity' }
    delete headers.connection
    const up = http.request({ host: HOST, port: upstreamPort, method: req.method, path: req.url, headers }, (ur) => {
      const status = ur.statusCode ?? 502
      const outHeaders = responseHeaders(ur.headers, dashboardOrigin)
      if (hasBody(req.method, status) && isHtml(ur.headers) && plainEncoding(ur.headers)) {
        const chunks = []
        ur.on('data', (c) => chunks.push(c))
        ur.on('end', () => {
          const body = injectBridge(Buffer.concat(chunks))
          // 고친 HTML 은 중계 주소(포트)마다 CSP 가 달라진다 — 브라우저가 다음 실행에 옛 사본을 쓰지 않게 한다.
          delete outHeaders.etag; delete outHeaders['last-modified']
          outHeaders['cache-control'] = 'no-store'
          outHeaders['content-length'] = String(body.length)
          res.writeHead(status, outHeaders)
          res.end(body)
        })
        ur.on('error', () => res.destroy())
        return
      }
      res.writeHead(status, outHeaders)
      ur.pipe(res)
    })
    up.on('error', (e) => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(`중계: 후보 사이트에 닿지 못했다 (${e.code ?? e.message})`)
    })
    res.on('close', () => { if (!res.writableEnded) up.destroy() })
    req.pipe(up)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, () => {
      const { port } = server.address()
      resolve({
        port,
        origin: `http://${HOST}:${port}`,
        close: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections() }),
      })
    })
  })
}
