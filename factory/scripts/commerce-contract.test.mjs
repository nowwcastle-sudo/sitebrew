// 판매 포트 계약 타입(계획 3a Task A2): contract/commerce.ts 는 타입만이고 런타임 문이 없다 —
// import 는 ports(Money·IsoDate·HumanConfirmation)와 block-contract(ActionResult)의 타입뿐이고, CommercePort 의 모든 메서드는 Promise<ActionResult<…>> 를 돌려준다.
// 실행: node --test --test-force-exit --test-timeout=120000 factory/scripts/commerce-contract.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILE = join(root, 'registry', 'factory', 'contract', 'commerce.ts')
const src = readFileSync(FILE, 'utf8')

test('commerce.ts 는 타입만이다 — 모든 import 가 `import type`, 변환본이 비어 있다', () => {
  const imports = src.split(/\r?\n/).filter((l) => /^\s*import\s/.test(l))
  assert.ok(imports.length >= 2)
  for (const l of imports) assert.match(l, /^\s*import type\s/, l)
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  assert.equal(out.replace(/\/\/.*|\s|export\s*\{\s*\};?/g, ''), '')
})

test('import 는 ports 와 block-contract 에서만 — Money·IsoDate·HumanConfirmation ← ports, ActionResult ← block-contract (이벤트·어댑터·블록을 부르지 않는다)', () => {
  const from = [...src.matchAll(/^import type \{([^}]*)\} from "([^"]+)"/gm)].map((m) => [m[2], m[1].split(',').map((s) => s.trim()).filter(Boolean).sort()])
  assert.deepEqual(Object.fromEntries(from), {
    '@/registry/factory/contract/block-contract': ['ActionResult'],
    '@/registry/factory/contract/ports': ['HumanConfirmation', 'IsoDate', 'Money'],
  })
})

// tsc 타입 검사기로 CommercePort 를 읽는다 — 메서드 여덟 개 전부 Promise<ActionResult<…>>.
function program() {
  const p = ts.createProgram([FILE], { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root, paths: { '@/*': ['./*'] } })
  return { p, checker: p.getTypeChecker(), sf: p.getSourceFile(FILE) }
}
const METHODS = ['catalog', 'cart', 'setCartLine', 'placeOrder', 'confirmPayment', 'orders', 'order', 'cancelOrder']

test('CommercePort: 메서드는 계획 표 그대로 여덟 개이고 모두 Promise<ActionResult<…>> 를 돌려준다(거부하지 않고 결과로 끝난다)', () => {
  const { checker, sf } = program()
  const iface = sf.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'CommercePort')
  assert.ok(iface, 'CommercePort 가 없다')
  const type = checker.getTypeAtLocation(iface.name)
  assert.deepEqual(type.getProperties().map((p) => p.name), METHODS)
  for (const prop of type.getProperties()) {
    const [sig] = checker.getTypeOfSymbolAtLocation(prop, iface).getCallSignatures()
    assert.ok(sig, `${prop.name}: 호출 시그니처가 없다`)
    const ret = checker.typeToString(checker.getReturnTypeOfSignature(sig), iface, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias)
    assert.match(ret, /^Promise<ActionResult</, `${prop.name}: ${ret}`)
  }
})

test('승인 행동의 입력(placeOrder·cancelOrder)은 HumanConfirmation 을 잇는다 — confirmed?: true 를 받는다', () => {
  assert.match(src, /placeOrder\(input: \{ address: ShippingAddress \} & HumanConfirmation\)/)
  assert.match(src, /cancelOrder\(input: \{ orderId: string; reason\?: string \} & HumanConfirmation\)/)
})

test('OrderStatus: 일곱 상태(결제 대기·결제 완료·준비·배송 중·배송 완료·취소·환불)가 계획 표 그대로다', () => {
  const m = src.match(/export type OrderStatus =([^\n]+)/)
  assert.ok(m)
  assert.deepEqual([...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]), ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'refunded'])
})

test('PaymentSession: client 에는 공개해도 되는 값만 — 비밀 키 칸 이름이 타입에 없다(secret·apiKey·token)', () => {
  const body = src.match(/export interface PaymentSession \{[^}]*\}/)?.[0] ?? ''
  assert.ok(body)
  assert.doesNotMatch(body, /secret|apiKey|token/i)
  assert.match(body, /client: Record<string, string>/)
})
