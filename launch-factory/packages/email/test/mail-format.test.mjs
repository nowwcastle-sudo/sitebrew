// 메일 형식 검사(G02·G07·G03·A12·A13). 모든 템플릿을 ko·en 으로 렌더해 규칙을 확인한다 — 메일 품질이 사람 눈에만 달리지 않게(감사 G02: 메일을 재는 관문이 없었다).
//   G02 거래 메일 형식: 제목에 제품 이름과 할 일 · 첫 줄이 행동 하나(단추 위에 있고 한 문단) · 단추마다 바로 아래 글자 링크 · 링크가 만료되면 유효 시간 · 왜 받는지 한 줄 · 화면과 같은 언어
//   G07 종류 표: 모든 템플릿이 거래·법정 안내 또는 광고성 중 하나 · 거래 템플릿은 광고 블록을 못 싣는다
//   G03 광고 메일 어댑터: 제목 「(광고)」· 사업자 표시 · 한·영 수신거부 · 헤더 둘(RFC 8058) · 값은 설정에서만
import { test } from "node:test"
import assert from "node:assert/strict"
import { createMailer, EmailRenderError, kindOf, MarketingComplianceError, renderEmail, TEMPLATE_META, TEMPLATE_NAMES, validityOf, adSubject } from "../src/index.ts"
import { ADVERTISING, APP, inputs } from "./fixtures.mjs"

const HANGUL = /[ㄱ-ㆎ가-힣]/
const escape = (s) => s.replaceAll("&", "&amp;")

/** 단추(눈에 띄는 것·보조) 링크와 단추 아래 글자 링크를 HTML 에서 뽑는다 */
function anchors(html) {
  const out = { primary: [], secondary: [], fallback: [] }
  for (const m of html.matchAll(/<a href="([^"]+)" style="([^"]*)"/g)) {
    const [, href, style] = m
    if (style.includes("background-color:#1a1a1a")) out.primary.push(href)
    else if (style.includes("border:1px solid #1a1a1a")) out.secondary.push(href)
  }
  for (const m of html.matchAll(/<p data-skip-in-text="true" data-lf-fallback-link="true"[^>]*>[^<]*<a href="([^"]+)"[^>]*>([^<]+)<\/a><\/p>/g)) out.fallback.push({ href: m[1], text: m[2] })
  return out
}

/** 평문을 문단 목록으로. 첫 칸은 제목, 둘째는 인사 */
const paragraphs = (text) => text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)

const SEPARATOR = /^-{10,}$/
const footerOf = (text) => {
  const parts = paragraphs(text)
  const i = parts.findIndex((p) => SEPARATOR.test(p))
  return i < 0 ? [] : parts.slice(i + 1)
}

const allMails = []
for (const locale of ["ko", "en"]) for (const name of TEMPLATE_NAMES) allMails.push({ locale, name })

// ── G07: 종류 표 ──────────────────────────────────────────────────────────────
test("G07: 종류 표가 모든 템플릿을 한 번씩 담고, 값은 transactional·marketing 둘 중 하나다", () => {
  assert.deepEqual(Object.keys(TEMPLATE_META).sort(), [...TEMPLATE_NAMES].sort())
  for (const name of TEMPLATE_NAMES) assert.ok(["transactional", "marketing"].includes(kindOf(name)), name)
  assert.deepEqual(TEMPLATE_NAMES.filter((n) => kindOf(n) === "marketing"), ["marketingAnnouncement"])
})

for (const { locale, name } of allMails.filter(({ name }) => kindOf(name) === "transactional")) {
  test(`G07: 거래 템플릿 ${name}(${locale}) 은 광고 블록·(광고) 표기·광고 바닥글이 없고, promo 입력은 거절한다`, async () => {
    const input = inputs(locale)[name]
    const mail = await renderEmail(name, input)
    assert.ok(!mail.html.includes("data-lf-promo") && !mail.html.includes("data-lf-ad-footer"), "광고 표지 없음")
    assert.ok(!mail.subject.includes("(광고)"), "제목에 (광고) 없음")
    await assert.rejects(renderEmail(name, { ...input, promo: { text: "Save 20% today" } }), (e) => e instanceof EmailRenderError && /promo/.test(e.message))
  })
}

