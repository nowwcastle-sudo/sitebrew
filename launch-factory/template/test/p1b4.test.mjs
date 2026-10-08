// P1B4 — 법무·정책 확인 묶음(B4)의 시험: F10 EU 판매 스위치 · C08 복구 불가 고지 · J09 점검표 · F06 Retain 문서.
// 빌드·서버 없이 돈다(순수 함수는 실행, 이음은 소스 정규식). 브라우저 판정은 scripts/adb-walk.mjs 의 p1b4 와 npm run template:screens 가 한다(docs/qa/ux-audit/apply-b4.md).
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const ROOT = join(T, "..")
const read = (p) => readFileSync(join(T, p), "utf8")
const readRoot = (p) => readFileSync(join(ROOT, p), "utf8")

registerHooks({
  resolve: (spec, ctx, next) => {
    if (spec.startsWith("@/")) {
      for (const ext of [".ts", "/index.ts"]) {
        const file = join(T, spec.slice(2) + ext)
        if (existsSync(file)) return next(pathToFileURL(file).href, ctx)
      }
    }
    return next(spec, ctx)
  },
})

const EU27 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]
const EU = "../lib/launch/eu-sales.ts"

test("F10 EU 판매 스위치: 기본은 열림(운영자 결정 2026-10-08 — EU 에 판다) — 닫는 값은 off·0·false·no 뿐이다(LF_EU_SALES)", async () => {
  const { euSalesOpen } = await import(EU)
  for (const v of ["off", "OFF", "0", "false", "No", " off "]) assert.equal(euSalesOpen(v), false, JSON.stringify(v))
  for (const v of [undefined, null, "", " ", "on", "1", "true", "yes", "maybe"]) assert.equal(euSalesOpen(v), true, JSON.stringify(v))
})

test("F10 EU 27개국 목록 — 영국·스위스·노르웨이(EEA)·한국·미국은 들어 있지 않다(질문서로 따로 묻는다)", async () => {
  const { EU_COUNTRIES, isEuCountry } = await import(EU)
  assert.deepEqual([...EU_COUNTRIES].sort(), [...EU27].sort())
  for (const c of EU27) assert.equal(isEuCountry(c), true, c)
  for (const c of ["GB", "CH", "NO", "IS", "LI", "KR", "US", "JP", "AU"]) assert.equal(isEuCountry(c), false, c)
  assert.equal(isEuCountry("de"), true, "소문자도 같은 나라")
  assert.equal(isEuCountry(undefined), false)
})

test("F10 판정: 닫혀 있으면 고른 나라나 접속 지역 중 하나라도 EU 면 막는다 — 고른 나라로 차단을 풀 수 없다(v0.1.1 리뷰 P1-1)", async () => {
  const { regionVerdict } = await import(EU)
  assert.deepEqual(regionVerdict({ open: false, declared: "KR", geo: "DE" }), { kind: "unavailable", country: "DE" }, "독일 접속자가 한국을 골라도 막힌다(리뷰 재현)")
  assert.deepEqual(regionVerdict({ open: false, declared: "DE", geo: "KR" }), { kind: "unavailable", country: "DE" }, "EU 결제 국가를 고르면 막힌다")
  assert.deepEqual(regionVerdict({ open: false, geo: "FR" }), { kind: "unavailable", country: "FR" })
  assert.deepEqual(regionVerdict({ open: false, declared: "KR", geo: "KR" }), { kind: "ok", country: "KR" })
  assert.deepEqual(regionVerdict({ open: false }), { kind: "ok", country: null }, "나라를 모르면(로컬·목업) 통과")
  assert.deepEqual(regionVerdict({ open: true, declared: "DE", geo: "DE" }), { kind: "ok", country: "DE" }, "열려 있으면 통과")
  // 모양·목록에 없는 값은 없는 값: 배열·세 글자·ZZ·XX·T1·주입 문자열
  for (const bad of [["KR", "DE"], "KOR", "ZZ", "XX", "T1", "<script>"]) assert.deepEqual(regionVerdict({ open: false, declared: bad }), { kind: "ok", country: null }, JSON.stringify(bad))
})

