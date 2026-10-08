// hours-location 「지금 영업 중」 판정(P3-2 Task 6 Step 8). 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/blocks-open-now.test.mjs
// 공유 조각 registry/factory/blocks/_shared/open-now.tsx 의 순수 함수 openNow(hours, now)를 typescript transpileModule 로 옮겨 부른다(브라우저 없음).
// 시각은 모두 UTC 로 적고 서울 시각(+9)을 주석에 둔다 — 판정이 방문자 시간대가 아니라 Asia/Seoul 로 고정됐는지 함께 본다.
// 기준 달력: 2026-09-28 월 · 29 화 · 30 수 · 10-01 목 · 10-02 금 · 10-03 토 · 10-04 일.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'blocks-open-now-test')
const loaded = new Map()
function transpile(abs) {
  if (abs.endsWith('.mjs')) return abs
  if (loaded.has(abs)) return loaded.get(abs)
  const out = join(OUT, relative(root, abs).replace(/\.tsx?$/, '.mjs'))
  loaded.set(abs, out)
  let { outputText } = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  outputText = outputText.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])@\/([^"']+)\2/g, (_, kw, q, p) => {
    const base = join(root, p)
    const src = [base, `${base}.ts`, `${base}.tsx`].find((f) => existsSync(f) && /\.(mjs|tsx?)$/.test(f))
    if (!src) throw new Error(`import 대상 없음: @/${p}`)
    return `${kw}${q}${pathToFileURL(transpile(src)).href}${q}`
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, outputText)
  return out
}
const { openNow, seoulClock, openStatusText } = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'blocks', '_shared', 'open-now.tsx'))).href)
const { OpeningHours, safeParseContent } = await import(pathToFileURL(transpile(join(root, 'registry', 'factory', 'content', 'content-core.ts'))).href)

// 예시 가게: 월 휴무 · 화~목 10~20 (쉬는 시간 14~15) · 금 18~익일 02 · 토 20~익일 04 (쉬는 시간 익일 01:00~01:30) · 일 휴무.
const HOURS = [
  { day: 'tu', opens: '10:00', closes: '20:00', breaks: [{ start: '14:00', end: '15:00' }] },
  { day: 'we', opens: '10:00', closes: '20:00', breaks: [{ start: '14:00', end: '15:00' }] },
  { day: 'th', opens: '10:00', closes: '24:00' },
  { day: 'fr', opens: '18:00', closes: '02:00', overnight: true },
  { day: 'sa', opens: '20:00', closes: '04:00', overnight: true, breaks: [{ start: '01:00', end: '01:30' }] },
]
const at = (iso) => new Date(iso)

test('예시 영업시간은 콘텐츠 스키마를 통과한다(검사와 같은 해석)', () => {
  assert.equal(safeParseContent(OpeningHours, HOURS).success, true)
})

test('서울 시각으로 고정: UTC 자정 근처도 서울 요일·분으로 읽는다', () => {
  assert.deepEqual(seoulClock(at('2026-09-28T16:30:00Z')), { day: 'tu', minutes: 90 }) // 서울 화 01:30
  assert.deepEqual(seoulClock(at('2026-09-29T03:30:00Z')), { day: 'tu', minutes: 750 }) // 서울 화 12:30
  assert.deepEqual(seoulClock(at('2026-09-27T15:00:00Z')), { day: 'mo', minutes: 0 }) // 서울 월 00:00
})

test('자정을 넘는 영업(overnight): 여는 날 밤과 다음 날 새벽 모두 영업 중, 닫는 시각에는 닫힘', () => {
  // 금 23:00 → 영업 중, 익일 02:00 에 닫는다
  let s = openNow(HOURS, at('2026-10-02T14:00:00Z'))
  assert.equal(s.state, 'open')
  assert.deepEqual(s.closesAt, { time: '02:00', nextDay: true })
  // 토 01:59 → 금요일 영업이 이어진다(오늘 기준으로는 오늘 닫는다)
  s = openNow(HOURS, at('2026-10-02T16:59:00Z'))
  assert.equal(s.state, 'open')
  assert.equal(s.today, 'sa')
  assert.deepEqual(s.closesAt, { time: '02:00', nextDay: false })
  // 토 02:00 → 닫힘, 오늘 20:00 에 연다
  s = openNow(HOURS, at('2026-10-02T17:00:00Z'))
  assert.equal(s.state, 'closed')
  assert.deepEqual(s.opensAt, { day: 'sa', time: '20:00', inDays: 0 })
  // 금 17:59 → 영업 전
  s = openNow(HOURS, at('2026-10-02T08:59:00Z'))
  assert.equal(s.state, 'closed')
  assert.deepEqual(s.opensAt, { day: 'fr', time: '18:00', inDays: 0 })
  // 목 23:59 → 24:00 에 닫는 영업은 자정 전까지 영업 중(다음 날 아님)
  s = openNow(HOURS, at('2026-10-01T14:59:00Z'))
  assert.equal(s.state, 'open')
  assert.deepEqual(s.closesAt, { time: '24:00', nextDay: false })
})

