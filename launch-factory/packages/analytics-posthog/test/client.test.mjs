import { test } from "node:test"
import assert from "node:assert/strict"
import { createPostHogAnalytics, ATTRIBUTION_PROPERTY, posthogInitConfig, armFromFlag, POSTHOG_CSP } from "../src/index.ts"
import { securityHeaders, createNonce } from "../../security/src/index.ts"
import { DECIDED, fakePostHogJs } from "./fakes.mjs"

const ATTR = { blockId: "hero-split", recipeId: "r1-measure", copyVariant: "b", experiment: { key: "hero-cta", arm: "b" } }
const CTA = { id: "hero-primary", label: "Start", section: "hero-split" }

function setup(extra = {}) {
  const ph = fakePostHogJs()
  let loads = 0
  const rejected = []
  const saved = []
  const port = createPostHogAnalytics({
    projectKey: "phc_test",
    region: "us",
    load: () => {
      loads += 1
      return ph
    },
    location: () => ({}),
    onReject: (r) => rejected.push(r),
    onConsentChange: (c) => saved.push(c),
    now: () => new Date(DECIDED),
    ...extra,
  })
  return { ph, port, rejected, saved, loads: () => loads }
}

// ── 동의(Review Focus 2) ─────────────────────────────────────────────

test("동의 결정 전(unset): 첫 page_view 포함 0건, SDK 를 불러오지도 init 하지도 않는다", async () => {
  const { ph, port, loads } = setup()
  assert.deepEqual(port.consent(), { analytics: false, marketing: false })
  port.track("page_view", { path: "/" })
  port.track("cta_click", CTA, { attribution: ATTR })
  await port.flush()
  assert.equal(loads(), 0)
  assert.deepEqual(ph.calls, [])
})

test("동의 뒤에는 보내고, 동의 전 이벤트는 쌓아 두었다 보내지 않는다", async () => {
  const { ph, port, saved } = setup()
  port.track("page_view", { path: "/before" })
  port.track("cta_click", CTA)
  port.setConsent({ analytics: true, marketing: false })
  assert.deepEqual(saved, [{ analytics: true, marketing: false, decidedAt: DECIDED }])
  port.track("page_view", { path: "/after", referrerKind: "direct" })
  await port.flush()
  const caps = ph.captures()
  assert.equal(caps.length, 1, JSON.stringify(caps))
  assert.equal(caps[0].event, "page_view")
  assert.equal(caps[0].properties.path, "/after")
  // init → opt_in(이벤트 없이) → capture 순서. 동의 전 두 건은 어디에도 없다
  assert.deepEqual(ph.calls.map((c) => c[0]), ["init", "opt_in_capturing", "capture"])
  assert.deepEqual(ph.calls[1][1], { captureEventName: false })
  assert.equal(ph.delivered.length, 1)
})

test("거부(analytics false 결정)도 0건이고 SDK 를 불러오지 않는다", async () => {
  const { ph, port, loads } = setup()
  port.setConsent({ analytics: false, marketing: true })
  port.track("cta_click", CTA)
  await port.flush()
  assert.equal(loads(), 0)
  assert.deepEqual(ph.calls, [])
  assert.equal(port.consent().decidedAt, DECIDED)
})

test("철회하면 opt_out 하고 그 뒤 이벤트는 SDK 로 가지 않는다", async () => {
  const { ph, port } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED } })
  port.track("cta_click", CTA)
  await port.flush()
  port.setConsent({ analytics: false, marketing: false })
  port.track("cta_click", CTA)
  await port.flush()
  assert.equal(ph.captures().length, 1)
  assert.equal(ph.calls.at(-1)[0], "opt_out_capturing")
})

test("SDK 를 불러오는 사이 철회하면, 동의 중에 부른 이벤트도 보내지 않는다", async () => {
  let release
  const ph = fakePostHogJs()
  const { port } = setup({ load: () => new Promise((r) => (release = () => r(ph))) })
  port.setConsent({ analytics: true, marketing: false })
  port.track("cta_click", CTA)
  port.setConsent({ analytics: false, marketing: false })
  await new Promise((r) => setImmediate(r)) // load 는 마이크로태스크 뒤에 불린다
  release()
  await port.flush()
  assert.equal(ph.captures().length, 0)
  assert.ok(!ph.calls.some((c) => c[0] === "opt_in_capturing"), "철회 뒤에 opt_in 하면 안 된다")
})

