import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_MESSAGES, placeholders } from "../src/index.ts"

function leaves(obj, prefix = "") {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === "string") out[path] = v
    else Object.assign(out, leaves(v, path))
  }
  return out
}

const ko = leaves(DEFAULT_MESSAGES.ko)
const en = leaves(DEFAULT_MESSAGES.en)

test("메시지 키가 ko·en 양쪽에 모두 있다", () => {
  const koKeys = Object.keys(ko).sort()
  const enKeys = Object.keys(en).sort()
  assert.ok(koKeys.length >= 30, `키 ${koKeys.length}개`)
  assert.deepEqual(koKeys.filter((k) => !(k in en)), [], "ko 에만 있는 키")
  assert.deepEqual(enKeys.filter((k) => !(k in ko)), [], "en 에만 있는 키")
})

test("값은 비어 있지 않고, 같은 키의 자리표시 이름이 두 언어에서 같다", () => {
  for (const key of Object.keys(en)) {
    assert.ok(en[key].trim() && ko[key].trim(), `${key} 비어 있음`)
    assert.deepEqual(placeholders(ko[key]), placeholders(en[key]), `${key} 자리표시`)
  }
})

test("ko 는 해요체다 — 합쇼체 어미(습니다·합니다·입니다·십시오)가 없다", () => {
  const bad = Object.entries(ko).filter(([, v]) => /(습니다|합니다|입니다|십시오|됩니다)/.test(v))
  assert.deepEqual(bad, [])
  // 양성 대조: 같은 식이 합쇼체를 잡는다
  assert.match("구독이 해지되었습니다.", /(습니다|합니다|입니다|십시오|됩니다)/)
})

test("키 검사 양성 대조 — 한쪽에만 키를 더하면 잡힌다", () => {
  const extra = leaves({ ...DEFAULT_MESSAGES.ko, email: { ...DEFAULT_MESSAGES.ko.email, extra: { x: "y" } } })
  assert.deepEqual(Object.keys(extra).filter((k) => !(k in en)), ["email.extra.x"])
})
