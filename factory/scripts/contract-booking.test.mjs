// 예약 계약(계약 판 2 안의 선택 추가 — sitebrew v0.2.0 계획 3b): BookingPort 타입, 실패 코드·이벤트 이름 추가, adapter-mock 의 mockBooking 동작.
// 판 번호는 그대로 2다(이름을 바꾸거나 뺀 것이 없다). 어댑터 적합성 묶음의 예약 쪽은 conformance.test.mjs 가 본다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/contract-booking.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'contract-booking-test')
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

const CONTACT = 'kim@example.com'
const FROM = '2026-10-05'
const never = (p, ms = 40) => Promise.race([p.then(() => false), new Promise((r) => setTimeout(() => r(true), ms))])
const firstOpen = async (port, from = FROM) => {
  const r = await port.slots({ service: 'consult', from })
  return r.data.days.flatMap((d) => d.slots).find((s) => s.available > 0)
}
const bookOne = async (port, startsAt, extra = {}) => port.book({ service: 'consult', startsAt, contact: CONTACT, ...extra })

// ① 판 번호·이름 ─────────────────────────────────────────────────────────────
test('판은 그대로 2다: 예약 이벤트 셋은 EVENTS 에 더해졌고 옛 이벤트는 모두 남았다, props 에 개인정보 칸이 없다', () => {
  assert.equal(events.CONTRACT_VERSION, 2)
  assert.equal(new Set(events.EVENTS).size, events.EVENTS.length)
  for (const e of ['booking_view', 'booking_submit', 'booking_cancel']) assert.ok(events.EVENTS.includes(e), `${e} 가 없다`)
  for (const e of ['page_view', 'cta_click', 'form_submit', 'checkout_complete', 'web_vital', 'app_install']) assert.ok(events.EVENTS.includes(e), `${e} 가 빠졌다`)
  const src = readFileSync(join(DIR, 'events.ts'), 'utf8')
  for (const e of ['booking_view', 'booking_submit', 'booking_cancel']) {
    const body = src.match(new RegExp(`${e}: \\{([^}]*)\\}`))?.[1]
    assert.ok(body, `${e} 의 props 가 없다`)
    assert.doesNotMatch(body, /\b(name|email|phone|contact|reference|note)\b\s*\??:/, `${e}: 개인정보 칸`)
  }
})

test('ActionFailureCode 에 예약 실패 코드가 더해졌다(옛 코드는 그대로) — 코드마다 한 줄 설명이 있다', () => {
  const src = readFileSync(join(DIR, 'block-contract.ts'), 'utf8')
  const union = src.match(/export type ActionFailureCode =([^\n]*)/)[1]
  for (const c of ['slot_taken', 'not_found', 'cancel_closed', 'invalid_state', 'forbidden', 'deposit_failed']) {
    assert.ok(union.includes(`"${c}"`), `${c} 가 유니온에 없다`)
    assert.match(src, new RegExp(`^ \\*   ${c} — `, 'm'), `${c} 설명 줄이 없다`)
  }
  for (const c of ['rate_limited', 'invalid_token', 'confirmation_required', 'provider_unavailable', 'action_failed']) assert.ok(union.includes(`"${c}"`), `${c} 가 빠졌다`)
})

test('BookingPort 는 새 포트다: 메서드 넷은 모두 있고, 기존 포트는 건드리지 않았다', () => {
  const src = readFileSync(join(DIR, 'ports.ts'), 'utf8')
  const body = src.match(/export interface BookingPort \{([\s\S]*?)\n\}/)[1]
  for (const m of ['slots', 'book', 'lookup', 'cancel']) assert.match(body, new RegExp(`\\n  ${m}\\(`), `${m} 가 없다`)
  for (const t of ['BookingSlot', 'BookingReceipt', 'ManagedBooking', 'BookingChange', 'BookingStatus']) assert.match(src, new RegExp(`export (interface|type) ${t}\\b`), `${t} 가 없다`)
  assert.match(src, /"requested" \| "confirmed" \| "cancelled" \| "completed" \| "no_show"/)
})

// ② mockBooking — 칸 ───────────────────────────────────────────────────────────
test('mockBooking: Required<BookingPort>, ?booking= 은 open|full 이고 모르는 값은 던진다', () => {
  assert.deepEqual([...mock.MOCK_BOOKINGS], ['open', 'full'])
  const port = mock.mockBooking('')
  assert.deepEqual(Object.keys(port).sort(), ['book', 'cancel', 'lookup', 'slots'])
  assert.throws(() => mock.mockBooking('?booking=half'), /booking=half/)
})

