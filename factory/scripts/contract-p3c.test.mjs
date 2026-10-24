// 계약 포트 추가(p3-3c): 후기·검색·뉴스레터·내 신청 내역 목과 티켓식 올리기 타입. 판은 그대로 2다(EVENTS·CONTRACT_VERSION 불변).
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/contract-p3c.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'contract-p3c-test')
const js = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const out = js(readFileSync(file, 'utf8')).replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) =>
    `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
  assert.doesNotMatch(out, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다(타입 import 여야 한다)`)
  const path = join(OUT, `${name}.mjs`)
  writeFileSync(path, out)
  return path
}
const load = (name) => import(pathToFileURL(transpile(join(DIR, `${name}.ts`), name)).href)
const mock = await load('adapter-mock')
const events = await load('events')

const stuck = (p, ms) => Promise.race([p.then(() => false), new Promise((r) => setTimeout(() => r(true), ms))])

test('판 번호와 EVENTS 는 그대로다 — 포트 타입만 더했다', () => {
  assert.equal(events.CONTRACT_VERSION, 2)
  assert.equal(events.EVENTS.length, new Set(events.EVENTS).size)
  const ports = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  for (const t of ['interface ReviewsPort', 'interface SearchPort', 'interface NewsletterPort', 'interface MyRequestsPort']) assert.ok(ports.includes(t), `${t} 가 없다`)
  // upload 는 그대로, 새 메서드는 선택
  assert.match(ports, /upload\(file: File \| Blob, opts: \{ kind: StorageKind \}\): Promise<ActionResult<\{ url: string; key: string \}>>/)
  assert.match(ports, /\n  createTicket\?\(/)
  assert.match(ports, /\n  complete\?\(/)
  assert.doesNotMatch(ports, /^import (?!type)/m, 'ports.ts 는 타입만 부른다(런타임 import 없음)')
})

test('Review·RatingSummary 계약 타입은 블록 조각 review-kit 과 같은 필드를 가진다(계약은 블록을 부르지 않는다)', () => {
  const ports = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  const kit = readFileSync(join(root, 'registry', 'factory', 'blocks', '_shared', 'review-kit.tsx'), 'utf8')
  const fields = (src, name) => {
    const m = src.match(new RegExp(`(?:interface ${name} |type ${name} = )\\{([\\s\\S]*?)\\n\\}`))
    assert.ok(m, `${name} 를 찾지 못했다`)
    // 최상위 칸 이름만(중첩 객체 안은 세지 않는다)
    let depth = 0
    const out = []
    for (const line of m[1].split('\n')) {
      const t = line.trim()
      if (depth === 0) { const f = t.match(/^([a-zA-Z]+)\??:/); if (f) out.push(f[1]) }
      for (const ch of t.replace(/\/\/.*$/, '')) { if (ch === '{') depth++; if (ch === '}') depth-- }
    }
    return out.sort()
  }
  // 사진 칸(photos)은 content 타입(ImageSlot)이라 계약에 두지 않는다 — 나머지는 같다
  assert.deepEqual(fields(ports, 'Review'), fields(kit, 'Review').filter((f) => f !== 'photos'))
  assert.deepEqual(fields(ports, 'RatingSummary'), fields(kit, 'RatingSummary'))
  assert.doesNotMatch(ports, /blocks\/_shared/)
})

// ── 후기 ──
const SUBJECT = { subjectType: 'product', subjectId: 'example-1' }

test('mockReviews: 시드 후기 목록·요약(분포 합 = count, avg 한 자리)·정렬·별점 거르기·쪽 나누기', async () => {
  const p = mock.mockReviews('')
  const r = await p.list(SUBJECT)
  assert.equal(r.ok, true)
  assert.equal(r.data.kind, 'review')
  assert.ok(r.data.items.length >= 3)
  const dist = Object.values(r.data.summary.distribution).reduce((a, b) => a + b, 0)
  assert.equal(dist, r.data.summary.count)
  assert.equal(r.data.summary.count, r.data.total)
  assert.equal(r.data.summary.avg, Math.round(r.data.summary.avg * 10) / 10)
  assert.match(r.data.summary.asOf, /^\d{4}-\d{2}-\d{2}$/)
  for (const it of r.data.items) assert.match(it.date, /^\d{4}-\d{2}-\d{2}$/)
  const low = await p.list({ ...SUBJECT, sort: 'rating_asc' })
  assert.ok(low.data.items[0].rating <= low.data.items.at(-1).rating)
  const only5 = await p.list({ ...SUBJECT, rating: 5 })
  assert.ok(only5.data.items.every((i) => i.rating === 5))
  assert.equal(only5.data.summary.count, r.data.summary.count, '요약은 거르기와 무관한 전체다')
  const paged = await p.list({ ...SUBJECT, pageSize: 2, page: 2 })
  assert.equal(paged.data.page, 2)
  assert.equal(paged.data.pageCount, Math.ceil(r.data.total / 2))
  const other = await p.list({ subjectType: 'product', subjectId: 'nothing' })
  assert.equal(other.data.items.length, 0)
  assert.equal(other.data.summary.count, 0)
})

test('mockReviews submit: 별점·본문 검사, 같은 대상에 후기 한 번, 문의는 별점 없이, 목록에 반영된다. 사전 검수는 pending 이라 아직 안 보인다', async () => {
  const p = mock.mockReviews('')
  const before = (await p.list(SUBJECT)).data.total
  const noRating = await p.submit({ ...SUBJECT, body: '좋아요' })
  assert.equal(noRating.ok, false)
  assert.ok(noRating.fieldErrors.rating)
  const noBody = await p.submit({ ...SUBJECT, rating: 5, body: '  ' })
  assert.ok(noBody.fieldErrors.body)
  const ok = await p.submit({ ...SUBJECT, rating: 4, body: '잘 쓰고 있어요' })
  assert.deepEqual([ok.ok, ok.data.status], [true, 'published'])
  const after = await p.list(SUBJECT)
  assert.equal(after.data.total, before + 1)
  assert.equal(after.data.summary.count, before + 1)
  const dup = await p.submit({ ...SUBJECT, rating: 3, body: '또 써요' })
  assert.equal(dup.ok, false)
  assert.ok(dup.fieldErrors.body)
  const q = await p.submit({ ...SUBJECT, kind: 'question', body: '크기가 어떻게 되나요?' })
  assert.equal(q.ok, true)
  const ql = await p.list({ ...SUBJECT, kind: 'question' })
  assert.equal(ql.data.kind, 'question')
  assert.ok(ql.data.items.some((i) => i.body.startsWith('크기가')))
  assert.equal('summary' in ql.data, false)
  const pre = mock.mockReviews('', { moderation: 'before' })
  const n = (await pre.list(SUBJECT)).data.total
  const pending = await pre.submit({ ...SUBJECT, rating: 5, body: '검수 대기' })
  assert.equal(pending.data.status, 'pending')
  assert.equal((await pre.list(SUBJECT)).data.total, n)
})

test('포트 목 공통 쿼리: ?state=empty|error|loading, ?submit=rate-limited 가 후기·검색·내 신청 내역에 똑같이 듣는다', async () => {
  assert.deepEqual((await mock.mockReviews('?state=empty').list(SUBJECT)).data.items, [])
  assert.equal((await mock.mockReviews('?state=error').list(SUBJECT)).retryable, true)
  assert.equal(await stuck(mock.mockReviews('?state=loading').list(SUBJECT), 30), true)
  const rl = await mock.mockReviews('?submit=rate-limited').submit({ ...SUBJECT, rating: 5, body: 'x' })
  assert.deepEqual([rl.ok, rl.code, rl.retryable], [false, 'rate_limited', true])
  assert.equal((await mock.mockSearch('?state=error').search({ q: '청소기' })).ok, false)
  assert.equal((await mock.mockMyRequests('?state=error').list()).ok, false)
})

// ── 검색 ──
test('mockSearch: 부분 문자열(「청소기」가 「무선청소기」에 맞음)·AND·제목 가중·범위 배열(HTML 아님)·빈 질의는 빈 결과', async () => {
  const p = mock.mockSearch('')
  const r = await p.search({ q: '청소기' })
  assert.equal(r.ok, true)
  assert.ok(r.data.total >= 1)
  const hit = r.data.items[0]
  for (const k of ['kind', 'ref', 'title', 'url', 'snippet']) assert.ok(k in hit, k)
  assert.equal('html' in hit.snippet, false)
  assert.ok(hit.snippet.ranges.length >= 1)
  for (const [s, e] of hit.snippet.ranges) {
    assert.ok(0 <= s && s < e && e <= hit.snippet.text.length)
    assert.ok(hit.snippet.text.slice(s, e).includes('청소기'))
  }
  // AND: 없는 낱말이 하나라도 있으면 맞지 않는다
  assert.equal((await p.search({ q: '청소기 존재하지않는낱말' })).data.total, 0)
  // 제목에 맞은 것이 본문만 맞은 것보다 앞선다
  const t = await p.search({ q: '배송' })
  assert.ok(t.data.items.length >= 2)
  assert.ok(/배송/.test(t.data.items[0].title))
  // 빈 질의·공백 질의는 오류가 아니라 빈 결과
  for (const q of ['', '   ']) {
    const e = await p.search({ q })
    assert.deepEqual([e.ok, e.data.total, e.data.items.length], [true, 0, 0])
  }
  // kinds 로 좁히기 · 쪽 나누기
  const onlyPost = await p.search({ q: '청소기', kinds: ['post'] })
  assert.ok(onlyPost.data.items.every((i) => i.kind === 'post'))
  const one = await p.search({ q: '청소기', pageSize: 1, page: 1 })
  assert.equal(one.data.items.length, 1)
  assert.equal(one.data.pageCount, one.data.total)
})

// ── 뉴스레터 ──
test('mockNewsletter: 동의(true)·이메일 검사, 성공은 확인 메일 보냄, 같은 주소를 또 넣어도 같은 응답(존재 여부를 알리지 않음)', async () => {
  const p = mock.mockNewsletter('')
  const noConsent = await p.subscribe({ email: 'kim@example.com', consent: false })
  assert.equal(noConsent.ok, false)
  assert.ok(noConsent.fieldErrors.consent)
  const bad = await p.subscribe({ email: 'not-an-email', consent: true })
  assert.ok(bad.fieldErrors.email)
  const a = await p.subscribe({ email: 'kim@example.com', consent: true, source: 'footer' })
  const b = await p.subscribe({ email: 'KIM@example.com', consent: true })
  assert.deepEqual(a, { ok: true, data: { confirmationSent: true } })
  assert.deepEqual(b, a)
  const rl = await mock.mockNewsletter('?submit=rate-limited').subscribe({ email: 'kim@example.com', consent: true })
  assert.equal(rl.code, 'rate_limited')
})

// ── 내 신청 내역 ──
test('mockMyRequests: 접수 번호·종류·상태·접수일·미리보기(40자 이하), 쪽 나누기, ?auth=signed-out 이면 sign_in_required', async () => {
  const p = mock.mockMyRequests('')
  const r = await p.list()
  assert.equal(r.ok, true)
  assert.ok(r.data.items.length >= 1)
  for (const it of r.data.items) {
    assert.deepEqual(Object.keys(it).sort(), ['kind', 'preview', 'receivedAt', 'reference', 'status'])
    assert.ok(['received', 'in_progress', 'done'].includes(it.status))
    assert.ok([...it.preview].length <= 41, '앞 40자(+말줄임 한 글자)')
  }
  const paged = await p.list({ pageSize: 1, page: 2 })
  assert.equal(paged.data.items.length, 1)
  assert.equal(paged.data.page, 2)
  assert.equal(paged.data.pageCount, r.data.total)
  const out = await mock.mockMyRequests('?auth=signed-out').list()
  assert.deepEqual([out.ok, out.code, out.retryable], [false, 'sign_in_required', false])
})

test('mockStorage: upload 는 그대로이고, 티켓식 올리기(createTicket → complete)도 구현한다', async () => {
  const s = mock.mockStorage('')
  const r = await s.upload(new Blob(['x']), { kind: 'image' })
  assert.equal(r.ok, true)
  assert.equal(typeof s.createTicket, 'function')
  assert.equal(typeof s.complete, 'function')
})

test('mockStorage 티켓: 정책 표로 검사하고(종류·형식·크기·로그인), 티켓 모양은 포트와 같다', async () => {
  const s = mock.mockStorage('')
  const ok = await s.createTicket({ kind: 'image', contentType: 'IMAGE/PNG', size: 1000, fileName: '../x.png' })
  assert.equal(ok.ok, true)
  assert.deepEqual(Object.keys(ok.data).sort(), ['expiresAt', 'headers', 'id', 'key', 'maxBytes', 'method', 'url'])
  assert.equal(ok.data.method, 'PUT')
  assert.deepEqual(ok.data.headers, { 'content-type': 'image/png' })
  assert.equal(ok.data.maxBytes, 5 * 1024 * 1024)
  assert.equal(ok.data.expiresAt, '2026-10-01T00:15:00.000Z')
  assert.ok(!ok.data.key.includes('x.png'), '사용자 파일 이름은 키에 넣지 않는다')
  const other = await s.createTicket({ kind: 'attachment', contentType: 'application/pdf', size: 10, })
  assert.notEqual(other.data.id, ok.data.id, '티켓마다 번호가 는다')

  const badKind = await s.createTicket({ kind: 'video', contentType: 'video/mp4', size: 1 })
  assert.deepEqual([badKind.ok, Object.keys(badKind.fieldErrors)], [false, ['kind']])
  const badType = await s.createTicket({ kind: 'avatar', contentType: 'application/pdf', size: 1 })
  assert.deepEqual([badType.ok, Object.keys(badType.fieldErrors)], [false, ['contentType']])
  const tooBig = await s.createTicket({ kind: 'avatar', contentType: 'image/png', size: 2 * 1024 * 1024 + 1 })
  assert.deepEqual([tooBig.ok, Object.keys(tooBig.fieldErrors)], [false, ['size']])
  assert.match(tooBig.fieldErrors.size[0], /2MB/)
  for (const size of [0, -1, 1.5, Number.NaN]) assert.deepEqual(Object.keys((await s.createTicket({ kind: 'image', contentType: 'image/png', size })).fieldErrors), ['size'], String(size))

  const out = mock.mockStorage('?auth=signed-out')
  const avatar = await out.createTicket({ kind: 'avatar', contentType: 'image/png', size: 10 })
  assert.deepEqual([avatar.ok, avatar.code, avatar.retryable], [false, 'sign_in_required', false])
  assert.equal((await out.createTicket({ kind: 'image', contentType: 'image/png', size: 10 })).ok, true, '로그인이 필요 없는 종류는 로그아웃에서도 된다')
  const failing = await mock.mockStorage('?submit=server-error').createTicket({ kind: 'image', contentType: 'image/png', size: 10 })
  assert.deepEqual([failing.ok, failing.retryable], [false, true])
})

test('mockStorage complete: 받은 티켓만 끝내고 두 번 불러도 같다 · 비공개 종류는 짧게 열리는 주소', async () => {
  const s = mock.mockStorage('')
  const t = await s.createTicket({ kind: 'image', contentType: 'image/png', size: 10 })
  const done = await s.complete({ id: t.data.id })
  assert.deepEqual([done.ok, done.data.key], [true, t.data.key])
  assert.deepEqual(await s.complete({ id: t.data.id }), done)
  const priv = await s.createTicket({ kind: 'attachment', contentType: 'application/pdf', size: 10 })
  const pdone = await s.complete({ id: priv.data.id })
  assert.match(pdone.data.url, /^#mock-download\/.+\?expires=2026-10-01T00:15:00\.000Z$/)
  const unknown = await s.complete({ id: 'mock-upload-999' })
  assert.deepEqual([unknown.ok, unknown.code, unknown.retryable], [false, 'not_found', false])
  assert.equal((await mock.mockStorage('').complete({ id: t.data.id })).code, 'not_found', '다른 포트가 낸 티켓은 모른다(상태는 포트 하나 안에만 있다)')
  const custom = mock.mockStorage('', { url: (kind, n) => `https://cdn.test/${kind}/${n}` })
  const c = await custom.createTicket({ kind: 'image', contentType: 'image/webp', size: 5 })
  assert.equal((await custom.complete({ id: c.data.id })).data.url, 'https://cdn.test/image/1')
})
