// 법정 쪽 초안(K01) — 모양·자리표시·필수 내용·실데이터 없음·final 가드를 본다. 네트워크·서버 없음.
// 법적 내용의 맞음은 시험이 보증하지 않는다(docs/qa/legal-review-k01.md 와 사람 변호사의 몫) — 여기서는 「빠지면 안 되는 말」이 본문에서 지워지지 않는지만 고정한다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")
const load = (slug) => JSON.parse(read(`content/legal/${slug}.json`))
const SLUGS = ["terms", "privacy", "refund"]
const docs = Object.fromEntries(SLUGS.map((s) => [s, load(s)]))
const variables = load("variables")
const tok = await import("../lib/legal-tokens.ts")

const allText = (d) => [d.contact, d.notice ?? "", ...d.clauses.flatMap((c) => [c.title, c.text])].join("\n")
const textOf = (slug) => allText(docs[slug])

/** 코드가 채우는 product.* 이름 — legal-page.tsx 의 legalVars 호출과 같아야 한다 */
const PRODUCT_KEYS = ["name", "deletionGraceDays", "inquiryRetentionDays"]
const FULL_VARS = tok.legalVars({
  business: Object.fromEntries(tok.BUSINESS_TOKEN_KEYS.map((k) => [k, `v-${k}`])),
  product: Object.fromEntries(PRODUCT_KEYS.map((k) => [k, `p-${k}`])),
  legal: Object.fromEntries(Object.keys(variables).map((k) => [k, `l-${k}`])),
})

test("세 쪽의 모양: 검토 끝·승인 대기(draft), 조항마다 제목·본문, 제목 중복 없음, 공개 안내(notice) 있음", () => {
  for (const slug of SLUGS) {
    const d = docs[slug]
    assert.equal(d.status, "draft", `${slug}: 운영자 승인 전에는 draft 여야 한다(final 은 운영자가 바꾼다)`)
    assert.equal(typeof d.contact, "string")
    assert.ok(d.notice && /draft/i.test(d.notice) && /not in force/i.test(d.notice), `${slug}: draft 안내가 있어야 손님이 초안임을 안다`)
    assert.ok(d.clauses.length >= 6, `${slug}: 조항이 모자라다`)
    const titles = d.clauses.map((c) => c.title)
    assert.equal(new Set(titles).size, titles.length, `${slug}: 조항 제목이 겹친다`)
    for (const c of d.clauses) assert.ok(c.title.trim() && c.text.trim().length > 40, `${slug}: 빈 조항 ${c.title}`)
  }
})

test("자리표시: 쓰인 이름은 모두 값의 출처가 있다(business.* · product.* · variables.json) — 오타가 조용히 안 보이게", () => {
  const known = new Set([...tok.BUSINESS_TOKEN_KEYS.map((k) => `business.${k}`), ...PRODUCT_KEYS.map((k) => `product.${k}`), ...Object.keys(variables).map((k) => `legal.${k}`)])
  for (const slug of SLUGS) {
    for (const name of tok.tokensIn(textOf(slug))) assert.ok(known.has(name), `${slug}: 모르는 자리표시 {{${name}}}`)
    // 여는 중괄호가 남은 깨진 표기가 없다
    assert.ok(!/\{\{|\}\}/.test(textOf(slug).replace(tok.LEGAL_TOKEN, "")), `${slug}: 깨진 {{ }}`)
  }
  // variables.json 의 모든 칸은 어느 쪽에선가 쓰인다(안 쓰는 칸을 운영자에게 묻지 않는다). 코드가 직접 읽는 칸(국외 이전 표의 DB 나라)만 예외다
  const used = new Set(SLUGS.flatMap((s) => tok.tokensIn(textOf(s))))
  const READ_BY_CODE = ["databaseCountry"]
  for (const k of Object.keys(variables)) assert.ok(used.has(`legal.${k}`) || READ_BY_CODE.includes(k), `variables.json 의 ${k} 를 쓰는 본문이 없다`)
  for (const k of READ_BY_CODE) assert.match(read("components/product/legal-page.tsx"), new RegExp(`variables\\.${k}`), `${k} 를 읽는 코드가 없다`)
  // 개인정보 보호책임자는 변수가 아니라 대표자 설정(business.owner)이다 — 이름을 코드·변수에 박지 않는다
  assert.ok(!("privacyOfficer" in variables))
  assert.ok(tokensOf("privacy").includes("business.owner"))
  // 사업자 정보는 환경 변수 칸만 쓴다 — 선택 칸(전화·통신판매업 신고번호)을 본문이 요구하면 면제 사업자는 final 이 막힌다
  for (const slug of SLUGS) {
    assert.ok(!tokensOf(slug).includes("business.mailOrderNo"), `${slug}: 면제일 수 있는 칸 mailOrderNo 를 본문에 쓰면 안 된다`)
  }
})
const tokensOf = (slug) => tok.tokensIn(textOf(slug))