test('slots: 고정 격자 — from 부터 days(기본 7, 1~14)일, 하루 네 칸(한국 시각 10·11·14·15시), 모두 자리 1, 같은 인자는 같은 결과', async () => {
  const a = await mock.mockBooking('').slots({ service: 'consult', from: FROM })
  const b = await mock.mockBooking('').slots({ service: 'consult', from: FROM })
  assert.deepEqual(a, b)
  assert.equal(a.ok, true)
  assert.deepEqual(a.data.days.map((d) => d.date), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
  assert.deepEqual(a.data.days[0].slots, [
    { startsAt: '2026-10-05T01:00:00.000Z', available: 1 }, { startsAt: '2026-10-05T02:00:00.000Z', available: 1 },
    { startsAt: '2026-10-05T05:00:00.000Z', available: 1 }, { startsAt: '2026-10-05T06:00:00.000Z', available: 1 },
  ])
  assert.equal((await mock.mockBooking('').slots({ service: 'consult', from: FROM, days: 3 })).data.days.length, 3)
  assert.equal((await mock.mockBooking('').slots({ service: 'consult', from: FROM, days: 99 })).data.days.length, 14)
  assert.equal((await mock.mockBooking('').slots({ service: 'consult', from: FROM, days: 0 })).data.days.length, 1)
})

test('slots: 지난 시각은 빼고(MOCK_NOW 기준), 모르는 서비스·틀린 날짜는 칸 오류, 모양은 호출마다 새 객체다', async () => {
  const today = await mock.mockBooking('').slots({ service: 'consult', from: '2026-09-30', days: 2 })
  assert.deepEqual(today.data.days[0].slots, [])
  assert.ok(today.data.days[1].slots.every((s) => s.startsAt > mock.MOCK_NOW))
  const bad = await mock.mockBooking('').slots({ service: 'nope', from: FROM })
  assert.equal(bad.ok, false)
  assert.ok(bad.fieldErrors.service)
  assert.ok((await mock.mockBooking('').slots({ service: 'consult', from: '10/05' })).fieldErrors.from)
  assert.ok((await mock.mockBooking('').slots({ service: 'consult', from: '2026-02-31' })).fieldErrors.from)
  const x = await mock.mockBooking('').slots({ service: 'consult', from: FROM })
  x.data.days[0].slots.length = 0
  assert.equal((await mock.mockBooking('').slots({ service: 'consult', from: FROM })).data.days[0].slots.length, 4)
})

test('?booking=full: 모든 칸이 자리 0이고 예약은 slot_taken 이다(상태 불변)', async () => {
  const port = mock.mockBooking('?booking=full')
  const days = (await port.slots({ service: 'consult', from: FROM })).data.days
  assert.ok(days.flatMap((d) => d.slots).length > 0)
  assert.ok(days.flatMap((d) => d.slots).every((s) => s.available === 0))
  const r = await bookOne(port, days[0].slots[0].startsAt)
  assert.equal(r.ok, false)
  assert.equal(r.code, 'slot_taken')
  assert.equal(r.retryable, false)
  assert.equal(typeof r.formError, 'string')
})

// ③ 예약·조회·취소 ──────────────────────────────────────────────────────────────
test('book: B-숫자 4자리 번호로 확정하고 칸을 잡는다 — 번호는 순서대로, 같은 칸은 두 번 못 잡는다(slot_taken), 취소하면 풀린다', async () => {
  const port = mock.mockBooking('')
  const slot = await firstOpen(port)
  const r = await bookOne(port, slot.startsAt, { partySize: '2', name: '김예시', note: '창가 자리' })
  assert.equal(r.ok, true)
  assert.match(r.data.id, /^B-\d{4}$/)
  assert.deepEqual({ ...r.data, id: 'x', message: 'x' }, { id: 'x', startsAt: slot.startsAt, status: 'confirmed', message: 'x' })
  assert.equal(typeof r.data.message, 'string')
  const again = await bookOne(port, slot.startsAt)
  assert.equal(again.code, 'slot_taken')
  const held = (await port.slots({ service: 'consult', from: FROM })).data.days.flatMap((d) => d.slots).find((s) => s.startsAt === slot.startsAt)
  assert.equal(held.available, 0)
  const second = await bookOne(port, (await firstOpen(port)).startsAt)
  assert.notEqual(second.data.id, r.data.id)
  assert.equal((await port.cancel({ reference: r.data.id, contact: CONTACT })).ok, true)
  assert.equal((await bookOne(port, slot.startsAt)).ok, true)
})

test('book: 시간대 표기가 다른 같은 순간(+09:00)도 같은 칸으로 읽고, 표기가 없거나 격자 밖인 시각·잘못된 입력은 칸 오류다', async () => {
  const port = mock.mockBooking('')
  const r = await bookOne(port, '2026-10-05T10:00:00+09:00')
  assert.equal(r.ok, true)
  assert.equal(r.data.startsAt, '2026-10-05T01:00:00.000Z')
  const bad = [
    [{ startsAt: '2026-10-05T10:00:00' }, 'startsAt'], [{ startsAt: '2026-10-05T10:30:00+09:00' }, 'startsAt'], [{ startsAt: '' }, 'startsAt'],
    [{ contact: '' }, 'contact'], [{ contact: 'not-a-contact' }, 'contact'], [{ service: 'nope' }, 'service'],
    [{ partySize: '0' }, 'partySize'], [{ partySize: '99' }, 'partySize'], [{ partySize: 'two' }, 'partySize'], [{ name: 'a'.repeat(101) }, 'name'], [{ note: 'a'.repeat(1001) }, 'note'],
  ]
  for (const [patch, field] of bad) {
    const x = await port.book({ service: 'consult', startsAt: '2026-10-06T10:00:00+09:00', contact: CONTACT, ...patch })
    assert.equal(x.ok, false, JSON.stringify(patch))
    assert.ok(x.fieldErrors?.[field]?.length, `${JSON.stringify(patch)} → ${field} 칸 오류`)
  }
  assert.equal((await port.book({ service: 'consult', startsAt: '2026-10-06T10:00:00+09:00', contact: '010-1234-5678' })).ok, true, '전화번호 연락처')
})

test('lookup: 번호+연락처(앞뒤 공백·대소문자 무시)가 맞으면 보이고, 틀린 조합은 모두 같은 not_found 다 — 번호 모름·연락처 틀림·빈 칸 아님이 구별되지 않는다', async () => {
  const port = mock.mockBooking('')
  const slot = await firstOpen(port, '2026-10-06')
  const { data: receipt } = await bookOne(port, slot.startsAt, { partySize: '3' })
  const ok = await port.lookup({ reference: ` ${receipt.id.toLowerCase()} `, contact: `  ${CONTACT.toUpperCase()} ` })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.data, {
    id: receipt.id, service: 'consult', serviceName: '상담(예시)', startsAt: slot.startsAt,
    endsAt: new Date(Date.parse(slot.startsAt) + 60 * 60_000).toISOString(), partySize: 3, status: 'confirmed',
    canCancel: true, cancelBy: new Date(Date.parse(slot.startsAt) - 24 * 3_600_000).toISOString(),
  })
  const wrongContact = await port.lookup({ reference: receipt.id, contact: 'other@example.com' })
  const unknownRef = await port.lookup({ reference: 'B-0000', contact: CONTACT })
  const both = await port.lookup({ reference: 'B-0000', contact: 'other@example.com' })
  assert.equal(wrongContact.ok, false)
  assert.equal(wrongContact.code, 'not_found')
  assert.deepEqual(wrongContact, unknownRef)
  assert.deepEqual(unknownRef, both)
  assert.doesNotMatch(JSON.stringify(wrongContact), /B-\d|example\.com/, '실패 문구에 번호·연락처를 되풀이하지 않는다')
})

