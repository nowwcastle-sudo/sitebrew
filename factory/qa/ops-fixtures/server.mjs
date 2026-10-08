// ops-gate 시험용 픽스처 서버(P3-4 Task 1) — 좋은 사이트 하나와, `broken` 값 하나로 검사 하나만 어기는 변형들.
//   startFixtureServer({ broken, csp }) → { origin, siteDir, hits, close() }   csp: 'hash'(기본 — 정적 사이트 completion "site": script-src 'self' + 인라인 script 해시) | 'nonce'(제품 completion "product": 요청마다 다른 nonce)
//   좋은 사이트: 쪽 / · /pricing · /privacy(법정) · /thanks(noindex, sitemap 에 없음). LH 시험용 쪽: /heavy-hero · /shift · /unload(깨진 것은 이 쪽 하나뿐).
//   공유 그림·sitemap 의 절대 주소는 운영 주소 흉내(https://fixture.example)라서 관문이 경로만 떼어 origin 에 붙여 읽는다.
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

export const PROD = 'https://fixture.example'
export const BROKEN = [
  'og-size', 'og-relative', 'og-missing', 'csp-no-nonce', 'csp-static-nonce', 'csp-unsafe-inline', 'csp-missing-hash', 'csp-none', 'no-base-uri', 'no-object-src', 'no-frame-ancestors', 'no-nosniff', 'no-referrer-policy', 'no-permissions-policy',
  'error-default', 'error-soft-200', 'no-boundary', 'sitemap-missing-route', 'sitemap-noindex', 'robots-no-sitemap', 'legal-404', 'no-manifest', 'apple-size', 'no-ico-16',
  'no-viewport-fit', 'track-before-consent', 'no-pageview', 'pageview-twice', 'no-analytics', 'no-h1', 'two-h1', 'wrong-lang', 'no-title', 'no-jsonld',
]

const png = (w, h, bg = '#1d4ed8') => sharp({ create: { width: w, height: h, channels: 3, background: bg } }).png().toBuffer()