test("G07: 광고성 템플릿은 법정 표시 입력이 없으면 렌더하지 않는다(칸마다)", async () => {
  const input = inputs("en").marketingAnnouncement
  await assert.rejects(renderEmail("marketingAnnouncement", { ...input, advertising: undefined }), EmailRenderError)
  for (const key of ["senderName", "senderEmail", "senderPhone", "senderAddress", "unsubscribeUrl"]) {
    await assert.rejects(renderEmail("marketingAnnouncement", { ...input, advertising: { ...ADVERTISING, [key]: "" } }), (e) => e instanceof EmailRenderError && e.problems.some((p) => p.includes(key)), key)
  }
  await assert.rejects(renderEmail("marketingAnnouncement", { ...input, advertising: { ...ADVERTISING, unsubscribeUrl: "http://insecure.example/unsub" } }), EmailRenderError, "https 아닌 수신거부 주소")
  await assert.rejects(renderEmail("marketingAnnouncement", { ...input, paragraphs: [] }), EmailRenderError)
})

// ── G02: 모든 템플릿 × ko·en ──────────────────────────────────────────────────
for (const { locale, name } of allMails) {
  const meta = TEMPLATE_META[name]
  test(`G02: ${name}(${locale}) 형식 — 제목·첫 줄·단추 링크·유효 시간·수신 사유·언어`, async () => {
    const input = inputs(locale)[name]
    const mail = await renderEmail(name, input)
    const { subject, html, text } = mail
    const who = [input.productName, input.senderName, input.advertising?.senderName].filter(Boolean)

    // 제목: 제품(또는 전송자) 이름 + 할 일을 말하는 말(세 어절 이상)
    const bare = subject.replace(/^\(광고\)\s*/, "")
    if (name !== "marketingAnnouncement") assert.ok(who.some((w) => subject.toLowerCase().includes(w.toLowerCase().replace(/ inc\.$/, ""))), `제목에 제품·전송자 이름: ${subject}`)
    assert.ok(bare.split(/\s+/).length >= 3, `제목이 할 일을 말한다(세 어절 이상): ${subject}`)

    // 단추: 눈에 띄는 단추는 행동 하나(action: one)이거나 없다(none)
    const a = anchors(html)
    assert.equal(a.primary.length, meta.action === "one" ? 1 : 0, `눈에 띄는 단추 수 ${JSON.stringify(a.primary)}`)
    // 단추마다 바로 아래 같은 주소의 글자 링크 — 글자 링크 수 = 단추 수, 주소 일치, 보이는 글자도 같은 주소
    const buttons = [...a.primary, ...a.secondary]
    assert.deepEqual(a.fallback.map((f) => f.href), buttons, "글자 링크가 단추와 같은 순서·주소")
    for (const f of a.fallback) assert.equal(f.text, f.href, "보이는 글자가 주소 그대로")
    for (const href of buttons) assert.ok(text.includes(href.replaceAll("&amp;", "&")), `평문에도 주소가 있다: ${href}`)

    // 첫 줄: 인사 다음 첫 문단이 한 문단·짧고, 행동 메일이면 주소보다 먼저 나온다
    const parts = paragraphs(text)
    const first = parts[2]
    assert.ok(first && first.length <= 240, `첫 문단이 짧다: ${first}`)
    if (meta.action === "one") assert.ok(text.indexOf(first) < text.search(/https?:\/\//), "행동 단추보다 설명이 먼저")

    // 링크 유효 시간
    if (meta.expires === "duration") assert.match(text, locale === "ko" ? /\d+(분|시간|일) 동안/ : /\b(\d+ (minutes|hours|days)|1 hour)\b/, "유효 시간 문구")
    if (meta.expires === "deadline") assert.match(text, /2026/, "동의 기한 날짜")

    // 왜 받는지: 구분선 아래에 한 줄 이상
    const footer = footerOf(text)
    assert.ok(footer.length >= 1 && footer.join(" ").length >= 20, "바닥글(수신 사유)")
    assert.match(footer.join(" "), locale === "ko" ? /(메일이에요|보내 드려요)/ : /(because|advertisement)/i, "수신 사유 문구")

    // 언어: 같은 언어. 광고성은 법정 한·영 병기가 있다
    if (kindOf(name) === "transactional") {
      if (locale === "en") assert.ok(!HANGUL.test(subject + text), "영어 메일에 한글 없음")
      if (locale === "ko") {
        assert.ok(HANGUL.test(subject), "한국어 메일의 제목은 한글")
        assert.ok(!/If the button doesn't work|You are receiving this email|copy this link/.test(text), "한국어 메일에 영어 상투문 없음")
      }
    }
  })
}

// ── A12·A13: 확인 메일 ─────────────────────────────────────────────────────────
test("A12: 확인 메일은 링크 유효 시간을 수치로 말한다(기본 60분 → 1시간, 값이 바뀌면 따라간다)", async () => {
  const en = inputs("en").verifyEmail
  assert.match((await renderEmail("verifyEmail", en)).text, /This link works for 1 hour\./)
  assert.match((await renderEmail("verifyEmail", { ...en, linkValidMinutes: 30 })).text, /works for 30 minutes\./)
  assert.match((await renderEmail("verifyEmail", { ...en, linkValidMinutes: 90 })).text, /works for 90 minutes\./)
  assert.match((await renderEmail("verifyEmail", { ...en, linkValidMinutes: 180 })).text, /works for 3 hours\./)
  assert.match((await renderEmail("verifyEmail", { ...en, linkValidMinutes: 2880 })).text, /works for 2 days\./)
  assert.match((await renderEmail("verifyEmail", inputs("ko").verifyEmail)).text, /이 링크는 1시간 동안만/)
  const noDuration = { ...en }
  delete noDuration.linkValidMinutes
  assert.match((await renderEmail("verifyEmail", noDuration)).text, /works for 1 hour/, "입력이 없으면 기본 60분")
  await assert.rejects(renderEmail("verifyEmail", { ...en, linkValidMinutes: 0 }), EmailRenderError)
  assert.equal(validityOf(60, "en"), "1 hour")
  assert.equal(validityOf(45, "ko"), "45분")
})

test("A13: 확인 메일에 「제가 가입한 게 아니에요」 경로가 있다(서명 링크 — 없으면 그 줄이 없다)", async () => {
  for (const locale of ["ko", "en"]) {
    const input = inputs(locale).verifyEmail
    const mail = await renderEmail("verifyEmail", input)
    assert.ok(mail.html.includes(`href="${input.notMeUrl}"`) && mail.text.includes(input.notMeUrl), "링크가 단추와 평문에 있다")
    assert.match(mail.text, locale === "ko" ? /제가 가입한 게 아니에요/ : /This wasn't me/)
    const without = await renderEmail("verifyEmail", { ...input, notMeUrl: undefined })
    assert.ok(!without.text.includes("not-me"), "링크 없으면 줄도 없다")
  }
  await assert.rejects(renderEmail("verifyEmail", { ...inputs("en").verifyEmail, notMeUrl: "/not-me" }), EmailRenderError)
})

// ── G03: 광고 메일 어댑터 ──────────────────────────────────────────────────────
const BUSINESS = { name: "Example Co.", email: "hello@example.test", phone: "+82 10-0000-0000", address: "1 Example-ro, Seoul 00000, KR" }
const UNSUB = `${APP}/api/marketing/unsubscribe?t=abc_DEF-123.sig`

function recorder() {
  const sent = []
  return {
    sent,
    client: {
      emails: {
        async send(payload, options) {
          sent.push({ payload, options })
          return { data: { id: `re_${sent.length}` }, error: null }
        },
      },
    },
  }
}
const announcement = (locale) => {
  const input = { ...inputs(locale).marketingAnnouncement }
  delete input.advertising
  return input
}

for (const locale of ["ko", "en"]) {
  test(`G03: 광고 메일(${locale}) — 제목 (광고)·사업자 표시·한·영 수신거부·헤더 둘·본문 링크 = 헤더 링크`, async () => {
    const { sent, client } = recorder()
    const mailer = createMailer({ mode: "live", from: "SampleCo <noreply@sampleco.test>", client, marketing: { business: BUSINESS } })
    const result = await mailer.send({ to: "user@example.test", template: "marketingAnnouncement", input: announcement(locale), unsubscribeUrl: UNSUB })
    assert.ok(result.ok)
    const { payload } = sent[0]
    assert.ok(payload.subject.startsWith("(광고) "), payload.subject)
    assert.equal(payload.headers["List-Unsubscribe"], `<${UNSUB}>`)
    assert.equal(payload.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
    for (const field of Object.values(BUSINESS)) {
      assert.ok(payload.html.includes(escape(field)) && payload.text.includes(field), `본문에 사업자 표시: ${field}`)
    }
    // 수신거부 안내문과 링크가 한글·영문 둘 다
    assert.ok(payload.text.includes("로그인하지 않아도 돼요") && payload.text.includes("You don't need to sign in"), "한·영 안내문")
    assert.ok(payload.text.includes("수신거부 / Unsubscribe"), "한·영 링크 이름")
    assert.ok(payload.html.includes(`href="${UNSUB}"`) && payload.text.includes(UNSUB))
    assert.ok(payload.html.includes('data-lf-promo="true"') && payload.html.includes("data-lf-ad-footer"))
    assert.deepEqual(payload.tags, [{ name: "template", value: "marketingAnnouncement" }])
  })
}

test("G03: 사업자 값은 설정에서만 온다 — 다른 값을 넣으면 그대로 바뀌고, 칸이 비면 보내지 않고 던진다", async () => {
  const { sent, client } = recorder()
  const other = { name: "Other Biz", email: "o@other.test", phone: "+1 555 0100", address: "9 Other St" }
  const m1 = createMailer({ mode: "live", from: "a <a@sampleco.test>", client, marketing: { business: other } })
  await m1.send({ to: "u@example.test", template: "marketingAnnouncement", input: announcement("en"), unsubscribeUrl: UNSUB })
  assert.ok(sent[0].payload.text.includes("9 Other St") && !sent[0].payload.text.includes("Seoul"))
  // 설정이 없거나 칸이 비면: 보내지 않는다(공급자 호출 0), 빠진 칸 이름만 알린다
  for (const business of [undefined, { ...BUSINESS, phone: " " }, { ...BUSINESS, address: undefined }, {}]) {
    const m = createMailer({ mode: "live", from: "a <a@sampleco.test>", client, ...(business ? { marketing: { business } } : {}) })
    await assert.rejects(m.send({ to: "u@example.test", template: "marketingAnnouncement", input: announcement("en"), unsubscribeUrl: UNSUB }), (e) => {
      assert.ok(e instanceof MarketingComplianceError && e.missing.length >= 1, String(e))
      assert.ok(!JSON.stringify(e.message).includes("Seoul"), "값은 싣지 않는다")
      return true
    })
  }
  // 수신거부 링크가 없거나 안전하지 않으면 보내지 않는다(헤더 주입 방지 포함)
  const ok = createMailer({ mode: "live", from: "a <a@sampleco.test>", client, marketing: { business: BUSINESS } })
  for (const unsubscribeUrl of [undefined, "", "javascript:alert(1)", `${UNSUB}>\r\nBcc: x@y.z`, `${UNSUB} x`, `${UNSUB}"`]) {
    await assert.rejects(ok.send({ to: "u@example.test", template: "marketingAnnouncement", input: announcement("en"), ...(unsubscribeUrl === undefined ? {} : { unsubscribeUrl }) }), MarketingComplianceError, String(unsubscribeUrl))
  }
  assert.equal(sent.length, 1, "위 거절은 공급자를 부르지 않았다")
})

test("G03: 거래 메일에는 수신거부 헤더·(광고)를 달지 않는다 · mock 도 같은 규칙", async () => {
  const { sent, client } = recorder()
  const mailer = createMailer({ mode: "live", from: "a <a@sampleco.test>", client, marketing: { business: BUSINESS } })
  await mailer.send({ to: "u@example.test", template: "welcome", input: inputs("en").welcome, unsubscribeUrl: UNSUB })
  assert.equal(sent[0].payload.headers, undefined)
  assert.ok(!sent[0].payload.subject.startsWith("(광고)"))
  const lines = []
  const mock = createMailer({ mode: "mock", log: (l) => lines.push(l), marketing: { business: BUSINESS } })
  await mock.send({ to: "u@example.test", template: "marketingAnnouncement", input: announcement("ko"), unsubscribeUrl: UNSUB })
  assert.match(lines.join("\n"), /List-Unsubscribe-Post/)
  await assert.rejects(createMailer({ mode: "mock" }).send({ to: "u@example.test", template: "marketingAnnouncement", input: announcement("ko"), unsubscribeUrl: UNSUB }), MarketingComplianceError)
})

test("G03: adSubject 는 한 번만 붙인다", () => {
  assert.equal(adSubject("Hello"), "(광고) Hello")
  assert.equal(adSubject("(광고) Hello"), "(광고) Hello")
})

test("G03: 광고 어댑터·템플릿 원천에 사업자 값(주소·전화 모양)이 하드코딩돼 있지 않다", async () => {
  const { readFileSync } = await import("node:fs")
  const files = ["../src/advertising.ts", "../src/send.ts", "../src/templates/marketing-announcement.ts", "../src/templates/marketing-reconfirm.ts"]
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8").replace(/\/\/.*$/gm, "")
    assert.ok(!/\+\d[\d\s-]{7,}/.test(src), `${f}: 전화번호 모양`)
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(src), `${f}: 이메일 주소 모양`)
  }
})
