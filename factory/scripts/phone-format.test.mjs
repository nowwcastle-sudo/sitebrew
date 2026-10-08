// 입력 서식(P3-2 Task 7a, 대장 A43): lib/phone.ts formatPhoneKr·formatBizNo — 입력 중 하이픈·붙여넣은 여러 형식·커서 보존, 저장은 normalizePhone 그대로.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/phone-format.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, '.tmp', 'phone-format-test')
mkdirSync(OUT, { recursive: true })
const src = readFileSync(join(root, 'registry', 'factory', 'lib', 'phone.ts'), 'utf8')
writeFileSync(join(OUT, 'phone.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)
const { formatPhoneKr, formatBizNo, normalizePhone } = await import(pathToFileURL(join(OUT, 'phone.mjs')).href)
const fmt = (s) => formatPhoneKr(s).value

test('formatPhoneKr: 자릿수마다 하이픈이 붙고, 지역번호·휴대폰·대표번호 규칙을 따른다', () => {
  const cases = {
    '0': '0', '010': '010', '0101': '010-1', '01012345': '010-1234-5', '01012345678': '010-1234-5678',
    '021234567': '02-123-4567', '0212345678': '02-1234-5678',
    '0311234567': '031-123-4567', '03112345678': '031-1234-5678',
    '0111234567': '011-123-4567', '05051234567': '0505-123-4567', '15881234': '1588-1234', '': '',
  }
  for (const [raw, want] of Object.entries(cases)) assert.equal(fmt(raw), want, raw)
  assert.equal(fmt('010123456789'), '010-1234-5678', '11자리를 넘는 숫자는 잘라 낸다')
})

test('formatPhoneKr: 붙여넣은 여러 형식(+82·점·괄호·전각·공백)을 같은 결과로 받고, 저장 값(normalizePhone)은 형식과 무관하다', () => {
  const pasted = ['+82 10 1234 5678', '+82(0)10-1234-5678', '+82-10-1234-5678', '010.1234.5678', '010 1234 5678', '(010) 1234-5678', '０１０１２３４５６７８']
  for (const p of pasted) {
    assert.equal(fmt(p), '010-1234-5678', p)
    assert.equal(normalizePhone(fmt(p)), '01012345678', `${p}: 화면 값 → 저장 값`)
  }
  assert.equal(fmt('(02) 1234-5678'), '02-1234-5678')
  // 다른 나라 번호는 손대지 않는다
  assert.equal(fmt('+1 415 555 0100'), '+1 415 555 0100')
  assert.equal(normalizePhone(fmt('+1 415 555 0100')), '+14155550100')
})

test('formatPhoneKr: 커서는 「커서 앞 숫자 개수」를 지킨다 — 가운데를 고쳐도 끝으로 튀지 않는다', () => {
  // 010-1234-5678 에서 「1」 뒤(캐럿 5)에 숫자 9 를 끼워 넣은 것 = 0101 9 234-5678 → 커서는 방금 넣은 9 뒤
  const r = formatPhoneKr('01019234-5678', 5)
  assert.equal(r.value, '010-1923-4567')
  assert.equal(r.caret, 6)
  assert.deepEqual(formatPhoneKr('0101', 4), { value: '010-1', caret: 5 })
  assert.deepEqual(formatPhoneKr('010-1234-5678', 5), { value: '010-1234-5678', caret: 5 })
  // 끝에 입력 중이면 커서도 끝
  assert.deepEqual(formatPhoneKr('01012345', 8), { value: '010-1234-5', caret: 10 })
})

test('formatBizNo: 사업자등록번호 3-2-5, 10자리까지', () => {
  assert.equal(formatBizNo('1234567890').value, '123-45-67890')
  assert.equal(formatBizNo('123456').value, '123-45-6')
  assert.equal(formatBizNo('123-45-67890-1').value, '123-45-67890')
  assert.equal(formatBizNo('１２３４５６７８９０').value, '123-45-67890')
  assert.deepEqual(formatBizNo('123-45-6789', 4), { value: '123-45-6789', caret: 3 })
})

// 전화 칸을 가진 블록은 모두 서식을 켠다 — 새 블록이 type="tel" 만 달고 서식을 잊는 것을 막는다(음성 대조: 서식 없는 사본은 잡힌다).
test('원천 규칙: type="tel" 인 글 칸은 format="phone" 을 함께 단다', () => {
  const dir = join(root, 'registry', 'factory', 'blocks')
  const files = []
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === '_compiled') continue; const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx')) files.push(p) } }
  walk(dir)
  const missing = (source) => [...source.matchAll(/<(?:TextField|FormField)\b[^>]*?type="tel"[^>]*?\/?>/gs)].filter((m) => !/format="phone"/.test(m[0])).length
  let found = 0
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    found += [...src.matchAll(/type="tel"/g)].length
    assert.equal(missing(src), 0, `${f}: type="tel" 칸에 format="phone" 이 없다`)
  }
  assert.ok(found >= 2, `전화 칸을 너무 적게 찾았다(${found})`)
  assert.equal(missing('<TextField flow={flow} name="phone" type="tel" autoComplete="tel" />'), 1)
})
