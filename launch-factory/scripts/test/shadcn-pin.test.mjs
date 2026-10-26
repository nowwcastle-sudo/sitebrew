// shadcn 판 일치 시험 — 판의 주인은 template/package.json 하나이고(scripts/pins.mjs 가 읽는다),
// 나머지 두 곳(template.lock.json · package-lock.json)은 손으로 맞출 수밖에 없는 파일이라 어긋나면 여기서 실패한다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SHADCN, exactPin } from "../pins.mjs"

const json = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8"))

test("template/package.json · template.lock.json · package-lock.json 의 shadcn 판이 같다", () => {
  assert.equal(json("template/template.lock.json").blocks.shadcn, SHADCN, "template.lock.json blocks.shadcn")
  const lock = json("package-lock.json").packages
  assert.equal(lock["node_modules/shadcn"].version, SHADCN, "package-lock.json node_modules/shadcn")
  assert.equal(lock.template.devDependencies.shadcn, SHADCN, "package-lock.json template 항목")
})

test("pins.mjs 는 ^·~ 범위와 빠진 값을 거부한다(범위 하한을 읽는 사고를 막는다)", () => {
  assert.equal(exactPin({ devDependencies: { shadcn: "4.22.1" } }, "shadcn"), "4.22.1")
  assert.throws(() => exactPin({ devDependencies: { shadcn: "^4.22.1" } }, "shadcn"), /정확한 x\.y\.z/)
  assert.throws(() => exactPin({ devDependencies: {} }, "shadcn"), /정확한 x\.y\.z/)
})
