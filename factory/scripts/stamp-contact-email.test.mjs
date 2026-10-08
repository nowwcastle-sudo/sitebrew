// 문의 폼의 받는 메일(대장 C355) — 사이트 템플릿 lib/contact.ts 는 business.email 만 읽어서, business 가 없고 contact.email 만 있는 portfolio 의 문의 폼이
// 어디로도 가지 않았다(07 전환 경로 conv-reaches-receiver 실패, 「받는 메일 주소를 확인하는 중이에요」).
// 템플릿 파일을 그대로 변환해(어댑터·콘텐츠·사이트 import 는 시험용 가짜로 바꾼다) 메일 자리 읽기만 대조한다.
// 실행: node --test --test-force-exit --test-timeout=60000 factory/scripts/stamp-contact-email.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ts = createRequire(join(root, 'package.json'))('typescript')
const source = readFileSync(join(root, 'factory', 'stamp', 'site-template', 'lib', 'contact.ts'), 'utf8')

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const NEEDS_CHECK = ['확인 필요', 'To be confirmed']

/** contact.ts 를 가짜 import 와 함께 불러 makeContactPorts 를 돌려준다. content = contentAt 이 읽는 값(경로 → 값). */
async function load(content, locale = 'ko') {
  const stubs = {
    '@/components/contract/adapter-static': dataUrl(
      `export const mailtoSubmit = (to) => Object.assign(async () => ({ ok: true }), { mailto: to })
       export const kakaoChannelSubmit = (url) => Object.assign(async () => ({ ok: true }), { kakao: url })
       export const telLink = (n) => ({ tel: n })`
    ),
    '@/components/content/content-core': dataUrl(`export const NEEDS_CHECK_LITERALS = ${JSON.stringify(NEEDS_CHECK)}`),
    '@/lib/site': dataUrl(`const c = ${JSON.stringify(content)}\nexport const contentAt = (p) => c[p]\nexport const locale = ${JSON.stringify(locale)}`),
  }
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  const code = outputText.replace(/from\s+(["'])(@\/[^"']+)\1/g, (m, q, spec) => `from ${q}${stubs[spec] ?? (() => { throw new Error(`가짜 없음: ${spec}`) })()}${q}`)
  const mod = await import(dataUrl(code))
  return mod.makeContactPorts()
}

test('portfolio: business 가 없고 contact.email 만 있으면 그 메일로 보낸다(mailto)', async () => {
  const p = await load({ 'contact.email': 'hello@studio.kr' })
  assert.equal(p.submit.mailto, 'hello@studio.kr', '문의 폼이 contact.email 을 못 읽었다')
})

test('business.email 이 있으면 그것이 이긴다(commerce·detail·local·saas 는 그대로)', async () => {
  const p = await load({ 'business.email': 'shop@shop.kr', 'contact.email': 'other@x.kr' })
  assert.equal(p.submit.mailto, 'shop@shop.kr')
})

test('business.email 이 「확인 필요」면 contact.email 로 넘어가고, 둘 다 쓸 수 없으면 안내 오류로 답한다(음성 대조)', async () => {
  const p1 = await load({ 'business.email': '확인 필요', 'contact.email': 'hello@studio.kr' })
  assert.equal(p1.submit.mailto, 'hello@studio.kr')
  for (const content of [{}, { 'contact.email': '확인 필요' }, { 'business.email': 'To be confirmed', 'contact.email': '  ' }]) {
    const p = await load(content)
    assert.equal(p.submit.mailto, undefined, `쓸 수 없는 값인데 mailto 를 만들었다: ${JSON.stringify(content)}`)
    const r = await p.submit({ message: 'hi' })
    assert.equal(r.ok, false)
    assert.match(r.formError, /받는 메일 주소/)
  }
})