test('휴게 시간(breaks): [시작, 끝) — 시작 시각부터 쉬고 끝 시각에 다시 연다, 자정 뒤 쉬는 시간도 본다', () => {
  assert.equal(openNow(HOURS, at('2026-09-29T04:59:00Z')).state, 'open') // 화 13:59
  const s = openNow(HOURS, at('2026-09-29T05:00:00Z')) // 화 14:00
  assert.equal(s.state, 'break')
  assert.equal(s.resumesAt, '15:00')
  assert.equal(openNow(HOURS, at('2026-09-29T05:59:00Z')).state, 'break') // 화 14:59
  assert.equal(openNow(HOURS, at('2026-09-29T06:00:00Z')).state, 'open') // 화 15:00
  // 토 20:00~익일 04:00 의 익일 01:00~01:30 — 일 01:15 는 쉬는 시간, 01:30 은 영업 중(일요일은 휴무일인데 전날 영업이 이어진다)
  const b = openNow(HOURS, at('2026-10-03T16:15:00Z'))
  assert.equal(b.state, 'break')
  assert.equal(b.resumesAt, '01:30')
  assert.equal(b.closedToday, true)
  const o = openNow(HOURS, at('2026-10-03T16:30:00Z'))
  assert.equal(o.state, 'open')
  assert.deepEqual(o.closesAt, { time: '04:00', nextDay: false })
})

test('휴무일: 목록에 없는 요일은 닫힘 — 다음 여는 요일(며칠 뒤)을 찾는다', () => {
  // 월 12:00 → 오늘 휴무, 내일(화) 10:00
  let s = openNow(HOURS, at('2026-09-28T03:00:00Z'))
  assert.equal(s.state, 'closed')
  assert.equal(s.closedToday, true)
  assert.deepEqual(s.opensAt, { day: 'tu', time: '10:00', inDays: 1 })
  // 일 12:00 → 오늘 휴무, 월도 휴무라 화 10:00(이틀 뒤)
  s = openNow(HOURS, at('2026-10-04T03:00:00Z'))
  assert.equal(s.closedToday, true)
  assert.deepEqual(s.opensAt, { day: 'tu', time: '10:00', inDays: 2 })
  // 일 04:00 → 토요일 영업이 04:00 에 끝났다 — 닫힘
  assert.equal(openNow(HOURS, at('2026-10-03T19:00:00Z')).state, 'closed')
  // 화 20:30 → 닫는 시각 뒤, 내일(수) 10:00
  s = openNow(HOURS, at('2026-09-29T11:30:00Z'))
  assert.equal(s.closedToday, false)
  assert.deepEqual(s.opensAt, { day: 'we', time: '10:00', inDays: 1 })
})

test('문구: 상태마다 copy 틀을 채운다', () => {
  const copy = { open: '영업 중', break: '쉬는 시간', closed: '지금은 닫았어요', closedToday: '오늘 휴무', closesAt: '{time}에 닫아요', closesNextDay: '익일 {time}에 닫아요', resumesAt: '{time}에 다시 열어요', opensToday: '오늘 {time}에 열어요', opensTomorrow: '내일 {time}에 열어요', opensOn: '{day}요일 {time}에 열어요' }
  const days = { mo: '월', tu: '화', we: '수', th: '목', fr: '금', sa: '토', su: '일' }
  assert.deepEqual(openStatusText(openNow(HOURS, at('2026-10-02T14:00:00Z')), copy, days), ['영업 중', '익일 02:00에 닫아요'])
  assert.deepEqual(openStatusText(openNow(HOURS, at('2026-09-29T05:00:00Z')), copy, days), ['쉬는 시간', '15:00에 다시 열어요'])
  assert.deepEqual(openStatusText(openNow(HOURS, at('2026-09-28T03:00:00Z')), copy, days), ['오늘 휴무', '내일 10:00에 열어요'])
  assert.deepEqual(openStatusText(openNow(HOURS, at('2026-10-04T03:00:00Z')), copy, days), ['오늘 휴무', '화요일 10:00에 열어요'])
  assert.deepEqual(openStatusText(openNow(HOURS, at('2026-10-02T08:59:00Z')), copy, days), ['지금은 닫았어요', '오늘 18:00에 열어요'])
})

