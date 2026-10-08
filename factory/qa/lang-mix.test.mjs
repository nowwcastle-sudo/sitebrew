// lang-mix 관문(UXGATE1 · G9) — 순수 판정(Chrome 없음) + 고정 시험 페이지(Chrome, lang-mix.mjs 를 자식 프로세스로 비동기로 돌린다).
// 실행: node --test --test-force-exit --test-timeout=300000 factory/qa/lang-mix.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runTool } from './fixtures/run-tool.mjs'
import { ambiguousDates, englishDates, judgeItems, compileAllow, parseArgs, summarize, HANGUL } from './lang-mix.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = (f) => join(here, 'fixtures', 'lang-mix', f)
const furl = (f) => pathToFileURL(fx(f)).href

// 자식 프로세스는 비동기로만 띄운다(spawnSync 는 이 저장소 시험에서 쓰지 않는다).
// 부하로 기한을 넘긴 「도구 실패」만 다시 시도한다(fixtures/run-tool.mjs).
const run = (args, env = {}) => runTool(join(here, 'lang-mix.mjs'), args, env)
const outDir = () => mkdtempSync(join(tmpdir(), 'lang-mix-'))
const readJson = (dir) => JSON.parse(readFileSync(join(dir, 'lang-mix.json'), 'utf8'))

// ── 순수 ────────────────────────────────────────────────────────────────────────────────────────────────
test('순수: 한글 판정 — 음절·자모를 잡고 라틴·숫자는 안 잡는다', () => {
  assert.ok(HANGUL.test('닫기'))
  assert.ok(HANGUL.test('ㅋㅋ'))
  assert.ok(!HANGUL.test('Close 12 ×'))
})

test('순수: 모호한 숫자 날짜 — 10/03·03/10/2026 은 잡고 ISO·진행 표시·점수·버전은 놓아 준다', () => {
  assert.deepEqual(ambiguousDates('Updated 10/03'), ['10/03'])
  assert.deepEqual(ambiguousDates('Due 03/10/2026 end'), ['03/10/2026'])
  assert.deepEqual(ambiguousDates('on 05.06.26'), ['05.06.26'])
  assert.deepEqual(ambiguousDates('2026-11-01 and 2026/10/03'), []) // 연도 앞 — 순서가 정해져 있다
  assert.deepEqual(ambiguousDates('Step 2/3 · 4.8 rating · 1-2 items · v1.2.3'), [])
  assert.deepEqual(ambiguousDates('25/12 and 13/01'), []) // 12 를 넘는 쪽은 일로만 읽혀 모호하지 않다
  assert.deepEqual(ambiguousDates('10/10'), []) // 월·일이 같으면 어느 쪽으로 읽어도 같다
})

test('순수: 영어 날짜 — 월 일 · 일 월 · 월 연도, 대문자 월만(소문자 may 는 날짜가 아니다)', () => {
  assert.deepEqual(englishDates('Nov 1, 2026'), ['Nov 1'])
  assert.deepEqual(englishDates('on 1st of November'), ['1st of November'])
  assert.deepEqual(englishDates('Since November 2026'), ['November 2026'])
  assert.deepEqual(englishDates('Sept. 12'), ['Sept. 12'])
  assert.deepEqual(englishDates('you may cancel in 3 days; Marching band 5'), [])
})

test('순수: judgeItems en — 한글·모호한 날짜를 규칙 이름과 출처로 적고, 허용목록은 지운 뒤 본다', () => {
  const items = [{ src: 'text', text: '2026년 11월 1일' }, { src: 'aria-label', text: '닫기' }, { src: 'text', text: 'Updated 10/03' }, { src: 'text', text: 'Welcome to 예시기관' }, { src: 'text', text: 'Clean' }]
  const f = judgeItems(items, { locale: 'en' })
  assert.deepEqual(f.map((x) => `${x.rule}:${x.src}`), ['hangul:text', 'hangul:aria-label', 'ambiguous-date:text', 'hangul:text'])
  const allowed = judgeItems(items, { locale: 'en', allow: compileAllow({ strings: ['예시기관'] }) })
  assert.equal(allowed.length, 3)
  const byPattern = judgeItems([{ src: 'text', text: 'Updated 10/03' }], { locale: 'en', allow: compileAllow({ patterns: ['\\d{2}/\\d{2}'] }) })
  assert.equal(byPattern.length, 0)
})

