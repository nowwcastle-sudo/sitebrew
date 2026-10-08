// REL12 (v0.0.12) 폼 보안·블록 속성 시험 — launch-factory P1AB 걷기(진짜 브라우저)에서 나온 것:
//   가입·로그인 폼이 method 없는 <form> 이라 JS 가 붙기 전에 제출하면 GET 이 돼 비밀번호가 주소 쿼리로 나간다.
//   ① 원천: 블록·부품의 모든 <form> 이 method="post" 를 가진다(TS AST — 손으로 한 곳을 빠뜨리면 잡힌다)
//   ② 서버가 그린 HTML(renderToStaticMarkup — 하이드레이션 전과 같은 마크업): 폼이 그려지는 모든 블록의 <form> 이 method="post",
//      비밀번호·자격 증명 칸이 든 폼은 반드시 post. 양성 대조: 폼이 그려진 블록이 8개 이상이고 로그인·가입·새 비밀번호·재설정이 든다
//   ③ account/notification-consents 의 channels 속성(문구에 없는 채널·prop 에 없는 채널은 스위치가 없다)
//   ④ confirmation/verify-email 의 initialWait(원천 — 동작은 갤러리 시험 rel12-gallery)
// 실행: node --test --test-force-exit --test-timeout=240000 factory/scripts/rel12-forms.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { h, html, load, root } from './lib/base-compare.mjs'

const BLOCKS_DIR = join(root, 'registry', 'factory', 'blocks')
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (n === '_compiled') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}
const SOURCES = [...walk(BLOCKS_DIR), ...walk(join(root, 'registry', 'factory', 'ui-src'))]

/** 파일의 모든 <form> 열기 태그와 method 값(없으면 null) */
function formsOf(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  const found = []
  const visit = (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === 'form') {
      const attr = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'method')
      let value = null
      if (attr?.initializer) {
        const i = attr.initializer
        value = ts.isStringLiteral(i) ? i.text : ts.isJsxExpression(i) && i.expression && ts.isStringLiteral(i.expression) ? i.expression.text : '(식)'
      }
      const roleAttr = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'role')
      const role = roleAttr?.initializer && ts.isStringLiteral(roleAttr.initializer) ? roleAttr.initializer.text : null
      found.push({ line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1, method: value, role })
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
  return found
}

test('REL12 5a ① 원천: 블록·부품의 모든 <form> 이 method="post" 다(GET 폼은 하이드레이션 전 제출에 비밀번호·이메일을 주소에 싣는다)', () => {
  const bad = []
  let total = 0
  for (const f of SOURCES) for (const x of formsOf(f)) {
    total++
    // FV1 Task 5.9: 검색 폼(role=search)은 비밀번호·이메일 없이 검색어만 싣는 GET 이 맞다(주소에 검색어가 남아 새로고침·공유에서 유지된다) — method=get 을 명시한다
    if (x.method?.toLowerCase() !== (x.role === 'search' ? 'get' : 'post')) bad.push(`${f.slice(root.length + 1)}:${x.line} method=${x.method}`)
  }
  console.log(`  폼 ${total}개 검사`)
  assert.ok(total >= 20, `폼을 20개 이상 찾아야 한다(양성 대조): ${total}`)
  assert.deepEqual(bad, [])
})

// 컴포넌트 이름: block-<kind>-<variant> → Pascal(kind) + Pascal(variant)
const pascal = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')
const blockFiles = () => {
  const out = []
  for (const kind of readdirSync(BLOCKS_DIR)) {
    if (kind.startsWith('_') || !statSync(join(BLOCKS_DIR, kind)).isDirectory()) continue
    for (const f of readdirSync(join(BLOCKS_DIR, kind))) if (f.endsWith('.tsx')) out.push({ kind, variant: f.replace(/\.tsx$/, '') })
  }
  return out
}