// 특수일·공휴일(P3-2 Task 7a, 대장 A105): 판정 순서는 특수일 → 공휴일(정책) → 요일. 2026-09-30 수 · 10-01 목 · 10-02 금 · 10-03 토 · 10-04 일.
test('특수일 휴무: 요일표로는 영업 중인 수요일도 특수일이 쉬는 날이면 닫힘 — 이름이 있으면 「오늘은 {이름}이라 쉬어요」, 다음 여는 날은 다음 영업일', () => {
  const wedNoon = at('2026-09-30T03:00:00Z')
  assert.equal(openNow(HOURS, wedNoon).state, 'open', '대조군: 특수일이 없으면 영업 중')
  const s = openNow(HOURS, wedNoon, { special: [{ date: '2026-09-30', label: '임시 휴무', closed: true }] })
  assert.equal(s.state, 'closed')
  assert.equal(s.closedToday, true)
  assert.equal(s.hoursToday, null)
  assert.deepEqual(s.note, { kind: 'special', label: '임시 휴무' })
  assert.deepEqual(s.opensAt, { day: 'th', time: '10:00', inDays: 1 })
  const copy = { open: '영업 중', break: '쉬는 시간', closed: '지금은 닫았어요', closedToday: '오늘 휴무', specialClosed: '오늘은 {label}이라 쉬어요', closesAt: '{time}에 닫아요', closesNextDay: '익일 {time}에 닫아요', resumesAt: '{time}에 다시 열어요', opensToday: '오늘 {time}에 열어요', opensTomorrow: '내일 {time}에 열어요', opensOn: '{day}요일 {time}에 열어요' }
  const days = { mo: '월', tu: '화', we: '수', th: '목', fr: '금', sa: '토', su: '일' }
  assert.deepEqual(openStatusText(s, copy, days), ['오늘은 임시 휴무이라 쉬어요', '내일 10:00에 열어요'])
  // 이름이 없거나 copy 가 없으면 예전 문구
  assert.deepEqual(openStatusText(openNow(HOURS, wedNoon, { special: [{ date: '2026-09-30', closed: true }] }), copy, days)[0], '오늘 휴무')
})

test('특수일 연장·단축 영업: 쉬는 요일에 열고(월 10~14), 열던 날의 시간을 바꾸며(쉬는 시간은 없다), 닫는 시각 뒤에는 닫힘', () => {
  const monSpecial = { special: [{ date: '2026-09-28', label: '특별 영업', opens: '10:00', closes: '14:00' }] }
  let s = openNow(HOURS, at('2026-09-28T03:00:00Z'), monSpecial) // 월 12:00
  assert.equal(s.state, 'open')
  assert.deepEqual(s.closesAt, { time: '14:00', nextDay: false })
  assert.equal(s.closedToday, false)
  assert.equal(openNow(HOURS, at('2026-09-28T06:00:00Z'), monSpecial).state, 'closed') // 월 15:00
  // 화(원래 10~20, 쉬는 시간 14~15)를 11~16 으로 바꾸면 쉬는 시간이 없다
  s = openNow(HOURS, at('2026-09-29T05:30:00Z'), { special: [{ date: '2026-09-29', opens: '11:00', closes: '16:00' }] }) // 화 14:30
  assert.equal(s.state, 'open')
  assert.deepEqual(s.hoursToday && [s.hoursToday.opens, s.hoursToday.closes], ['11:00', '16:00'])
})

test('공휴일 정책: closed 는 쉬고, open·special(특수일 없음)은 요일표대로, 특수일이 같은 날이면 특수일이 이긴다', () => {
  const holidays = [{ date: '2026-10-01', label: '임시 공휴일' }]
  const thuNoon = at('2026-10-01T03:00:00Z')
  const closed = openNow(HOURS, thuNoon, { holidays, holidayPolicy: 'closed' })
  assert.equal(closed.state, 'closed')
  assert.deepEqual(closed.note, { kind: 'holiday', label: '임시 공휴일' })
  assert.equal(openNow(HOURS, thuNoon, { holidays, holidayPolicy: 'open' }).state, 'open')
  assert.equal(openNow(HOURS, thuNoon, { holidays, holidayPolicy: 'special' }).state, 'open')
  assert.equal(openNow(HOURS, thuNoon, { holidays }).state, 'open', '정책을 안 주면 요일표대로')
  const both = { holidays, holidayPolicy: 'closed', special: [{ date: '2026-10-01', opens: '11:00', closes: '16:00' }] }
  assert.equal(openNow(HOURS, thuNoon, both).state, 'open', '같은 날 특수일이 공휴일 정책보다 우선')
  assert.equal(openNow(HOURS, at('2026-10-01T09:00:00Z'), both).state, 'closed', '특수일 닫는 시각(16시) 뒤')
})

test('특수일 연휴: 다음 여는 날은 쉬는 날들을 건너뛴다 · 특수일로 쉬는 금요일의 밤샘 영업은 토요일 새벽에 이어지지 않는다', () => {
  const special = [{ date: '2026-09-30', closed: true }, { date: '2026-10-01', closed: true }, { date: '2026-10-02', closed: true }]
  const s = openNow(HOURS, at('2026-09-30T03:00:00Z'), { special }) // 수 12:00
  assert.deepEqual(s.opensAt, { day: 'sa', time: '20:00', inDays: 3 })
  // 금 18:00~익일 02:00 밤샘. 대조군: 특수일이 없으면 토 01:00(서울)에 영업 중, 금이 특수 휴무면 닫힘
  const satOne = at('2026-10-02T16:00:00Z')
  assert.equal(openNow(HOURS, satOne).state, 'open')
  assert.equal(openNow(HOURS, satOne, { special: [{ date: '2026-10-02', closed: true }] }).state, 'closed')
})