test('lookup: 빈 번호·빈 연락처는 칸 오류(invalid_input), 연락처는 돌려주는 값에 없다', async () => {
  const port = mock.mockBooking('')
  const r = await port.lookup({ reference: '', contact: CONTACT })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'invalid_input')
  assert.ok(r.fieldErrors.reference)
  assert.ok((await port.lookup({ reference: 'B-1001', contact: ' ' })).fieldErrors.contact)
  const slot = await firstOpen(port)
  const { data } = await bookOne(port, slot.startsAt)
  assert.doesNotMatch(JSON.stringify((await port.lookup({ reference: data.id, contact: CONTACT })).data), /example\.com/)
})

test('cancel: 맞는 번호+연락처만 취소되고(틀린 조합은 같은 not_found·상태 불변), 두 번째 취소는 invalid_state, 취소하면 조회가 cancelled·canCancel false 다', async () => {
  const port = mock.mockBooking('')
  const slot = await firstOpen(port, '2026-10-07')
  const { data } = await bookOne(port, slot.startsAt)
  const wrong = await port.cancel({ reference: data.id, contact: 'other@example.com' })
  assert.equal(wrong.code, 'not_found')
  assert.deepEqual(wrong, await port.cancel({ reference: 'B-0000', contact: CONTACT }))
  assert.equal((await port.lookup({ reference: data.id, contact: CONTACT })).data.status, 'confirmed')
  const done = await port.cancel({ reference: data.id, contact: CONTACT })
  assert.deepEqual({ ...done, data: { ...done.data, message: 'x' } }, { ok: true, data: { id: data.id, status: 'cancelled', message: 'x' } })
  const view = (await port.lookup({ reference: data.id, contact: CONTACT })).data
  assert.equal(view.status, 'cancelled')
  assert.equal(view.canCancel, false)
  const twice = await port.cancel({ reference: data.id, contact: CONTACT })
  assert.equal(twice.ok, false)
  assert.equal(twice.code, 'invalid_state')
  assert.equal(twice.retryable, false)
})