test('REL12 5a ② 서버가 그린 HTML: 폼이 그려지는 블록의 <form> 은 모두 method="post", 비밀번호 칸이 든 폼도 그렇다', async () => {
  const withForm = []
  const withPassword = []
  const failures = []
  const missing = []
  for (const { kind, variant } of blockFiles()) {
    const id = `${kind}/${variant}`
    if (!formsOf(join(BLOCKS_DIR, kind, `${variant}.tsx`)).length && !readFileSync(join(BLOCKS_DIR, kind, `${variant}.tsx`), 'utf8').includes('<form')) continue
    let markup
    try {
      const mod = await load(`registry/factory/blocks/${kind}/${variant}.tsx`)
      const fx = await load(`registry/factory/blocks/${kind}/${variant}.fixture.ts`)
      const C = mod[pascal(kind) + pascal(variant)]
      assert.equal(typeof C, 'function', `${id}: 컴포넌트 ${pascal(kind) + pascal(variant)}`)
      markup = html(h(C, fx.fixture))
    } catch (e) {
      failures.push(`${id}: ${e.message.split('\n')[0]}`)
      continue
    }
    const forms = [...markup.matchAll(/<form\b[^>]*>/g)].map((m) => m[0])
    if (!forms.length) continue
    withForm.push(id)
    for (const tag of forms) if (!(/\brole="search"/.test(tag) ? /\bmethod="get"/ : /\bmethod="post"/).test(tag)) missing.push(`${id}: ${tag.slice(0, 120)}`)
    for (const seg of markup.split(/<form\b/).slice(1)) {
      const body = seg.split('</form>')[0]
      if (/type="password"|autoComplete="(?:current|new)-password"|autocomplete="(?:current|new)-password"/i.test(body)) {
        withPassword.push(id)
        assert.match(seg.split('>')[0], /method="post"/, `${id}: 비밀번호 칸이 든 폼이 post 가 아니다`)
      }
    }
  }
  console.log(`  서버 렌더 폼 블록 ${withForm.length}개(비밀번호 칸 폼 ${new Set(withPassword).size}개), 렌더 실패 ${failures.length}`)
  assert.deepEqual(missing, [])
  assert.ok(withForm.length >= 8, `폼이 그려진 블록 ${withForm.length}개 — 8개 이상이어야 한다(양성 대조). 실패: ${failures.join(' | ')}`)
  assert.ok(new Set(withPassword).size >= 2, `비밀번호 칸이 그려진 블록 ${[...new Set(withPassword)].join(', ')} — 2개 이상이어야 한다(양성 대조). 실패: ${failures.join(' | ')}`)
})

test('REL12 5c: account/notification-consents — channels prop 과 문구가 채널을 정한다(안 주면 예전 그대로 문구가 있는 채널 전부)', async () => {
  const mod = await load('registry/factory/blocks/account/notification-consents.tsx')
  const fx = await load('registry/factory/blocks/account/notification-consents.fixture.ts')
  const C = mod.AccountNotificationConsents
  // 읽기 포트가 비동기라 서버 첫 렌더는 로딩 줄이다 — initial 로 읽은 값을 주어 목록을 그린다
  const initial = { consents: { email: false, sms: false, kakao: false, push: false } }
  const rows = (p) => [...html(h(C, { ...fx.fixture, initial, ...p })).matchAll(/data-consent="optional"/g)].length
  assert.equal(rows({}), 4, 'channels 를 안 주면 네 채널 전부(예전 그대로)')
  assert.equal(rows({ channels: ['email'] }), 1, 'channels=[email] 이면 이메일 스위치 하나')
  assert.equal(rows({ channels: ['email', 'push'] }), 2)
  const only = { ...fx.fixture.copy, channels: { email: fx.fixture.copy.channels.email } }
  assert.equal(rows({ copy: only }), 1, '문구에 없는 채널은 스위치도 없다')
  assert.equal(rows({ copy: only, channels: ['sms'] }), 0, '문구에도 prop 에도 맞는 채널이 없으면 0')
  const markup = html(h(C, { ...fx.fixture, initial, channels: ['email'] }))
  assert.ok(!/문자|카카오톡|앱 알림/.test(markup.replace(/<[^>]*>/g, ' ').split('결제·보안')[0]), '이메일만이면 문자·카카오톡·앱 알림 이름이 화면에 없다')
})

test('REL12 5d ④ 원천: confirmation/verify-email 의 initialWait — 안 주면 resendAfter 와 같고(예전 그대로), 0 이면 처음부터 풀려 있다', () => {
  const src = readFileSync(join(BLOCKS_DIR, 'confirmation', 'verify-email.tsx'), 'utf8')
  assert.match(src, /initialWait\?: number/)
  assert.match(src, /const firstWait = initialWait \?\? resendAfter/)
  assert.match(src, /if \(firstWait > 0\) start\(firstWait\)/)
  // 보낸 뒤 잠금은 initialWait 와 무관하게 resendAfter
  assert.match(src, /wait\.start\(resendAfter\)/)
})

test('REL12 5b ① 원천: port-form 의 칸 검사(blur)는 예약한 뒤 제출이 일어났으면 버린다 — 제출 결과가 늘 이긴다', () => {
  const src = readFileSync(join(BLOCKS_DIR, '_shared', 'port-form.tsx'), 'utf8')
  assert.match(src, /const submitStamp = React\.useRef\(0\)/)
  assert.match(src, /const stamp = submitStamp\.current\n\s+runAfterPress\(\(\) => \{\n\s+if \(submitStamp\.current !== stamp\) return/)
  // 제출 경로(validate·run 시작·run 끝·showErrors)가 번호를 올린다
  assert.equal((src.match(/submitStamp\.current\+\+/g) ?? []).length, 4)
})