test('순수: judgeItems — 같은 글은 한 줄로 묶고 count 를 센다, ko 는 영어 날짜만 본다(영어 낱말·한글은 놓아 준다)', () => {
  const dup = judgeItems([{ src: 'text', text: '닫기' }, { src: 'text', text: '닫기' }], { locale: 'en' })
  assert.equal(dup.length, 1)
  assert.equal(dup[0].count, 2)
  const ko = judgeItems([{ src: 'text', text: 'Pro 요금제 안내' }, { src: 'time', text: 'Nov 1, 2026' }], { locale: 'ko' })
  assert.deepEqual(ko.map((x) => `${x.rule}:${x.src}`), ['english-date:time'])
  assert.throws(() => judgeItems([], { locale: 'fr' }), /모르는 로캘/)
})

test('순수: 인자 — 로캘·out·url 이 필요하고 모르는 인자는 던진다, 요약은 잰 글 0 을 na 로 세어 ok 가 아니다', () => {
  assert.throws(() => parseArgs(['--locale', 'en', '--out', 'x']), /쪽 주소/)
  assert.throws(() => parseArgs(['u', '--out', 'x']), /--locale/)
  assert.throws(() => parseArgs(['u', '--locale', 'en']), /--out/)
  assert.throws(() => parseArgs(['u', '--locale', 'en', '--out', 'x', '--bogus']), /모르는 인자/)
  assert.throws(() => parseArgs(['u', '--locale', 'en', '--out', 'x', '--allow', join(here, 'nope.json')]), /허용목록 파일이 없다/)
  assert.deepEqual(summarize([{ strings: 0, status: 'na' }]), { pages: 1, strings: 0, pass: 1, fail: 0, na: 1, ok: false })
  assert.equal(summarize([{ strings: 4, status: 'pass' }, { strings: 2, status: 'fail' }]).ok, false)
  assert.equal(summarize([{ strings: 4, status: 'pass' }]).ok, true)
})

// ── 쪽(Chrome) ─────────────────────────────────────────────────────────────────────────────────────────
test('양성 대조: en 쪽의 「2026년 11월 1일」·「닫기」·한글 placeholder·alt·모호한 날짜 10/03 을 모두 잡는다(종료 1, 결과 파일 있음)', async () => {
  const out = outDir()
  const r = await run([furl('en-mixed.html'), '--locale', 'en', '--out', out])
  assert.equal(r.code, 1, r.err)
  const j = readJson(out)
  const f = j.pages[0].findings.map((x) => `${x.rule}|${x.src}|${x.match}`)
  assert.ok(f.includes('hangul|time|년'), f.join('\n'))
  assert.ok(f.includes('hangul|aria-label|닫기'), f.join('\n'))
  assert.ok(f.includes('hangul|placeholder|이메일'), f.join('\n'))
  assert.ok(f.includes('hangul|alt|그래프'), f.join('\n'))
  assert.ok(f.includes('ambiguous-date|text|10/03'), f.join('\n'))
  // 놓아 주는 것: lang="ko" 링크 · translate="no" · hidden 글 · ISO·진행 표시·점수
  assert.ok(!f.some((x) => /한국어|예시기관|숨김/.test(x)), f.join('\n'))
  assert.equal(j.pages[0].findings.length, 5, f.join('\n'))
  assert.equal(j.pages[0].skipped.lang, 1)
  assert.equal(j.pages[0].skipped.translateNo, 1)
  assert.equal(j.pages[0].skipped.hiddenText, 1)
  assert.equal(j.summary.ok, false)
  assert.equal(j.summary.fail, 1)
})