test("init 설정: 기본 opt-out, 자동 수집 모두 끔, before_send 가 동의를 다시 본다", () => {
  let ok = false
  const cfg = posthogInitConfig("https://us.i.posthog.com", () => ok)
  assert.equal(cfg.opt_out_capturing_by_default, true)
  for (const k of ["autocapture", "capture_pageview", "capture_pageleave", "capture_performance", "capture_exceptions", "capture_heatmaps", "capture_dead_clicks", "rageclick"]) {
    assert.equal(cfg[k], false, k)
  }
  assert.equal(cfg.disable_session_recording, true)
  assert.equal(cfg.disable_surveys, true)
  assert.equal(cfg.disable_external_dependency_loading, true)
  assert.equal(cfg.person_profiles, "identified_only")
  assert.equal(cfg.mask_personal_data_properties, true)
  assert.ok(cfg.custom_personal_data_properties.includes("email"))
  const cr = { uuid: "u", event: "x", properties: {} }
  assert.equal(cfg.before_send(cr), null)
  ok = true
  assert.equal(cfg.before_send(cr), cr)
})

// ── 출처 태그 속성 이름 ────────────────────────────────────────────────

test("출처 태그는 wf_block·wf_recipe·wf_copy·wf_experiment 속성으로, props 와 따로 간다", async () => {
  const { ph, port } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED } })
  assert.deepEqual(ATTRIBUTION_PROPERTY, { blockId: "wf_block", recipeId: "wf_recipe", copyVariant: "wf_copy", experiment: "wf_experiment" })
  port.track("cta_click", CTA, { attribution: ATTR })
  port.track("cta_click", CTA, { attribution: { blockId: "faq-single-accordion" } })
  port.track("cta_click", CTA)
  await port.flush()
  const [full, partial, none] = ph.captures().map((c) => c.properties)
  assert.deepEqual(full, { ...CTA, wf_block: "hero-split", wf_recipe: "r1-measure", wf_copy: "b", wf_experiment: "hero-cta:b" })
  assert.deepEqual(partial, { ...CTA, wf_block: "faq-single-accordion" })
  assert.deepEqual(none, CTA)
  for (const p of [full, partial, none]) assert.ok(!("attribution" in p) && !("blockId" in p) && !("experiment" in p))
})

test("props 에 wf_ 이름을 쓰거나 실험 키에 ':' 가 있으면 거부한다(태그와 섞이지 않게)", async () => {
  const { ph, port, rejected } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED } })
  port.track("cta_click", { ...CTA, wf_block: "x" })
  port.track("cta_click", CTA, { attribution: { experiment: { key: "a:b", arm: "c" } } })
  await port.flush()
  assert.equal(ph.captures().length, 0)
  assert.equal(rejected.length, 2)
})

// ── 개인정보 모양 props 거부 ──────────────────────────────────────────

test("개인정보 모양 props 는 거부한다 — 칸 이름(이메일·전화·이름·주소)과 값(이메일·전화·주소)", async () => {
  const { ph, port, rejected } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED } })
  const bad = [
    { form: "contact", email: "x" },
    { form: "contact", phoneNumber: "x" },
    { form: "contact", userName: "x" },
    { form: "contact", fullName: "x" },
    { form: "contact", shippingAddress: "x" },
    { form: "contact", zip: "x" },
    { form: "kim.minsu@example.co.kr" },
    { form: "010-1234-5678" },
    { form: "+82 10 1234 5678" },
    { form: "서울특별시 강남구 테헤란로 123" },
    { form: "판교역로 235" },
    { form: "1600 Amphitheatre Parkway" },
    { form: "123 Main St" },
    { form: "Bearer abc.def" },
  ]
  for (const props of bad) port.track("form_start", props)
  // 경로 모양 칸 속 이메일(page_view path 에 섞인 경우)
  port.track("page_view", { path: "/u/kim@example.com", referrerKind: "direct" })
  await port.flush()
  assert.equal(ph.captures().length, 0, JSON.stringify(ph.captures()))
  assert.equal(rejected.length, bad.length + 1)
  // 거부 기록에는 값이 없다(경로·이름만)
  assert.ok(!JSON.stringify(rejected).includes("kim.minsu@example.co.kr"))
  assert.ok(!JSON.stringify(rejected).includes("010-1234-5678"))
})

test("개인정보 거부 음성 대조: 이름 표(events.ts)의 보통 props 는 그대로 보낸다", async () => {
  const { ph, port, rejected } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED } })
  const ok = [
    ["cta_click", { id: "hero-primary", label: "시작하기", section: "hero-split" }],
    ["form_error", { form: "contact", fields: ["email", "phone"], kind: "field" }], // 칸 이름 목록(값이 아니다)은 이메일 모양이 아니다
    ["checkout_complete", { planId: "pro", amount: 29_000, currency: "KRW" }],
    ["onboarding_step_complete", { step: "profile", index: 1, total: 3 }],
    ["page_view", { path: "/pricing/2026-09-30", utmSource: "chatgpt.com", referrerKind: "ai" }],
    ["limit_reached", { limit: "projects", used: 3, max: 3 }],
    ["activation", { milestone: "order-1234567890" }],
    ["upgrade_prompt_view", { trigger: "3단계로 5분" }],
  ]
  for (const [name, props] of ok) port.track(name, props)
  await port.flush()
  assert.deepEqual(rejected, [])
  assert.equal(ph.captures().length, ok.length)
})