/** 크기마다 PNG 하나씩 든 ICO(디렉터리 항목 = 폭·높이·PNG 데이터). */
async function ico(sizes) {
  const imgs = await Promise.all(sizes.map((s) => png(s, s)))
  const head = Buffer.alloc(6 + 16 * imgs.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(imgs.length, 4)
  let off = head.length
  imgs.forEach((buf, i) => {
    const o = 6 + 16 * i
    head[o] = sizes[i] % 256
    head[o + 1] = sizes[i] % 256
    head.writeUInt16LE(1, o + 4)
    head.writeUInt16LE(32, o + 6)
    head.writeUInt32LE(buf.length, o + 8)
    head.writeUInt32LE(off, o + 12)
    off += buf.length
  })
  return Buffer.concat([head, ...imgs])
}

/** 압축이 안 되는 큰 그림(잡음 JPEG) — 느린 4G 모의에서 LCP 가 늦어진다. */
async function noiseJpeg(w, h) {
  const raw = Buffer.alloc(w * h * 3)
  let x = 123456789
  for (let i = 0; i < raw.length; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    raw[i] = x & 255
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer()
}

const SHELL_NAV = '<header><nav aria-label="주 메뉴"><a href="/">홈</a> <a href="/pricing">요금</a> <a href="/privacy">개인정보 처리방침</a></nav></header>'
const FOOTER = '<footer><p>© 픽스처 상점 · 서울</p></footer>'
const CSS = 'body{font:16px/1.6 system-ui,sans-serif;margin:0;color:#111;background:#fff}header,main,footer{max-width:720px;margin:0 auto;padding:12px 16px}nav a{margin-right:12px;color:#0b3d91}h1{font-size:28px;margin:12px 0}a{color:#0b3d91}button{font:inherit;padding:10px 16px;min-height:44px}#cookie-banner{position:fixed;left:0;right:0;bottom:0;background:#f3f4f6;padding:12px 16px}'
const BANNER = '<div role="region" aria-label="쿠키 동의" id="cookie-banner"><p>서비스 개선을 위해 방문 기록을 모아도 될까요?</p><button type="button" data-consent="decline">모두 거부하기</button> <button type="button" data-consent="accept">모두 허용하기</button></div>'

const NOT_FOUND_DEFAULT = '<!DOCTYPE html><html><head><title>404: This page could not be found.</title></head><body><div><h1 class="next-error-h1">404</h1><div><h2>This page could not be found.</h2></div></div></body></html>'

export async function startFixtureServer({ broken = null, csp = 'hash' } = {}) {
  if (!['hash', 'nonce'].includes(csp)) throw new Error(`모르는 csp 방식: ${csp}`)
  if (broken && !BROKEN.includes(broken)) throw new Error(`모르는 깨짐 값: ${broken}`)
  const b = (k) => broken === k
  const siteDir = mkdtempSync(join(tmpdir(), 'ops-fixture-site-'))
  mkdirSync(join(siteDir, 'app'), { recursive: true })
  if (!b('no-boundary')) {
    writeFileSync(join(siteDir, 'app', 'error.tsx'), '"use client"\nexport default function E() { return null }\n')
    writeFileSync(join(siteDir, 'app', 'global-error.tsx'), '"use client"\nexport default function G() { return null }\n')
  }

  const og = b('og-missing') ? null : await sharp({ create: { width: b('og-size') ? 800 : 1200, height: b('og-size') ? 418 : 630, channels: 3, background: '#0f172a' } }).png().toBuffer()
  const assets = new Map([
    ['/opengraph-image', ['image/png', og]],
    ['/favicon.ico', ['image/x-icon', await ico(b('no-ico-16') ? [32, 48] : [16, 32])]],
    ['/icon.svg', ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#1d4ed8"/></svg>')]],
    ['/apple-icon.png', ['image/png', await png(b('apple-size') ? 120 : 180, b('apple-size') ? 120 : 180)]],
    ['/icon-192.png', ['image/png', await png(192, 192)]],
    ['/icon-512.png', ['image/png', await png(512, 512)]],
    ['/icon-maskable-512.png', ['image/png', await png(512, 512)]],
    ['/hero-big.jpg', ['image/jpeg', await noiseJpeg(2400, 1600)]],
  ])
  const manifest = JSON.stringify({
    name: '픽스처 상점', short_name: '픽스처', start_url: '/', display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  })

  const hits = []
  const staticNonce = 'c3RhdGljLW5vbmNl'

  // 인라인 script 의 sha256 토큰(브라우저와 같은 계산 — 태그 사이 글자 통째). 좋은 사이트의 헤더가 이 쪽 실제 script 를 그대로 허용한다.
  const hashesOf = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc=/.test(m[1]) && !/type="application\/ld\+json"/.test(m[1]) && m[2] !== '')
    .map((m) => `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)

  const headerSet = (nonce, html = '') => {
    const h = { 'content-type': 'text/html; charset=utf-8' }
    if (!b('no-nosniff')) h['x-content-type-options'] = 'nosniff'
    if (!b('no-referrer-policy')) h['referrer-policy'] = 'strict-origin-when-cross-origin'
    if (!b('no-permissions-policy')) h['permissions-policy'] = 'camera=(), microphone=(), geolocation=()'
    if (csp === 'hash' && b('csp-none')) return h
    const fa = b('no-frame-ancestors') ? '' : " frame-ancestors 'none';"
    const base = b('no-base-uri') ? '' : " base-uri 'self';"
    const obj = b('no-object-src') ? '' : " object-src 'none';"
    const tail = `style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';${obj}${base}${fa}`
    if (csp === 'hash') {
      const hashes = hashesOf(html)
      const script = b('csp-unsafe-inline') ? "'self' 'unsafe-inline'" : `'self' ${(b('csp-missing-hash') ? hashes.slice(1) : hashes).join(' ')}`.trim()
      h['content-security-policy'] = `default-src 'self'; script-src ${script}; ${tail}`
      return h
    }
    h['content-security-policy'] = b('csp-no-nonce')
      ? `default-src 'self'; script-src 'self' 'unsafe-inline'; ${tail}`
      : `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ${tail}`
    return h
  }
  // 응답 본문: nonce 방식이면 자리표시(__NONCE__)를 nonce 로, 해시 방식이면 nonce 속성을 뗀다(정적 사이트의 script 에는 nonce 가 없다).
  const render = (html, nonce) => (csp === 'nonce' ? html.replaceAll('__NONCE__', nonce) : html.replaceAll(' nonce="__NONCE__"', ''))

  const viewport = b('no-viewport-fit') ? 'width=device-width, initial-scale=1' : 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content'
  const ogTag = b('og-missing') ? '' : `<meta property="og:image" content="${b('og-relative') ? '/opengraph-image' : `${PROD}/opengraph-image`}">`
  const head = (title, { noindex = false } = {}) =>
    `<!doctype html><html lang="${b('wrong-lang') ? 'en' : 'ko'}"><head><meta charset="utf-8"><title>${b('no-title') ? '' : title}</title>${b('no-jsonld') ? '' : '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"픽스처 상점"}</script>'}<meta name="description" content="${title} — 픽스처 상점의 안내 쪽입니다."><meta name="viewport" content="${viewport}">${noindex ? '<meta name="robots" content="noindex">' : ''}<link rel="icon" href="/favicon.ico" sizes="16x16 32x32"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-icon.png">${b('no-manifest') ? '' : '<link rel="manifest" href="/manifest.webmanifest">'}${ogTag}<style>${CSS}</style></head>`

  const consentScript = () => {
    if (b('no-analytics')) return ''
    const send = "fetch('/ingest',{method:'POST',body:JSON.stringify({event:'page_view',path:location.pathname})})"
    const before = b('track-before-consent') ? "navigator.sendBeacon('/ingest',JSON.stringify({event:'page_view',path:location.pathname}));" : ''
    const after = b('no-pageview') ? '' : b('pageview-twice') ? `${send};${send};` : `${send};`
    return `<script nonce="__NONCE__">${before}document.addEventListener('click',function(e){var t=e.target.closest('[data-consent]');if(!t)return;var a=t.getAttribute('data-consent')==='accept';document.getElementById('cookie-banner').remove();if(a){${after}}})</script>`
  }

  const body = (title, inner, { noindex = false, extraScript = '' } = {}) =>
    `${head(title, { noindex })}<body>${SHELL_NAV}<main>${b('no-h1') ? `<h2>${title}</h2>` : `<h1>${title}</h1>`}${b('two-h1') ? '<h1>두 번째 제목</h1>' : ''}${inner}</main>${FOOTER}${b('no-analytics') ? '' : BANNER}${consentScript()}${extraScript}</body></html>`

  const page = (path) => {
    switch (path) {
      case '/': return body('픽스처 상점', '<p>동네 문구점입니다. 평일 10시부터 19시까지 엽니다.</p><p><a href="/pricing">요금 보기</a></p>')
      case '/pricing': return body('요금 안내', '<p>월 9,900원(VAT 포함). 언제든 해지할 수 있습니다.</p>')
      case '/privacy': return body('개인정보 처리방침', '<p>수집 항목과 보관 기간을 안내합니다.</p>')
      case '/thanks': return body('신청 완료', '<p>신청이 접수되었습니다.</p>', { noindex: true })
      case '/heavy-hero': return body('큰 히어로', '<img src="/hero-big.jpg" width="2400" height="1600" alt="가게 전경" style="width:100%;height:auto;display:block"><p>가게 전경 사진입니다.</p>')
      case '/shift': return body('늦게 뜨는 배너', '<p>본문이 먼저 그려집니다. 아래 문단은 늦게 끼어드는 배너 때문에 밀립니다.</p><p style="font-size:24px">밀리는 큰 문단입니다. 밀리는 큰 문단입니다. 밀리는 큰 문단입니다. 밀리는 큰 문단입니다.</p>', {
        extraScript: `<script nonce="__NONCE__">setTimeout(function(){var d=document.createElement('div');d.style.cssText='height:200px;background:#fde68a;padding:16px';d.textContent='프로모션 배너';var m=document.querySelector('main');m.insertBefore(d,m.firstChild)},400)</script>`,
      })
      case '/unload': return body('나갈 때 정리', '<p>이 쪽은 unload 처리기를 답니다.</p>', { extraScript: `<script nonce="__NONCE__">window.addEventListener('unload',function(){})</script>` })
      default: return null
    }
  }

  const sitemapRoutes = () => ['/', '/pricing', '/privacy', '/heavy-hero', '/shift', '/unload'].filter((r) => !(b('sitemap-missing-route') && r === '/pricing')).concat(b('sitemap-noindex') ? ['/thanks'] : [])

  const nonceOf = () => (b('csp-static-nonce') ? staticNonce : Buffer.from(`${Math.random()}-${Date.now()}`).toString('base64').replace(/=/g, ''))

  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname
    hits.push({ method: req.method, path })
    const send = (status, headers, data) => { res.writeHead(status, headers); res.end(data) }
    if (path === '/ingest') { req.resume(); return send(204, {}) }
    if (assets.has(path)) {
      const [type, buf] = assets.get(path)
      return buf ? send(200, { 'content-type': type, 'cache-control': 'public, max-age=3600' }, buf) : send(404, {}, 'no')
    }
    if (path === '/manifest.webmanifest') return b('no-manifest') ? send(404, {}, 'no') : send(200, { 'content-type': 'application/manifest+json' }, manifest)
    if (path === '/sitemap.xml') {
      const urls = sitemapRoutes().map((r) => `<url><loc>${PROD}${r}</loc></url>`).join('')
      return send(200, { 'content-type': 'application/xml' }, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`)
    }
    if (path === '/robots.txt') return send(200, { 'content-type': 'text/plain' }, `User-agent: *\nAllow: /\n${b('robots-no-sitemap') ? '' : `Sitemap: ${PROD}/sitemap.xml\n`}`)
    if (path === '/privacy' && b('legal-404')) return send(404, headerSet('x', '<html><body>없음</body></html>'), '<html><body>없음</body></html>')
    const html = page(path)
    const nonce = nonceOf()
    const out = (status, raw) => { const text = render(raw, nonce); return send(status, headerSet(nonce, text), text) }
    if (html !== null) return out(200, html)
    if (b('error-soft-200')) return out(200, body('페이지를 찾을 수 없어요', '<p><a href="/">홈으로</a></p>'))
    if (b('error-default')) return send(404, headerSet(nonce, NOT_FOUND_DEFAULT), NOT_FOUND_DEFAULT)
    return out(404, body('페이지를 찾을 수 없어요', '<p>주소가 바뀌었거나 없어졌어요.</p><p><a href="/">홈으로 가기</a></p>'))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  return {
    origin, siteDir, hits,
    close: () => new Promise((r) => {
      server.closeAllConnections?.()
      server.close(() => { rmSync(siteDir, { recursive: true, force: true }); r() })
    }),
  }
}