test("실데이터 없음: 이메일·전화·사업자등록번호·실주소·실제 이름 모양이 본문에 없다(남도 쓰는 공장)", () => {
  const PATTERNS = {
    email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    bizRegNo: /\b\d{3}-\d{2}-\d{5}\b/,
    phone: /(?:\+?\d[\d\s().-]{8,}\d)/,
  }
  for (const slug of SLUGS) {
    const text = textOf(slug).replace(/https?:\/\/\S+/g, "")
    for (const [name, re] of Object.entries(PATTERNS)) assert.ok(!re.test(text), `${slug}: ${name} 모양이 있다`)
    assert.ok(!/Example App|My Product/.test(text), `${slug}: 예시 제품 이름이 박혀 있다`)
  }
  // 양성 대조: 같은 검사가 실제 모양은 잡는다
  assert.ok(PATTERNS.email.test("write to jane@acme.test") && PATTERNS.bizRegNo.test("123-45-67890") && PATTERNS.phone.test("+82 10-1234-5678"))
  // variables.json 에서 값이 있는 칸은 운영자가 2026-10-04 확정한 제품 값뿐이다(환불 14일·한국 준거법·서울중앙지방법원·서울 DB). 시행일은 승인 때 채우므로 비어 있다. 사람 이름·연락처는 없다
  const DECIDED = { refundWindowDays: "14", governingLaw: "the laws of the Republic of Korea", venue: "the Seoul Central District Court", databaseRegion: "Seoul, South Korea (AWS ap-northeast-2)", databaseCountry: "KR" }
  for (const [k, v] of Object.entries(variables)) assert.ok(v === "" || DECIDED[k] === v, `variables.json ${k} 에 확정되지 않은 값이 박혀 있다`)
  assert.deepEqual(Object.fromEntries(Object.entries(variables).filter(([, v]) => v !== "")), DECIDED)
  assert.equal(variables.effectiveDate, "", "시행일은 승인일에 채운다 — 지어내지 않는다")
})

