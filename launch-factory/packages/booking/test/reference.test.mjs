import { test } from "node:test"
import assert from "node:assert/strict"
import { newReference, normalizeReference, REFERENCE_PATTERN } from "../src/reference.ts"

test("접수 번호: B- + 헷갈리는 글자(I·L·O·U)가 없는 8자, 만들 때마다 다르다", () => {
  const seen = new Set()
  for (let i = 0; i < 500; i++) {
    const ref = newReference()
    assert.match(ref, REFERENCE_PATTERN)
    assert.ok(!/[ILOU]/.test(ref.slice(2)), ref)
    seen.add(ref)
  }
  assert.ok(seen.size > 495)
})

test("사람이 적은 접수 번호는 느슨하게 읽는다 — 소문자·공백·O→0·I/L→1, 하이픈 생략", () => {
  assert.equal(normalizeReference("B-7K3M9P2A"), "B-7K3M9P2A")
  assert.equal(normalizeReference(" b-7k3m 9p2a "), "B-7K3M9P2A")
  assert.equal(normalizeReference("b7k3m9p2a"), "B-7K3M9P2A")
  assert.equal(normalizeReference("B-O1IL0000"), "B-01110000")
  for (const bad of ["", "B-123", "Q-7K3M9P2A", "B-7K3M9P2AA", "B-7K3M9P2U", null, undefined, 42, "B-7K3M9P2A; drop table"]) assert.equal(normalizeReference(bad), null, String(bad))
})