test("F10 서버 입구 gateCheckout: EU 는 기계 값 region_unavailable 로 막고 결제 입력을 돌려주지 않는다 · 그 밖은 나라 칸만 떼고 통과 · FormData 는 그대로", async () => {
  const { gateCheckout, EU_GATE_MESSAGES } = await import(EU)
  const messages = EU_GATE_MESSAGES.en
  const base = { planId: "pro", withdrawalConsent: true }
  const blocked = gateCheckout({ ...base, billingCountry: "KR" }, { open: false, geo: "DE", messages })
  assert.deepEqual([blocked.ok, blocked.code, blocked.retryable, blocked.formError], [false, "region_unavailable", false, messages.unavailable])
  assert.equal(gateCheckout({ ...base, billingCountry: "DE" }, { open: false, messages }).code, "region_unavailable")
  assert.deepEqual(gateCheckout(base, { open: false, messages }), { ok: true, input: base }, "나라를 모르면 통과")
  assert.deepEqual(gateCheckout({ ...base, billingCountry: "KR" }, { open: false, geo: "KR", messages }), { ok: true, input: base }, "나라 칸은 결제 포트로 넘기지 않는다")
  assert.deepEqual(gateCheckout({ ...base, billingCountry: "DE" }, { open: true, geo: "DE", messages }), { ok: true, input: base }, "스위치가 열려 있으면 통과")
  assert.equal(gateCheckout("not an object", { open: false, messages }).code, "invalid_input")
  const fd = new FormData()
  fd.set("planId", "pro")
  fd.set("billingCountry", "KR")
  const fdPass = gateCheckout(fd, { open: false, messages })
  assert.equal(fdPass.ok, true)
  assert.equal(fdPass.input, fd, "같은 FormData")
  assert.equal(fd.get("planId"), "pro")
  assert.equal(fd.get("billingCountry"), null, "나라 칸은 뗀다")
  const fdEu = new FormData()
  fdEu.set("billingCountry", "KR")
  assert.equal(gateCheckout(fdEu, { open: false, geo: "FR", messages }).code, "region_unavailable", "FormData 도 접속 지역이 EU 면 막는다")
  for (const l of ["en", "ko"]) for (const k of ["invalid", "unavailable"]) assert.ok(EU_GATE_MESSAGES[l][k].length > 5, `${l}.${k}`)
})

test("F10 euGate: 요청 밖에서 headers() 가 던져도 지역 모름으로 통과하고, 접속 지역 머리를 읽는다", async () => {
  const { euGate, GEO_HEADER } = await import(EU)
  const throwing = () => { throw new Error("`headers` was called outside a request scope") }
  assert.deepEqual(await euGate({ planId: "pro" }, throwing), { ok: true, input: { planId: "pro" } })
  const de = async () => ({ get: (n) => (n === GEO_HEADER ? "DE" : null) })
  const prev = process.env.LF_EU_SALES
  try {
    delete process.env.LF_EU_SALES
    assert.equal((await euGate({ planId: "pro" }, de)).ok, true, "기본(빈 값)은 열림 — 독일 접속도 결제된다")
    process.env.LF_EU_SALES = "off"
    assert.equal((await euGate({ planId: "pro" }, de)).code, "region_unavailable", "off 로 닫으면 막힌다")
  } finally {
    if (prev === undefined) delete process.env.LF_EU_SALES
    else process.env.LF_EU_SALES = prev
  }
})

test("F10 문구: 안내 문구가 화면 언어(영어)로 있고, 아무것도 청구되지 않았다고 말한다", async () => {
  const { euSalesCopy } = await import("../content/copy.ux.en.ts")
  for (const s of [euSalesCopy.pricingNote, euSalesCopy.unavailable.title, euSalesCopy.unavailable.body, euSalesCopy.unavailable.back]) {
    assert.equal(typeof s, "string")
    assert.ok(s.length > 5 && !/[가-힣]/.test(s), s)
  }
  assert.match(euSalesCopy.pricingNote, /European Union/)
  assert.match(euSalesCopy.unavailable.body, /charged/i)
  assert.match(euSalesCopy.unavailable.body, /\{country\}/)
})

