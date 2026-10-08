// K03(설정 부분): 사업자 정보는 환경 변수에서 읽고, 빈 칸은 숨긴다. 시험값은 모두 눈에 띄게 가짜다(실제 값을 코드·시험에 두지 않는다).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  BUSINESS_ENV,
  BUSINESS_ENV_NAMES,
  BUSINESS_KEYS,
  PLAIN_NAMES,
  REQUIRED_BUSINESS_KEYS,
  businessInfo,
  filledBusinessInfo,
  missingRequiredBusinessInfo,
} from "../src/index.ts"

const FAKE = {
  LF_BUSINESS_NAME: "Example Co.",
  LF_BUSINESS_OWNER: "Example Owner",
  LF_BUSINESS_ADDRESS: "1 Example Street, Example City",
  LF_BUSINESS_PHONE: "+82 10-0000-0000",
  LF_BUSINESS_EMAIL: "hello@example.test",
  LF_BUSINESS_REG_NO: "000-00-00000",
  LF_MAIL_ORDER_NO: "0000-Example-0000",
  LF_HOSTING_PROVIDER: "Example Hosting Inc.",
}

test("K03 이름: 여덟 칸이 모두 있고 읽는 이름 목록(PLAIN_NAMES)에 들어 있다 — doctor 가 사용자 환경에서도 읽는다", () => {
  assert.deepEqual(BUSINESS_ENV_NAMES.slice().sort(), Object.keys(FAKE).sort())
  assert.equal(BUSINESS_KEYS.length, 8)
  for (const n of BUSINESS_ENV_NAMES) assert.ok(PLAIN_NAMES.includes(n), n)
  assert.equal(new Set(PLAIN_NAMES).size, PLAIN_NAMES.length, "이름 중복 없음")
})

test("K03 businessInfo: 모든 칸은 선택 — 빈 환경이면 빈 객체, 값은 앞뒤 공백을 뗀다, 공백뿐인 칸은 없는 것", () => {
  assert.deepEqual(businessInfo({}), {})
  assert.deepEqual(businessInfo({ LF_BUSINESS_NAME: "  Example Co.  ", LF_BUSINESS_PHONE: "   ", LF_BUSINESS_EMAIL: "" }), { name: "Example Co." })
  assert.deepEqual(businessInfo(FAKE), {
    name: "Example Co.",
    owner: "Example Owner",
    address: "1 Example Street, Example City",
    phone: "+82 10-0000-0000",
    email: "hello@example.test",
    regNo: "000-00-00000",
    mailOrderNo: "0000-Example-0000",
    hostingProvider: "Example Hosting Inc.",
  })
})

test("K03 filledBusinessInfo: 채워진 칸만, 표시 순서(상호→대표자→주소→전화→이메일→등록번호→신고번호→호스팅)로 — 빈 칸은 숨긴다", () => {
  const some = filledBusinessInfo({ LF_HOSTING_PROVIDER: "Example Hosting Inc.", LF_BUSINESS_NAME: "Example Co.", LF_BUSINESS_PHONE: "+82 10-0000-0000", LF_BUSINESS_ADDRESS: "" })
  assert.deepEqual(some.map((f) => f.key), ["name", "phone", "hostingProvider"])
  assert.deepEqual(some.map((f) => f.value), ["Example Co.", "+82 10-0000-0000", "Example Hosting Inc."])
  assert.deepEqual(some.map((f) => f.envName), ["LF_BUSINESS_NAME", "LF_BUSINESS_PHONE", "LF_HOSTING_PROVIDER"])
  assert.ok(some.every((f) => f.label.length > 0))
  assert.deepEqual(filledBusinessInfo({}), [])
  assert.deepEqual(filledBusinessInfo(FAKE).map((f) => f.key), BUSINESS_KEYS)
})

test("K03 필수 칸: 상호·대표자·주소·전화·이메일·등록번호·호스팅은 표시 의무, 통신판매업 신고번호는 면제 사업자면 비워도 된다", () => {
  assert.deepEqual(REQUIRED_BUSINESS_KEYS, ["name", "owner", "address", "phone", "email", "regNo", "hostingProvider"])
  assert.ok(!REQUIRED_BUSINESS_KEYS.includes("mailOrderNo"))
  assert.deepEqual(missingRequiredBusinessInfo({}), REQUIRED_BUSINESS_KEYS.map((k) => BUSINESS_ENV[k]))
  assert.deepEqual(missingRequiredBusinessInfo(FAKE), [])
  // 신고번호만 비어 있어도 통과
  const noMailOrder = { ...FAKE, LF_MAIL_ORDER_NO: "" }
  assert.deepEqual(missingRequiredBusinessInfo(noMailOrder), [])
  // 하나 비면 그 이름만
  assert.deepEqual(missingRequiredBusinessInfo({ ...FAKE, LF_BUSINESS_REG_NO: "  " }), ["LF_BUSINESS_REG_NO"])
})

test("K03 process.env 기본값: env 인자를 안 주면 process.env 를 읽는다", () => {
  const saved = process.env.LF_BUSINESS_NAME
  try {
    process.env.LF_BUSINESS_NAME = "Example Co."
    assert.equal(businessInfo().name, "Example Co.")
    delete process.env.LF_BUSINESS_NAME
    assert.equal(businessInfo().name, undefined)
  } finally {
    if (saved === undefined) delete process.env.LF_BUSINESS_NAME
    else process.env.LF_BUSINESS_NAME = saved
  }
})

test("K03 하드코딩 금지: 이 저장소의 소스·예시에는 사업자 칸 값이 비어 있거나 눈에 띄게 가짜다(.env.example 의 LF_BUSINESS_*·LF_MAIL_ORDER_NO·LF_HOSTING_PROVIDER 는 빈 값)", () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url))
  const example = readFileSync(join(root, ".env.example"), "utf8")
  for (const n of BUSINESS_ENV_NAMES) {
    const m = new RegExp(`^${n}=(.*)$`, "m").exec(example)
    assert.ok(m, `${n} 이 .env.example 에 없다`)
    assert.equal(m[1].trim(), "", `${n} 의 예시 값은 비어 있어야 한다`)
  }
  // 소스에 칸 이름 옆에 값을 대입한 곳이 없다(env 읽기 파일 자신 제외) — 이름만 쓰는 곳은 이 목록에 없다
  const src = readFileSync(join(root, "packages/env/src/business.ts"), "utf8")
  assert.doesNotMatch(src, /LF_BUSINESS_[A-Z_]+\s*[:=]\s*["'][^"']+["']/, "business.ts 에 값 대입이 없다")
})
