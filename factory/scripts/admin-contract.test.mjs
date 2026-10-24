// 관리 포트 계약 타입과 목(계획 3d): contract/admin.ts 는 타입만이고, AdminPort 는 다섯 메서드 모두 Promise<ActionResult<…>> 를 돌려준다.
// 목 mockAdmin 은 접근 장면(?admin=)·구획 합성 순서(모르는 구획이 접근보다 앞)·확인 입력 벽·연락처 가림·상태 전이를 지킨다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/admin-contract.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = join(root, 'registry', 'factory', 'contract')
const OUT = join(root, '.tmp', 'admin-contract-test')
const FILE = join(DIR, 'admin.ts')
const src = readFileSync(FILE, 'utf8')
const lines = (s) => s.split(/\r?\n/)
const js = (s) => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText

function transpile(file, name) {
  mkdirSync(OUT, { recursive: true })
  const out = js(readFileSync(file, 'utf8'))
    .replace(/(from\s+)(["'])@\/registry\/factory\/lib\/([a-z-]+)\2/g, (_, kw, q, lib) => `${kw}${q}${pathToFileURL(transpile(join(root, 'registry', 'factory', 'lib', `${lib}.ts`), `lib-${lib}`)).href}${q}`)
    .replace(/(from\s+)(["'])@\/registry\/factory\/contract\/([a-z-]+)\2/g, (_, kw, q, c) => `${kw}${q}${pathToFileURL(transpile(join(DIR, `${c}.ts`), c)).href}${q}`)
  assert.doesNotMatch(out, /@\/registry\//, `${name}: 변환본에 계약 경로 import 가 남았다`)
  const path = join(OUT, `${name}.mjs`)
  writeFileSync(path, out)
  return path
}
const m = await import(pathToFileURL(transpile(join(DIR, 'adapter-mock-admin.ts'), 'adapter-mock-admin')).href)

// ① 계약 타입 ──────────────────────────────────────────────────────────────
test('admin.ts 는 타입만이다 — import 는 block-contract 의 ActionResult 하나뿐이고 변환본이 비어 있다', () => {
  const imports = lines(src).filter((l) => /^\s*import\s/.test(l))
  assert.deepEqual(imports, ['import type { ActionResult } from "@/registry/factory/contract/block-contract"'])
  const out = js(src)
  assert.equal(out.replace(/\/\/.*|\s|export\s*\{\s*\};?/g, ''), '')
})

test('AdminPort: 메서드는 다섯 개이고 모두 Promise<ActionResult<…>> 를 돌려준다(거부하지 않고 결과로 끝난다), 어느 메서드도 사용자(role·userId)를 입력으로 받지 않는다', () => {
  const p = ts.createProgram([FILE], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root, paths: { '@/*': ['./*'] } })
  const checker = p.getTypeChecker()
  const iface = p.getSourceFile(FILE).statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'AdminPort')
  assert.ok(iface)
  const type = checker.getTypeAtLocation(iface.name)
  assert.deepEqual(type.getProperties().map((x) => x.name), ['sections', 'overview', 'table', 'record', 'act'])
  for (const prop of type.getProperties()) {
    const [sig] = checker.getTypeOfSymbolAtLocation(prop, iface).getCallSignatures()
    const ret = checker.typeToString(checker.getReturnTypeOfSignature(sig), iface, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias)
    assert.match(ret, /^Promise<AdminResult</, `${prop.name}: ${ret}`)
  }
  assert.doesNotMatch(src, /\b(role|userId)\??:/, '입력 모양에 role·userId 칸이 없다')
})

test('tsc: admin.typetest.ts 는 통과하고, @ts-expect-error 줄을 지운 사본은 바로 그 줄들에서만 실패한다(음성 대조)', () => {
  const text = readFileSync(join(root, 'app', 'qa', 'blocks', 'admin.typetest.ts'), 'utf8')
  const expected = new Set()
  const kept = []
  for (const l of lines(text)) {
    if (/^\s*\/\/ @ts-expect-error/.test(l)) expected.add(kept.length + 1)
    else kept.push(l)
  }
  assert.equal(expected.size, 4)
  const neg = join(OUT, 'tsc-neg')
  rmSync(neg, { recursive: true, force: true })
  mkdirSync(neg, { recursive: true })
  writeFileSync(join(neg, 'admin-neg.ts'), kept.join('\n'))
  writeFileSync(join(neg, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { incremental: false, noEmit: true, plugins: [] }, include: ['./*.ts'], exclude: [] }))
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(neg, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' })
  assert.notEqual(r.status, 0, '음성 대조가 통과하면 울타리가 없다')
  const errors = lines(r.stdout).filter((l) => /error TS\d+/.test(l))
  const at = new Set(errors.map((e) => Number(e.match(/admin-neg\.ts\((\d+),\d+\)/)?.[1])))
  assert.deepEqual([...at].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), errors.join('\n'))
})

// ② 목 ─────────────────────────────────────────────────────────────────────
test('mockAdmin: ?admin= 다섯 장면 — 관리자만 열리고, 나머지는 이유가 있는 실패(sections 는 forbidden 일 때만 빈 목록)', async () => {
  assert.deepEqual([...m.MOCK_ADMINS], ['admin', 'signed-out', 'forbidden', 'two-factor-required', 'impersonation'])
  const ok = await m.mockAdmin('').sections()
  assert.deepEqual(ok.data.map((s) => [s.id, s.href]), [['orders', '/admin/orders'], ['reviews', '/admin/reviews']])
  for (const [scene, code] of Object.entries(m.MOCK_ADMIN_DENIALS)) {
    const port = m.mockAdmin(`?admin=${scene}`)
    const sections = await port.sections()
    if (scene === 'forbidden') assert.deepEqual([sections.ok, sections.data], [true, []])
    else assert.equal(sections.code, code, scene)
    for (const r of [await port.overview(), await port.table({ section: 'orders' }), await port.record({ section: 'orders', id: 'ord-1003' }), await port.act({ section: 'orders', id: 'ord-1003', action: 'advance' })]) {
      assert.deepEqual([r.ok, r.code, r.retryable], [false, code, false], scene)
    }
  }
  assert.throws(() => m.mockAdmin('?admin=root'), /admin=root/)
})

test('mockAdmin: 모르는 구획·형식이 틀린 구획 id 는 접근 확인보다 앞서 not_found, 모르는 기록도 not_found, 빈 id 는 invalid_input', async () => {
  const out = m.mockAdmin('?admin=signed-out')
  assert.equal((await out.table({ section: 'nope' })).code, 'not_found')
  assert.equal((await out.table({ section: '../etc' })).code, 'not_found')
  const port = m.mockAdmin('')
  assert.equal((await port.record({ section: 'orders', id: 'nope' })).code, 'not_found')
  assert.equal((await port.record({ section: 'orders', id: '  ' })).code, 'invalid_input')
  assert.equal((await port.act({ section: 'orders', id: 'ord-1003', action: '' })).code, 'invalid_input')
})

test('mockAdmin: 표 — 검색·상태 거르기·줄 수(total 은 잘리기 전 수), 연락처 열은 가려서 보낸다(원문이 어디에도 없다)', async () => {
  const port = m.mockAdmin('')
  const all = (await port.table({ section: 'orders' })).data
  assert.equal(all.total, 3)
  assert.equal(all.columns.filter((c) => c.primary).length, 1)
  assert.deepEqual((await port.table({ section: 'orders', limit: 1 })).data.rows.length, 1)
  assert.equal((await port.table({ section: 'orders', limit: 1 })).data.total, 3)
  assert.deepEqual((await port.table({ section: 'orders', status: '준비 중' })).data.rows.map((r) => r.id), ['ord-1002'])
  assert.deepEqual((await port.table({ section: 'orders', search: '박샘' })).data.rows.map((r) => r.id), ['ord-1001'])
  const phoneCol = all.columns.find((c) => c.kind === 'contact')
  assert.equal(phoneCol.id, 'phone')
  assert.deepEqual(all.rows.map((r) => r.cells.phone), ['010-****-1111', '010-****-2222', '010-****-3333'])
  assert.doesNotMatch(JSON.stringify(await port.table({ section: 'orders' })), /010-0000/)
  assert.equal(m.maskContact('kim@example.com'), 'k***@example.com')
  assert.equal((await port.table({ section: 'orders', limit: 0 })).code, 'invalid_input')
})

test('mockAdmin: 확인 입력 벽 — 확인 없이는 구획을 부르지도 않는다(?submit= 보다 앞), 확인과 함께면 바뀌고 두 번째는 invalid_state, 일반 행동은 확인 없이 된다', async () => {
  const port = m.mockAdmin('?submit=server-error')
  const refused = await port.act({ section: 'orders', id: 'ord-1003', action: 'cancel' })
  assert.deepEqual([refused.ok, refused.code, refused.retryable], [false, 'confirmation_required', false])
  assert.equal((await port.act({ section: 'orders', id: 'ord-1003', action: 'cancel', confirmed: 'true' })).code, 'confirmation_required')
  assert.equal((await port.record({ section: 'orders', id: 'ord-1003' })).data.summary.find((s) => s.label === '상태').value, '결제 완료')
  // ?submit= 이 서버 오류면 확인과 함께여도 쓰기는 실패하고 상태는 그대로다
  assert.equal((await port.act({ section: 'orders', id: 'ord-1003', action: 'cancel', confirmed: true })).ok, false)
  const live = m.mockAdmin('')
  assert.equal((await live.act({ section: 'orders', id: 'ord-1003', action: 'cancel', confirmed: true })).ok, true)
  assert.equal((await live.act({ section: 'orders', id: 'ord-1003', action: 'cancel', confirmed: true })).code, 'invalid_state')
  assert.equal((await live.act({ section: 'orders', id: 'ord-1001', action: 'cancel', confirmed: true })).code, 'invalid_state', '발송한 주문은 취소할 수 없다')
  const step = await live.act({ section: 'orders', id: 'ord-1002', action: 'advance' })
  assert.deepEqual([step.ok, step.data.message], [true, '발송(으)로 바꿨어요.'])
})

test('mockAdmin: 후기는 편집 칸이 없고(fields 비어 save 없음), 숨기기는 확인 필요·다시 보이기는 바로 — 개요의 할 일과 변화는 상태를 따른다', async () => {
  const port = m.mockAdmin('')
  const rec = (await port.record({ section: 'reviews', id: 'rev-2003' })).data
  assert.deepEqual([rec.fields, rec.save, rec.danger.id], [[], undefined, 'hide'])
  const before = (await port.overview()).data
  assert.deepEqual(before.todo.map((t) => t.id), ['reviews-low', 'orders-to-prepare'], '긴급이 먼저')
  assert.deepEqual(before.failed, [])
  assert.equal((await port.act({ section: 'reviews', id: 'rev-2003', action: 'hide', confirmed: true })).ok, true)
  assert.deepEqual((await port.overview()).data.todo.map((t) => t.id), ['orders-to-prepare'])
  const hidden = (await port.record({ section: 'reviews', id: 'rev-2003' })).data
  assert.deepEqual([hidden.danger, hidden.actions.map((a) => a.id)], [undefined, ['show']])
  assert.equal((await port.act({ section: 'reviews', id: 'rev-2003', action: 'show' })).ok, true)
})

test('mockAdmin: 메모 저장은 500자까지(칸 오류), ?state=empty 는 빈 표, ?state=error 는 다시 시도할 수 있는 오류', async () => {
  const port = m.mockAdmin('')
  const long = await port.act({ section: 'orders', id: 'ord-1003', action: 'save', fields: { memo: 'x'.repeat(501) } })
  assert.ok(long.fieldErrors.memo)
  assert.equal((await port.act({ section: 'orders', id: 'ord-1003', action: 'save', fields: { memo: '확인 완료' } })).ok, true)
  assert.equal((await port.record({ section: 'orders', id: 'ord-1003' })).data.fields[0].value, '확인 완료')
  const empty = await m.mockAdmin('?state=empty').table({ section: 'orders' })
  assert.deepEqual([empty.data.rows, empty.data.total, empty.data.columns.length > 0], [[], 0, true])
  const err = await m.mockAdmin('?state=error').table({ section: 'orders' })
  assert.deepEqual([err.ok, err.retryable], [false, true])
})