test("채우기: 모든 값이 있으면 못 채운 자리가 0, 비어 있으면 이름이 보이는 표시로 남는다, 값에 정규식 기호가 있어도 안전하다", () => {
  for (const slug of SLUGS) {
    const full = tok.fillLegalDoc(docs[slug], FULL_VARS)
    assert.deepEqual(full.unresolved, [], `${slug}: 채워도 남는 자리`)
    assert.ok(!/\{\{|to be confirmed/.test(allText(full.doc)), `${slug}: 채운 글에 자리 표시가 남았다`)
  }
  const empty = tok.fillLegalDoc(docs.terms, {})
  assert.ok(empty.unresolved.includes("business.name") && empty.unresolved.includes("legal.governingLaw"))
  assert.match(allText(empty.doc), /\[business\.name — to be confirmed\]/)
  // 값이 $& 같은 치환 기호를 담아도 글자 그대로 들어간다
  const tricky = tok.fillLegalText("A {{business.name}} B", { "business.name": "Acme $& Co. $1" })
  assert.equal(tricky.text, "A Acme $& Co. $1 B")
  // 공백뿐인 값은 없는 것이다
  assert.deepEqual(tok.fillLegalText("{{business.name}}", { "business.name": "   " }).unresolved, ["business.name"])
})

test("공개 가드: final 이 아니면 publishIssues 가 쪽 이름을 알리고, 렌더러는 final 에 빈 자리가 있으면 던진다", () => {
  assert.deepEqual(tok.legalPublishIssues({ terms: { status: "final" }, privacy: { status: "draft" }, refund: { status: "placeholder" } }), ["privacy: draft", "refund: placeholder"])
  assert.deepEqual(tok.legalPublishIssues({ terms: { status: "final" } }), [])
  assert.deepEqual([...tok.LEGAL_STATUSES], ["placeholder", "draft", "final"])
  const page = read("components/product/legal-page.tsx")
  assert.match(page, /doc\.status === "final" && unresolved\.length\) throw new Error/)
  assert.match(page, /doc\.status !== "final" \? <p role="note">/, "final 이 아닌 쪽 맨 위에 안내가 보인다")
  // 자리표시 값의 출처는 설정(businessInfo)·제품 코드·variables.json 뿐이다 — 코드에 값을 박지 않는다
  assert.match(page, /businessInfo\(\)/)
  assert.match(page, /deletionGraceDays: GRACE_DAYS/)
  // 국외 이전 표: Supabase 와 Sentry 를 싣는다(대표 확정 2026-10-04)
  assert.match(page, /include: \["posthog", "resend", "supabase", "sentry", "vercel", "cloudflare"\]/)
})

test("약관: Paddle 판매 대행 문구·가입 나이·무료 체험→자동 갱신·해지·가격 변경 동의·탈퇴·마케팅·준거법이 있다", () => {
  const t = textOf("terms")
  assert.match(t, /Paddle\.com is the Merchant of Record for all our orders/)
  assert.match(t, /Paddle provides all customer service inquiries and handles returns/)
  assert.match(t, /14 or older/)
  assert.match(t, /Google, Kakao or Naver/)
  assert.match(t, /renews automatically every month or every year/)
  assert.match(t, /If you do not cancel before the trial ends, you are charged/)
  assert.match(t, /Cancelling takes no more steps than signing up|cancelling takes no more steps than signing up/)
  assert.match(t, /Account > Billing/)
  assert.match(t, /never charge you a higher price .* unless you agree to it first/s)
  assert.match(t, /Not answering is not agreement/)
  assert.match(t, /up to 30 days before a higher price/)
  assert.match(t, /\{\{product\.deletionGraceDays\}\} days/)
  assert.match(t, /only if you agreed to them/)
  assert.match(t, /\{\{legal\.governingLaw\}\}/)
  assert.match(t, /\{\{legal\.venue\}\}/)
  assert.match(t, /If you are a consumer, this does not take away the protection that the mandatory law of the country where you live gives you\. This applies, for example, to consumers in the EU, the EEA and the UK/)
  // 체험 종료 안내 메일은 약속하지 않는다
  assert.match(t, /we cannot promise it/)
  assert.ok(!/7 days before (?:the|a) trial/i.test(t))
  assert.match(t, /\/contact/)
  // 관할별 짧은 구획(추측하지 않는다)
  assert.match(t, /Korea:.*7 days/s)
  assert.match(t, /EU, EEA and UK:.*14 days/s)
  assert.match(t, /California/)
  // 환불은 환불 정책을 가리킨다 — 해지 화면 문구 「Any refund follows the Terms of Service」가 약속을 지키려면 약관에 환불 연결이 있어야 한다
  assert.match(t, /Refund Policy \(\/refund\)/)
  assert.match(read("content/copy.en.ts"), /Any refund follows the Terms of Service/)
})

test("개인정보 처리방침: 항목·목적·보유기간·법정 보존(6개월·5년·5년·3년)·탈퇴·열람 10일·마케팅 철회·쿠키·국외 이전·14세·보호책임자·처리자 목록이 있다", () => {
  const p = textOf("privacy")
  for (const must of [/What we collect, why, and for how long/, /Account data/, /Plan and billing status/, /Messages you send us/, /Marketing choices/, /Usage analytics \(only if you accept analytics\)/]) assert.match(p, must)
  // D127(운영자 결정 2026-10-08): 마케팅 동의 이력은 탈퇴 뒤 3년 — 코드(account-lifecycle marketingConsentCollector, 종류 dispute 36개월)와 같은 기간
  assert.match(p, /Marketing choices:[^\n]*Kept: while the account exists, and for 3 years after you delete your account/)
  for (const must of [/Records about advertising and labelling: 6 months/, /Records about contracts and withdrawal from contracts: 5 years/, /Records about payment and supply of goods or services: 5 years/, /Records about complaints and disputes: 3 years/]) assert.match(p, must)
  assert.match(p, /\{\{product\.deletionGraceDays\}\} days/)
  assert.match(p, /within 10 days \(Korea\) or one month \(EU and UK\)/)
  assert.match(p, /within 14 days/)
  assert.match(p, /Every 2 years we ask you to confirm/)
  assert.match(p, /unsubscribe link that works without signing in/)
  assert.match(p, /"Reject all"/)
  assert.match(p, /only with your consent/)
  assert.match(p, /privacy officer .* is \{\{business\.owner\}\}, Representative/)
  assert.match(p, /It includes Supabase .* and Sentry/)
  assert.ok(!/where we have turned it on/.test(p), "Sentry 는 쓴다 — 조건부 문구를 두지 않는다")
  assert.match(p, /\{\{product\.inquiryRetentionDays\}\} days/)
  assert.match(p, /aged 14 and over/)
  assert.match(p, /table at the end of this page/)
  for (const who of ["Paddle", "Vercel", "Supabase", "Resend", "PostHog", "Sentry", "Cloudflare Turnstile", "Google, Kakao and Naver"]) assert.ok(p.includes(who), `처리자 ${who}`)
  assert.match(p, /independent controller/)
  assert.match(p, /We do not sell personal information/)
  for (const region of [/Korea\. We follow/, /EU, EEA and UK\./, /California, USA\./]) assert.match(p, region)
  // 보존 기간 숫자는 제품 코드(@launch-factory/db ECOMMERCE_RETENTION)와 같다
  const db = read("../packages/db/src/retention.ts")
  for (const m of ["months: 6", "months: 60", "months: 36"]) assert.ok(db.includes(m), `${m} 가 코드에 있어야 방침 숫자와 같다`)
})

test("환불 정책: Paddle 지급 주체·무료 체험·환불 기간 자리·법정 철회권(EU/UK 14일·한국 7일)·청구 방법이 있다", () => {
  const r = textOf("refund")
  assert.match(r, /Paddle\.com is the Merchant of Record for all our orders/)
  assert.match(r, /refund of a payment within \{\{legal\.refundWindowDays\}\} days/)
  assert.match(r, /EU, EEA, UK and Switzerland: 14 days/)
  assert.match(r, /Korea: 7 days/)
  assert.match(r, /you are never charged/)
  assert.match(r, /Paddle's customer portal/)
  assert.match(r, /chargeback/)
  // 체크아웃의 청약철회 고지 문구와 같은 뜻: 디지털 콘텐츠는 제공 개시와 함께 소멸할 수 있고, 체험으로 써 볼 수 있다
  const copy = read("content/copy.en.ts")
  assert.match(copy, /right of withdrawal ends once delivery of the digital content starts/)
  assert.match(r, /right to end this way|lets this right end once delivery starts/)
})

test("쪽 연결: 세 법정 경로가 있고 바닥글이 세 쪽·문의로 이어진다(탐색에서 접근 가능)", () => {
  for (const slug of SLUGS) assert.ok(read(`app/(legal)/${slug}/page.tsx`).includes("LegalPage"))
  // 바닥글은 web-factory 블록(footer/product-legal)이고 링크는 문구 판(copy.shell.en.ts)에 있다(LFADA) — 틀이 그 바닥글을 둔다
  assert.match(read("components/product/product-shell.tsx"), /<ProductFooter \/>/)
  const footer = read("content/copy.shell.en.ts")
  for (const href of ["/contact", "/terms", "/privacy", "/refund"]) assert.ok(footer.includes(`href: "${href}"`), href)
})

test("문의 쪽이 없는 제품: 본문의 「Contact page (/contact)」 안내가 사업자 이메일로 바뀌고 문장이 이어진다", () => {
  const w = tok.withoutContactPage
  assert.equal(w("Write to {{business.email}} or use our Contact page (/contact)."), "Write to {{business.email}}.")
  assert.equal(w("you can reach us at {{business.email}} or on our Contact page (/contact)."), "you can reach us at {{business.email}}.")
  assert.equal(w("write to us on our Contact page (/contact)."), "write to us at {{business.email}}.")
  assert.equal(w("tell us at once on our Contact page (/contact)."), "tell us at once at {{business.email}}.")
  assert.equal(w("- our Contact page (/contact), or {{business.email}}."), "- {{business.email}}.")
  assert.equal(w("nothing to change here"), "nothing to change here")
  for (const slug of SLUGS) {
    assert.ok(textOf(slug).includes("(/contact)"), `${slug}: 원본에는 안내가 있다`)
    const doc = tok.legalDocWithoutContactPage(docs[slug])
    assert.ok(!allText(doc).includes("/contact"), `${slug}: /contact 가 남았다`)
    assert.ok(!/Contact page/.test(allText(doc)), `${slug}: Contact page 가 남았다`)
    const full = tok.fillLegalDoc(doc, FULL_VARS)
    assert.deepEqual(full.unresolved, [])
    assert.ok(allText(full.doc).includes("v-email"), `${slug}: 사업자 이메일이 들어간다`)
  }
  assert.equal(docs.terms.clauses.length, tok.legalDocWithoutContactPage(docs.terms).clauses.length)
})
