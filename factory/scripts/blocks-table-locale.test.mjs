// 관리자 표 날짜·숫자의 locale·timeZone(점검 의견 2 — 표 셀이 ko-KR·Asia/Seoul 로 고정돼 있던 길) — _shared/data-table-kit 의 cellText·dateText 와 data-table 세 변형.
// 인자가 없으면 예전 출력(ko-KR·Asia/Seoul)과 같고, locale·timeZone 을 받으면 셀까지 그대로 닿는다. 시간이 없는 날짜(「2026-10-05」)는 시간대로 밀리지 않는다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/blocks-table-locale.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { h, load, renderToStaticMarkup } from './lib/base-compare.mjs'

const KIT = 'registry/factory/blocks/_shared/data-table-kit.tsx'
const DATE_COL = { id: 'at', label: 'at', kind: 'date' }
const LEGACY = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
const HANGUL = /[가-힣]/

test('인자가 없으면 예전 식(ko-KR·Asia/Seoul)과 글자까지 같다 — 순간·날짜만·숫자', async () => {
  const { cellText } = await load(KIT)
  for (const iso of ['2026-10-31T15:00:00.000Z', '2026-10-31T14:59:59.999Z', '2026-12-31T23:59:59Z']) {
    assert.equal(cellText(DATE_COL, iso), LEGACY.format(new Date(iso)), iso)
    assert.equal(cellText(DATE_COL, iso, { locale: 'ko' }), LEGACY.format(new Date(iso)), `${iso} ko`)
  }
  assert.equal(cellText({ id: 'n', label: 'n', kind: 'numeric' }, 1234567.891), '1,234,567.89')
  assert.equal(cellText(DATE_COL, null), '—')
})

test('순간(ISO 시각)은 표의 시간대 날짜로 읽는다 — 같은 순간이 서울과 뉴욕에서 하루 다르다', async () => {
  const { cellText } = await load(KIT)
  const at = '2026-10-31T15:00:00Z' // 서울 11-01 0시 = 뉴욕 10-31 11시
  assert.equal(cellText(DATE_COL, at), '2026년 11월 1일')
  assert.equal(cellText(DATE_COL, at, { locale: 'en' }), 'November 1, 2026') // 언어만 바뀌고 시간대는 그대로
  assert.equal(cellText(DATE_COL, at, { locale: 'en', timeZone: 'America/New_York' }), 'October 31, 2026')
  assert.equal(cellText(DATE_COL, at, { locale: 'en', timeZone: 'UTC' }), 'October 31, 2026')
  assert.equal(cellText(DATE_COL, '2026-10-31T14:59:59.999Z', { locale: 'en', timeZone: 'Asia/Seoul' }), 'October 31, 2026') // 서울 자정 1ms 전
})

test('시간이 없는 날짜(YYYY-MM-DD)는 달력 날짜라 어느 시간대에서도 같은 날이다', async () => {
  const { cellText } = await load(KIT)
  for (const timeZone of [undefined, 'Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    assert.equal(cellText(DATE_COL, '2026-10-05', { locale: 'en', timeZone }), 'October 5, 2026', String(timeZone))
    assert.equal(cellText(DATE_COL, '2026-10-05', { timeZone }), '2026년 10월 5일', String(timeZone))
  }
})

test('읽을 수 없는 날짜 글은 지어내지 않고 그대로 보인다', async () => {
  const { cellText } = await load(KIT)
  assert.equal(cellText(DATE_COL, '다음 주'), '다음 주')
})

test('data-table 세 변형 — locale·timeZone 이 셀·개수 글까지 닿고, 없으면 예전 한국어 날짜다', async () => {
  const names = [['compact', 'DataTableCompact'], ['admin-list', 'DataTableAdminList'], ['bulk-select', 'DataTableBulkSelect']]
  for (const [file, comp] of names) {
    const mod = await load(`registry/factory/blocks/data-table/${file}.tsx`)
    const fx = await load(`registry/factory/blocks/data-table/${file}.fixture.ts`)
    const Comp = mod[comp]
    const ko = renderToStaticMarkup(h(Comp, fx.fixture))
    assert.match(ko, /\d{4}년 \d{1,2}월 \d{1,2}일/, `${file}: 한국어 날짜가 있어야 시험이 의미 있다`)
    const en = renderToStaticMarkup(h(Comp, { ...fx.fixture, locale: 'en', timeZone: 'America/Los_Angeles' }))
    assert.match(en, /<time[^>]*>(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}<\/time>/, `${file}: 영어 날짜`)
    assert.doesNotMatch(en.replace(/<time[\s\S]*?<\/time>/g, ''), /\d{4}년/, `${file}: 날짜 밖에 한글 날짜가 남았다`)
    assert.doesNotMatch(en.match(/<time[\s\S]*?<\/time>/g).join(''), HANGUL, `${file}: 날짜 칸에 한글`)
  }
})