test('음성 대조: 영어만 있는 쪽(영어 월 날짜·Close·한국어 전환 링크·고유명사)은 통과한다(종료 0)', async () => {
  const out = outDir()
  const r = await run([furl('en-clean.html'), '--locale', 'en', '--out', out])
  assert.equal(r.code, 0, r.out + r.err)
  const j = readJson(out)
  assert.equal(j.pages[0].findings.length, 0)
  assert.ok(j.pages[0].strings >= 8, `잰 글 ${j.pages[0].strings}`) // 0 개를 재고 통과한 것이 아니다
  assert.equal(j.summary.ok, true)
})

test('ko 쪽: Nov 1, 2026 · 1 November 2026 · November 2026 · aria-label 의 Dec 25 를 잡고, 영어 낱말·소문자 may 는 놓아 준다', async () => {
  const out = outDir()
  const r = await run([furl('ko-mixed.html'), '--locale', 'ko', '--out', out])
  assert.equal(r.code, 1, r.err)
  const f = readJson(out).pages[0].findings.map((x) => `${x.rule}|${x.src}|${x.match}`)
  assert.deepEqual(f.sort(), ['english-date|aria-label|Dec 25', 'english-date|text|1 November', 'english-date|text|November 2026', 'english-date|time|Nov 1'].sort())
  const clean = outDir()
  const c = await run([furl('ko-clean.html'), '--locale', 'ko', '--out', clean])
  assert.equal(c.code, 0, c.out + c.err)
  assert.ok(readJson(clean).pages[0].strings >= 5)
})

test('허용목록: 브랜드 낱말은 --allow 파일이 있어야 통과한다', async () => {
  const a = await run([furl('en-brand.html'), '--locale', 'en', '--out', outDir()])
  assert.equal(a.code, 1)
  const b = await run([furl('en-brand.html'), '--locale', 'en', '--out', outDir(), '--allow', fx('allow.json')])
  assert.equal(b.code, 0, b.out + b.err)
})

test('--scope: 지정한 요소 안쪽만 잰다(문서 제목·바깥 글은 뺀다), 맞는 요소가 없으면 도구 실패', async () => {
  const out = outDir()
  const ok = await run([furl('en-mixed.html'), '--locale', 'en', '--out', out, '--scope', 'time'])
  assert.equal(ok.code, 1)
  const j = readJson(out)
  assert.equal(j.pages[0].strings, 1)
  assert.deepEqual(j.pages[0].findings.map((x) => x.rule), ['hangul'])
  const bad = outDir()
  const none = await run([furl('en-clean.html'), '--locale', 'en', '--out', bad, '--scope', '#nope'])
  assert.equal(none.code, 1)
  assert.match(none.err, /도구 실패/)
  assert.ok(!existsSync(join(bad, 'lang-mix.json')))
})

test('종료 코드: 인자 오류 2 · 열리지 않는 쪽은 도구 실패 1(결과 파일 없음, 이전 파일도 지운다) · 잰 글 0 은 na 로 1(결과 파일 있음)', async () => {
  const usage = await run(['--locale', 'en'])
  assert.equal(usage.code, 2)
  const out = outDir()
  writeFileSync(join(out, 'lang-mix.json'), '{"stale":true}')
  const bad = await run([pathToFileURL(join(here, 'fixtures', 'lang-mix', 'does-not-exist.html')).href, '--locale', 'en', '--out', out])
  assert.equal(bad.code, 1)
  assert.match(bad.err, /도구 실패/)
  assert.ok(!existsSync(join(out, 'lang-mix.json')), '이전 실행의 결과가 남았다')
  const empty = outDir()
  const na = await run([furl('empty.html'), '--locale', 'en', '--out', empty])
  assert.equal(na.code, 1)
  const j = readJson(empty)
  assert.equal(j.pages[0].status, 'na')
  assert.equal(j.summary.na, 1)
  assert.equal(j.summary.ok, false)
})