// ── page_view 유입 분류 ────────────────────────────────────────────────

test("page_view 에 referrerKind 가 없으면 리퍼러·utm 으로 채운다", async () => {
  const locs = [
    { href: "https://shop.example.com/?utm_source=chatgpt.com", hostname: "shop.example.com", referrer: "" },
    { href: "https://shop.example.com/", hostname: "shop.example.com", referrer: "https://www.google.co.kr/" },
    { href: "https://shop.example.com/b", hostname: "shop.example.com", referrer: "https://shop.example.com/a" },
  ]
  let i = 0
  const { ph, port } = setup({ consent: { analytics: true, marketing: false, decidedAt: DECIDED }, location: () => locs[i++] })
  port.track("page_view", { path: "/" })
  port.track("page_view", { path: "/" })
  port.track("page_view", { path: "/b" })
  port.track("page_view", { path: "/", referrerKind: "social" }) // 준 값은 건드리지 않는다
  await port.flush()
  assert.deepEqual(
    ph.captures().map((c) => c.properties),
    [
      { path: "/", utmSource: "chatgpt.com", referrerKind: "ai" },
      { path: "/", referrerKind: "search" },
      { path: "/b", referrerKind: "direct" },
      { path: "/", referrerKind: "social" },
    ],
  )
})

// ── 실험 스위치 ───────────────────────────────────────────────────────

test("experiment: 동의 전 control, 플래그를 받으면 그 갈래, 철회하면 다시 control", async () => {
  const { ph, port } = setup()
  let changes = 0
  port.onExperimentsChange(() => changes++)
  assert.equal(port.experiment("hero-cta"), "control")
  port.setConsent({ analytics: true, marketing: false })
  await port.flush()
  assert.equal(port.experiment("hero-cta"), "control") // 아직 플래그 없음
  ph.receiveFlags({ "hero-cta": "b", "on-off": true, off: false })
  assert.equal(port.experiment("hero-cta"), "b")
  assert.equal(port.experiment("on-off"), "test")
  assert.equal(port.experiment("off"), "control")
  port.setConsent({ analytics: false, marketing: false })
  assert.equal(port.experiment("hero-cta"), "control")
  assert.ok(changes >= 3, `알림 ${changes}번`)
  assert.equal(armFromFlag(undefined), "control")
})

// ── 지역·CSP ─────────────────────────────────────────────────────────

test("지역·호스트: region 과 POSTHOG_HOST 로 수집 호스트와 국외 이전 값을 낸다", () => {
  const us = setup().port.region
  assert.equal(us.host, "https://us.i.posthog.com")
  assert.deepEqual(us.transfer, { countryCode: "US", place: "Virginia", provider: "Amazon Web Services", providerRegion: "us-east-1" })
  const eu = setup({ region: undefined, host: "https://eu.i.posthog.com/" }).port.region
  assert.equal(eu.region, "eu")
  assert.equal(eu.transfer.providerRegion, "eu-central-1")
  assert.equal(setup({ region: undefined, host: "https://eu.posthog.com" }).port.region.host, "https://eu.i.posthog.com")
  const proxy = setup({ region: "eu", host: "https://shop.example.com/ingest" }).port.region
  assert.equal(proxy.host, "https://shop.example.com/ingest")
  assert.throws(() => setup({ region: undefined, host: "https://shop.example.com/ingest" }), /region/)
  assert.throws(() => setup({ region: "us", host: "https://eu.i.posthog.com" }), /eu/)
  assert.throws(() => setup({ region: undefined, host: "http://us.i.posthog.com" }), /https/)
  assert.throws(() => setup({ projectKey: " " }), /O5/)
})

test("POSTHOG_CSP 를 securityHeaders extend 에 그대로 넣을 수 있다(D14 → Task 10)", () => {
  const csp = securityHeaders(createNonce(), { extend: POSTHOG_CSP }).get("content-security-policy")
  assert.match(csp, /connect-src [^;]*https:\/\/\*\.posthog\.com/)
  assert.match(csp, /script-src [^;]*https:\/\/\*\.posthog\.com/)
  assert.ok(!csp.includes("unsafe-inline"))
})
