// 마케팅 사이트 관문(marketing-site.mjs)의 음성 대조 표·픽스처 서버.
// 픽스처 사이트는 `fixtures/marketing-site/<이름>/` 의 진짜 HTML 이다. `good` 은 통과하는 다섯 쪽짜리 사이트(가입 2쪽 · 해지 2쪽 · 문의 폼 · 법정 쪽)이고,
// 나머지는 `good` 위에 「바꾼 쪽만」 얹은 겹침(overlay)이다 — 딱 한 곳만 어기게 만들어 그 규칙만 실패하는지 본다.
// buildSite(이름, 출력 폴더) 가 good + 겹침을 합쳐 서빙할 폴더를 만들고, serveSite(폴더) 가 작은 node 서버를 띄운다:
//   GET 쪽 경로(`/a/b` → a/b.html 또는 a/b/index.html) · POST /api/receive → 200(받은 것을 기록) · POST /api/fail → 500.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import http from 'node:http'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const SITES_DIR = join(here, 'fixtures', 'marketing-site')

/**
 * 음성 대조 표. rule = 어겨야 하는 사이트 규칙 id, expect = 그 규칙의 상태. only = 사이트 규칙 중 이 규칙만 어긴다(기본 true).
 * pageFail = 쪽 단위 marketing-gate 가 함께 어기는 규칙(있다면 `page:쪽:규칙` — 사이트 단위 흐름이 어긋난 쪽이 쪽 단위 규칙도 어기는 것은 정상이다).
 */
export const VARIANTS = [
  { name: 'cancel-long', rule: 'flow-cancel-le-signup', expect: 'fail', why: '해지가 /account → /cancel/why → /cancel/offer → /cancel/confirm → /cancel/done 로 나뉜다 — 클릭 4 > 가입 2', pageFail: ['page:/cancel/why:cancel-steps', 'page:/cancel/offer:cancel-steps', 'page:/cancel/confirm:cancel-steps', 'page:/cancel/done:cancel-steps'] },
  { name: 'cancel-stuck', rule: 'flow-reach', expect: 'fail', why: '해지 진행 링크가 눌러도 안 넘어간다(죽은 버튼)', pageFail: ['page:/cancel:cancel-steps'] },
  { name: 'form-fake-success', rule: 'conv-reaches-receiver', expect: 'fail', why: '화면에서만 「접수했어요」를 그린다 — 전선에 나간 요청이 없다' },
  { name: 'form-receiver-500', rule: 'conv-reaches-receiver', expect: 'fail', why: '수신 경로가 500 으로 답하는데 화면은 완료라고 한다' },
  { name: 'form-no-confirmation', rule: 'conv-confirmation', expect: 'fail', why: '수신은 되는데 확인 글(role=status)이 없다' },
  { name: 'form-mailto-action', rule: 'conv-no-mailto-action', expect: 'fail', why: '<form action="mailto:…"> (제출 처리는 되지만 주 제출이 mailto 다)' },
  { name: 'tone-cta-mixed', rule: 'tone-cta-mixed', expect: 'fail', why: '한 쪽 안 CTA 가 해요체(무료로 시작해요)와 합쇼체(지금 문의합니다)를 섞는다' },
  { name: 'tone-page-mixed', rule: 'tone-page-mixed', expect: 'warn', why: '본문이 해요체와 합쇼체를 섞는다(CTA 는 그대로)' },
]
/** 둘 이상 규칙을 함께 어기는 시험용 사이트(규칙별 「그것만」 표에는 못 넣는다). */
export const MULTI = [
  { name: 'form-dead', rules: ['conv-reaches-receiver', 'conv-confirmation'], why: '제출해도 아무 일도 안 한다(요청도 확인 글도 없다)' },
]
/** 양성 대조: 이렇게 바꿔도 실패·경고 0. */
export const PASSING = [
  { name: 'good', why: '기준 사이트 — 합쇼체 후기 인용·합쇼체 법정 문구·합쇼체 법정 쪽이 있어도 통과(제외 규칙)' },
  { name: 'signup-declared', why: '가입이 입력 폼이라 눌러 걸을 수 없다 → 선언한 단계 수로 센다(clicks = steps − 1)' },
  { name: 'form-native-get', why: '자바스크립트 없이 GET 폼이 확인 쪽으로 이동한다 — 폼 이동 갈고리 + 이동한 쪽의 확인 글' },
]

/** 사이트 하나를 out/<이름> 에 만든다(good 복사 → 겹침). 반환: 폴더. */
export function buildSite(name, out) {
  const dir = join(out, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  cpSync(join(SITES_DIR, 'good'), dir, { recursive: true })
  if (name !== 'good') {
    const overlay = join(SITES_DIR, name)
    if (!existsSync(overlay)) throw new Error(`픽스처 사이트가 없다: ${name}`)
    cpSync(overlay, dir, { recursive: true })
  }
  return dir
}
export const siteNames = () => readdirSync(SITES_DIR).filter((n) => statSync(join(SITES_DIR, n)).isDirectory())
export const sitemapOf = (dir) => JSON.parse(readFileSync(join(dir, 'sitemap.json'), 'utf8'))

/** 작은 서버. 반환 { origin, received[], stop() }. received = /api/receive 로 온 본문들. */
export async function serveSite(dir) {
  const root = resolve(dir)
  const received = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (req.method === 'POST' && (url.pathname === '/api/receive' || url.pathname === '/api/fail')) {
      let body = ''
      req.on('data', (d) => { body += d })
      req.on('end', () => {
        if (url.pathname === '/api/receive') received.push(body)
        res.writeHead(url.pathname === '/api/fail' ? 500 : 200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: url.pathname === '/api/receive' }))
      })
      return
    }
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/index'
    const cands = [path === '/index' ? 'index.html' : `${path.slice(1)}.html`, `${path.slice(1)}/index.html`]
    const file = cands.map((c) => resolve(root, c)).find((f) => f.startsWith(root + sep) && existsSync(f) && statSync(f).isFile())
    if (!file) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('없는 쪽'); return }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(readFileSync(file))
  })
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    received,
    stop: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(() => ok()) }),
  }
}