test("F10 이음: 결제 입구 셋(화면 product.checkout · startCheckout · startGumroadCheckout)이 모두 euGate 를 거치고, 공유 모듈이 결제 묶음 둘에 실린다(v0.1.1 리뷰 P1-2)", () => {
  const product = read("app/actions/product.ts")
  assert.match(product, /euGate(<[^>]*>)?\(/)
  assert.match(product, /if \(!g\.ok\) return coded\(g\)/, "막히면 결제 포트를 부르지 않는다")
  for (const f of ["registry/feature-billing-paddle/files/app/actions/billing.ts", "registry/feature-billing-gumroad/files/app/actions/gumroad-billing.ts", "template/app/actions/billing.ts"]) {
    const src = readRoot(f)
    assert.match(src, /const eu = await euGate(<[^>]*>)?\(input, headers/, f)
    assert.match(src, /if \(!eu\.ok\) return eu/, f)
    assert.match(src, /\(eu\.input\)/, `${f}: 통과한 입력(나라 칸 뗀 것)으로 결제한다`)
    assert.ok(src.indexOf("euGate(") < src.indexOf("withWithdrawalConsent("), `${f}: 관문이 동의 기록보다 바깥이다`)
  }
  for (const b of ["feature-billing-paddle", "feature-billing-gumroad"]) {
    const item = JSON.parse(readRoot(`registry/${b}/item.json`))
    assert.ok(item.files.includes("../_shared/lib/launch/eu-sales.ts"), b)
    assert.ok(item.envVars.includes("LF_EU_SALES"), b)
  }
  const upgrade = read("app/(product)/upgrade/page.tsx")
  assert.match(upgrade, /regionVerdict\(/)
  assert.match(upgrade, /<EuUnavailable\b/)
  const unavailable = read("components/product/eu-unavailable.tsx")
  assert.doesNotMatch(unavailable, /<form\b/, "EU 안내에는 나라를 바꿔 고르는 폼이 없다(우회 길이 된다)")
  const pricing = read("app/(product)/pricing/page.tsx")
  assert.match(pricing, /euSalesOpen\(/)
  const blocks = read("components/product/product-blocks.tsx")
  assert.match(blocks, /billingCountry/)
  assert.match(blocks, /euSalesCopy\.pricingNote/)
  const env = readRoot(".env.example")
  assert.match(env, /^LF_EU_SALES=/m)
})

test("C08 복구 불가 고지: 가입 화면과 이메일 변경 폼에 한 줄(영어)", async () => {
  const { signUpCopy } = await import("../content/copy.en.ts")
  const { credentialsCopy } = await import("../content/copy.account.en.ts")
  const line = "If you lose access to this email, we can’t recover the account."
  assert.ok(signUpCopy.lead.includes(line), signUpCopy.lead)
  assert.ok(credentialsCopy.email.newEmail.hint.includes(line), credentialsCopy.email.newEmail.hint)
  assert.ok(!/[가-힣]/.test(signUpCopy.lead))
})

test("J09 스크린리더 점검표: 출시 문서에 있다 — 출시 뒤 2주 안에 15분, 관문이 아니다", { skip: "asserts text of an internal QA document that is not part of the public export" }, () => {
  const doc = readRoot("docs/qa/release-owner-checklist.md")
  assert.match(doc, /스크린리더/)
  assert.match(doc, /2주/)
  assert.match(doc, /15분/)
  assert.match(doc, /관문이 아니다|관문에 넣지 않는다/)
  for (const flow of ["가입", "로그인", "결제", "해지"]) assert.ok(doc.includes(flow), flow)
})

test("F06 Paddle Retain: 켜기로 이미 결정 — 코드는 그대로이고 문서·환경 예시가 「Retain 을 켜면 우리 결제 실패 메일을 끈다」를 말한다(O30)", { skip: "asserts text of an internal QA document that is not part of the public export" }, () => {
  const env = readRoot(".env.example")
  assert.match(env, /Retain[^\n]*켜/, ".env.example")
  assert.match(env, /LF_PAYMENT_FAILED_EMAIL=\s*$/m, "기본값은 빈 칸(= 켜짐) 그대로")
  const doc = readRoot("docs/qa/release-owner-checklist.md")
  assert.match(doc, /Retain/)
  assert.match(doc, /LF_PAYMENT_FAILED_EMAIL=off/)
  assert.match(doc, /O30/)
})