test('cancel: 취소 마감(시작 24시간 전)이 지난 예약은 cancel_closed 이고 canCancel 이 false 다 — MOCK_NOW 기준이라 결정적이다', async () => {
  const port = mock.mockBooking('')
  const soon = '2026-10-01T10:00:00+09:00' // MOCK_NOW 로부터 1시간 뒤
  const { data } = await bookOne(port, soon)
  assert.equal((await port.lookup({ reference: data.id, contact: CONTACT })).data.canCancel, false)
  const r = await port.cancel({ reference: data.id, contact: CONTACT })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'cancel_closed')
  assert.equal((await port.lookup({ reference: data.id, contact: CONTACT })).data.status, 'confirmed')
})

test('인스턴스마다 예약 장부가 따로다 — 같은 쿼리로 새로 만들면 같은 처음 상태(번호도 B-1001 부터)', async () => {
  const a = mock.mockBooking('')
  const b = mock.mockBooking('')
  const slot = await firstOpen(a)
  const ra = await bookOne(a, slot.startsAt)
  assert.deepEqual((await b.slots({ service: 'consult', from: FROM })).data.days[0].slots, (await a.slots({ service: 'consult', from: FROM })).data.days[0].slots.map((s) => ({ ...s, available: 1 })))
  const rb = await bookOne(b, slot.startsAt)
  assert.equal(ra.data.id, 'B-1001')
  assert.equal(rb.data.id, 'B-1001')
})

// ④ ?state= · ?submit= — 다른 포트 목과 같은 도우미 ───────────────────────────────
test('?state=: 읽기(slots)는 loading 이 끝나지 않고 error 는 다시 시도할 수 있으며 empty 는 빈 날짜 목록이다; lookup 도 loading·error 를 따른다', async () => {
  assert.equal(await never(mock.mockBooking('?state=loading').slots({ service: 'consult', from: FROM })), true)
  assert.equal(await never(mock.mockBooking('?state=loading').lookup({ reference: 'B-1001', contact: CONTACT })), true)
  const err = await mock.mockBooking('?state=error').slots({ service: 'consult', from: FROM })
  assert.equal(err.ok, false)
  assert.equal(err.retryable, true)
  assert.equal((await mock.mockBooking('?state=error').lookup({ reference: 'B-1001', contact: CONTACT })).retryable, true)
  assert.deepEqual(await mock.mockBooking('?state=empty').slots({ service: 'consult', from: FROM }), { ok: true, data: { days: [] } })
})

test('?submit=: book·cancel·lookup 은 ok 가 아니면 상태를 건드리지 않고 그 결과를 낸다(server-error·field-error·rate-limited·pending)', async () => {
  const port = mock.mockBooking('?submit=server-error')
  const r = await bookOne(port, '2026-10-06T10:00:00+09:00')
  assert.equal(r.ok, false)
  assert.equal(r.retryable, true)
  assert.equal(mock.mockBooking('?submit=rate-limited&retryAfter=7').book !== undefined, true)
  assert.equal((await bookOne(mock.mockBooking('?submit=rate-limited&retryAfter=7'), '2026-10-06T10:00:00+09:00')).retryAfter, 7)
  assert.ok((await mock.mockBooking('?submit=field-error').cancel({ reference: 'B-1001', contact: CONTACT })).fieldErrors)
  assert.equal(await never(bookOne(mock.mockBooking('?submit=pending'), '2026-10-06T10:00:00+09:00')), true)
  assert.equal(await never(mock.mockBooking('?submit=timeout').lookup({ reference: 'B-1001', contact: CONTACT })), true)
  // 실패한 쓰기는 칸을 잡지 않는다
  const slot = (await mock.mockBooking('').slots({ service: 'consult', from: FROM })).data.days[0].slots[0]
  assert.equal(slot.available, 1)
})

test('mockBooking 은 결정적이다: 원천에 Date.now·new Date()(인자 없이)·Math.random 이 없다', () => {
  const src = readFileSync(join(DIR, 'adapter-mock.ts'), 'utf8')
  const from = src.indexOf('export function mockBooking')
  assert.ok(from > 0)
  const body = src.slice(from, src.indexOf('export interface TrackedEvent'))
  assert.doesNotMatch(body, /Date\.now\(|new Date\(\)|Math\.random\(/)
})
