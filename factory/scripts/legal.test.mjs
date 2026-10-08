// P3-3 Task 10 — 법정 페이지 초안·법령 API·legal-gate (J13). 모두 녹화 응답(factory/legal/fixtures)으로 돌고 실호출은 하지 않는다.
// 녹화: 검색 3건(개인정보 보호법·전자상거래법·약관법)·조문 1건(제22조) = 2026-09-29 실측, 키는 *** 로 지움. 5xx·빈 결과·모양 바뀜은 합성.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { lawApi, toJo, joLabel, mask, decreeName, NO_KEY_MESSAGE, RETRY_DELAYS_MS } from "../legal/law-api.mjs"
import { draftLegalPages, legalContext, pendingReview, PLACEHOLDER } from "../legal/drafts.mjs"
import { basisProblems } from "../qa/legal-gate.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, "../legal/fixtures")
const GATE = join(HERE, "../qa/legal-gate.mjs")
const KEY = "k-SECRET-123"
const fx = (name) => JSON.parse(readFileSync(join(FIX, name), "utf8"))

/** 녹화 응답을 차례로 돌려주는 fetch(마지막 것은 계속 반복). calls 에 요청 주소를 남긴다. */
function replay(...items) {
  const calls = []
  const f = async (url) => {
    calls.push(String(url))
    const it = items[Math.min(calls.length - 1, items.length - 1)]
    const { status, body } = typeof it === "string" ? fx(it) : it
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  }
  f.calls = calls
  return f
}
const sleeps = () => {
  const s = []
  const fn = async (ms) => void s.push(ms)
  fn.log = s
  return fn
}
const api = (fetch, extra = {}) => lawApi({ readSecret: (n) => (n === "LAW_API_OC" ? KEY : null), fetch, sleep: sleeps(), ...extra })

test("current(): picks 현행 MST from search, never a cached one", async () => {
  const fetch = replay("search-privacy.json")
  const a = api(fetch)
  const cur = await a.current("개인정보 보호법")
  assert.equal(cur.mst, "283839")
  assert.equal(cur.lawId, "011357")
  assert.equal(cur.effectiveDate, "20260911")
  assert.notEqual(cur.mst, "289537", "시행령과 섞이면 안 된다")
  await a.current("개인정보 보호법")
  assert.equal(fetch.calls.length, 2, "부를 때마다 검색한다(캐시 없음)")
  assert.match(fetch.calls[0], /lawSearch\.do\?OC=k-SECRET-123&target=law&type=JSON&query=/)
})

test("current(): 이름이 같은 현행본이 없으면(연혁뿐) 옛 MST 로 대신하지 않는다", async () => {
  const f = fx("search-privacy.json")
  for (const l of f.body.LawSearch.law) l["현행연혁코드"] = "연혁"
  await assert.rejects(api(replay(f)).current("개인정보 보호법"), (e) => e.code === "not-current" && /옛 MST/.test(e.message))
  await assert.rejects(api(replay("search-terms.json")).current("개인정보 보호법"), (e) => e.code === "not-current")
})

test("article(): JO 6 digits, 제22조의2 -> 002202", async () => {
  assert.equal(toJo("제22조의2"), "002202")
  assert.equal(toJo("제22조"), "002200")
  assert.equal(toJo("22의2"), "002202")
  assert.equal(toJo("제28조의8"), "002808")
  assert.equal(toJo("002202"), "002202")
  assert.equal(joLabel("002202"), "제22조의2")
  assert.throws(() => toJo("Art. 13"), (e) => e.code === "no-article")
  const fetch = replay("article-22.json")
  const art = await api(fetch).article("283839", "제22조")
  assert.match(fetch.calls[0], /lawService\.do\?OC=.*&target=law&type=JSON&MST=283839&JO=002200$/)
  assert.equal(art.number, "제22조")
  assert.equal(art.title, "동의를 받는 방법")
  assert.match(art.text, /^제22조\(동의를 받는 방법\)\n① 개인정보처리자는/)
  assert.match(art.text, /7\. 재화나 서비스를 홍보하거나/)
  // 요청과 다른 조가 오면 도구 실패(모양은 맞아도 조 번호가 다르다)
  await assert.rejects(api(replay("article-22.json")).article("283839", "제22조의2"), (e) => e.code === "no-article")
})

test("basis(): 현행 MST 인용 주소·시행일자·fetchedAt 을 한 칸으로 — legal-gate 가 받는 모양", async () => {
  const now = () => new Date("2026-09-30T00:00:00Z")
  const out = await api(replay("search-privacy.json", "article-22.json"), { now }).basis("개인정보 보호법", "제22조")
  assert.deepEqual(out.basis, {
    law: "개인정보 보호법",
    article: "제22조",
    url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839",
    mst: "283839",
    effectiveDate: "20260911",
    fetchedAt: "2026-09-30T00:00:00.000Z",
  })
  assert.deepEqual(basisProblems(out.basis, "ko"), [])
})

test("5xx twice then ok -> ok; 5xx three times -> throws, message masks key", async () => {
  const s1 = sleeps()
  const ok = await api(replay("http-503.json", "http-503.json", "search-privacy.json"), { sleep: s1 }).current("개인정보 보호법")
  assert.equal(ok.mst, "283839")
  assert.deepEqual(s1.log, RETRY_DELAYS_MS)
  assert.deepEqual(RETRY_DELAYS_MS, [5000, 20000])

  const s2 = sleeps()
  const fetch = replay("http-503.json")
  await assert.rejects(api(fetch, { sleep: s2 }).current("개인정보 보호법"), (e) => {
    assert.equal(e.code, "http")
    assert.match(e.message, /^도구 실패: 법령 API HTTP 503, 3회 시도/)
    assert.match(e.message, /OC=\*\*\*/)
    assert.ok(!e.message.includes(KEY), "키가 메시지에 남으면 안 된다")
    return true
  })
  assert.equal(fetch.calls.length, 3)
  // 네트워크 예외(시간 초과 등)도 같은 재시도·가림
  const boom = async (url) => {
    throw new Error(`timeout at ${url}`)
  }
  await assert.rejects(api(boom).current("개인정보 보호법"), (e) => e.code === "http" && !e.message.includes(KEY))
  assert.equal(mask(`x?OC=${KEY}&q=1 ${KEY}`, KEY), "x?OC=***&q=1 ***")
})

test("shape change (no top-level 법령) is a tool failure", async () => {
  const f1 = replay("shape-changed.json")
  await assert.rejects(api(f1).current("개인정보 보호법"), (e) => e.code === "shape" && /LawSearch/.test(e.message))
  assert.equal(f1.calls.length, 1, "모양이 바뀐 응답은 재시도하지 않는다")
  const f2 = replay("shape-changed.json")
  await assert.rejects(api(f2).article("283839", "제22조"), (e) => e.code === "shape" && /최상위 법령/.test(e.message))
  // JSON 이 아닌 200(키 검증 실패 안내 페이지 등)도 모양 실패
  await assert.rejects(api(replay({ status: 200, body: "<html>사용자 정보 검증에 실패</html>" })).current("x"), (e) => e.code === "shape")
})

test("빈 결과는 두 번 다시 시도한 뒤 도구 실패", async () => {
  const s = sleeps()
  const fetch = replay("search-empty.json")
  await assert.rejects(api(fetch, { sleep: s }).current("없는 법"), (e) => e.code === "empty")
  assert.equal(fetch.calls.length, 3)
})

test("키 없음: 요청하지 않고 발급 안내와 함께 도구 실패", async () => {
  const fetch = replay("search-privacy.json")
  await assert.rejects(lawApi({ readSecret: () => null, fetch }).current("개인정보 보호법"), (e) => e.code === "no-key" && e.message === NO_KEY_MESSAGE)
  assert.match(NO_KEY_MESSAGE, /open\.law\.go\.kr/)
  assert.equal(fetch.calls.length, 0)
  assert.throws(() => lawApi({ fetch }), /readSecret/, "readSecret 은 필수 주입")
})

// ── legal-gate ─────────────────────────────────────────────────────
function runGate(args) {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [GATE, ...args], { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    p.stdout.on("data", (d) => (out += d))
    p.stderr.on("data", (d) => (err += d))
    p.on("error", rej)
    p.on("close", (code) => res({ code, out, err }))
  })
}
async function reviewDir(pages) {
  const dir = await mkdtemp(join(tmpdir(), "legal-"))
  for (const [page, entries] of Object.entries(pages)) await writeFile(join(dir, `${page}.review.json`), JSON.stringify(entries))
  return dir
}
const koBasis = { law: "개인정보 보호법", article: "제22조", url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839", mst: "283839", effectiveDate: "20260911", fetchedAt: "2026-09-30T00:00:00Z" }
const enBasis = { law: "GDPR (Regulation (EU) 2016/679)", article: "Art. 13", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj", fetchedAt: "2026-09-30T00:00:00Z" }
const okEntry = (clause, basis = koBasis) => ({ clause, verdict: "ok", basis: [basis], note: "" })

test("legal-gate: unverified clause -> exit 1; all ok with law.go.kr basis -> 0; basis from blog URL -> 1", async () => {
  const allOk = await reviewDir({ privacy: [okEntry("privacy.consent"), okEntry("privacy.purpose")] })
  const r0 = await runGate([allOk, "--locale", "ko", "--pages", "privacy"])
  assert.equal(r0.code, 0, r0.out + r0.err)
  const res = JSON.parse(await readFile(join(allOk, "legal-gate.json"), "utf8"))
  assert.equal(res.ok, true)
  assert.equal(res.pages.privacy.ok, 2)

  const unv = await reviewDir({ privacy: [okEntry("privacy.consent"), { clause: "privacy.items", verdict: "unverified", basis: [], note: "플러그인 결론에 조문 근거 없음" }] })
  const r1 = await runGate([unv, "--locale", "ko"])
  assert.equal(r1.code, 1)
  assert.ok(existsSync(join(unv, "legal-gate.json")), "판정 실패는 결과 파일을 남긴다")
  assert.match(r1.out, /privacy\.items \[verdict-unverified\] 플러그인 결론에 조문 근거 없음/)

  const blog = await reviewDir({ privacy: [okEntry("privacy.consent", { ...koBasis, url: "https://blog.naver.com/someone/123" })] })
  const r2 = await runGate([blog, "--locale", "ko"])
  assert.equal(r2.code, 1)
  assert.match(r2.out, /basis-host/)

  const noBasis = await reviewDir({ privacy: [{ clause: "privacy.consent", verdict: "ok", basis: [], note: "" }] })
  assert.equal((await runGate([noBasis, "--locale", "ko"])).code, 1, "ok 인데 근거 없음")

  const fix = await reviewDir({ terms: [{ clause: "terms.provider", verdict: "fix", basis: [koBasis], note: "사업자등록번호 확인 필요" }] })
  assert.equal((await runGate([fix, "--locale", "ko"])).code, 1)
})

test("legal-gate: ko 근거는 현행 인용 주소(lsInfoP.do?lsiSeq=MST)·mst·시행일자가 맞아야 한다", () => {
  assert.deepEqual(basisProblems(koBasis, "ko"), [])
  assert.ok(basisProblems({ ...koBasis, url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=270351" }, "ko").some((p) => p.startsWith("basis-mst")))
  assert.ok(basisProblems({ ...koBasis, url: "https://www.law.go.kr/법령/개인정보보호법/제22조" }, "ko").some((p) => p.startsWith("basis-url")))
  assert.ok(basisProblems({ ...koBasis, mst: undefined }, "ko").some((p) => /mst 없음/.test(p)))
  assert.ok(basisProblems({ ...koBasis, url: "http://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839" }, "ko").some((p) => /https/.test(p)))
  assert.ok(basisProblems({ ...koBasis, url: "https://law.go.kr.evil.example/LSW/lsInfoP.do?lsiSeq=283839" }, "ko").some((p) => p.startsWith("basis-host")))
  assert.deepEqual(basisProblems(enBasis, "en"), [])
  assert.deepEqual(basisProblems({ ...enBasis, url: "https://www.paddle.com/legal/checkout-buyer-terms" }, "en"), [])
  assert.ok(basisProblems(koBasis, "en").some((p) => p.startsWith("basis-host")), "en 사이트에 한국 법 근거는 받지 않는다")
})

test("legal-gate: 도구 실패(검토 파일 없음·모양 틀림)는 결과 파일 없이 1, 인자 오류는 2", async () => {
  const empty = await mkdtemp(join(tmpdir(), "legal-"))
  await writeFile(join(empty, "legal-gate.json"), "{}") // 이전 실행의 결과 파일
  const r = await runGate([empty, "--locale", "ko"])
  assert.equal(r.code, 1)
  assert.match(r.err, /^도구 실패: 검토 파일/)
  assert.equal(existsSync(join(empty, "legal-gate.json")), false, "도구 실패면 이전 결과 파일도 지운다")

  const partial = await reviewDir({ privacy: [okEntry("privacy.consent")] })
  const rp = await runGate([partial, "--locale", "ko", "--pages", "privacy,terms"])
  assert.equal(rp.code, 1)
  assert.match(rp.err, /terms\.review\.json/)

  const bad = await reviewDir({ privacy: [{ clause: "privacy.consent", verdict: "maybe", basis: [] }] })
  const rb = await runGate([bad, "--locale", "ko"])
  assert.equal(rb.code, 1)
  assert.match(rb.err, /도구 실패: .*verdict/)

  assert.equal((await runGate([])).code, 2)
  assert.equal((await runGate([partial])).code, 2, "locale 필수")
  assert.equal((await runGate([partial, "--locale", "ja"])).code, 2)
  assert.equal((await runGate([partial, "--locale", "ko", "--nope"])).code, 2)
})

// ── 초안 ───────────────────────────────────────────────────────────
const saasArch = { id: "saas", legal: { pages: ["privacy", "terms", "refund"], laws: { ko: [], en: [] } } }
const koContent = {
  business: { name: "예시 클라우드", representative: "홍길동", address: "서울특별시 마포구 예시로 1", phone: "02-1234-5678", email: "help@example.com", mailOrderNo: "제2026-서울마포-0000호" },
  legal: {
    collects: [{ item: "이메일", purpose: "로그인과 안내 메일", retention: "탈퇴 후 30일" }],
    processors: [{ name: "예시 호스팅", task: "서버 운영", country: "미국" }],
    officer: { name: "홍길동", contact: "privacy@example.com" },
    paymentProvider: "paddle",
    effectiveDate: "2026-10-01",
  },
}

test("draft: en locale yields GDPR/CCPA clauses and no Korean law ids", () => {
  const en = {
    business: { name: "Example Cloud", address: "1 Example St, San Francisco, CA", email: "help@example.com" },
    legal: { ...koContent.legal, collects: [{ item: "Email", purpose: "Sign-in", retention: "30 days after deletion" }], processors: [{ name: "Example Hosting", task: "Servers", country: "US" }], governingLaw: "the laws of Ireland" },
  }
  const d = draftLegalPages(en, saasArch, "en")
  assert.deepEqual(Object.keys(d), ["privacy", "terms", "refund"])
  const needs = Object.values(d).flatMap((p) => p.clauses.flatMap((c) => c.needs))
  assert.ok(needs.some((n) => /^GDPR/.test(n.law)))
  assert.ok(needs.some((n) => /^CCPA/.test(n.law)))
  assert.ok(needs.some((n) => n.law === "Paddle Buyer Terms"), "paddle 결제면 Paddle 조건을 근거로")
  for (const n of needs) assert.doesNotMatch(n.law + n.article, /[가-힣]/, `한국 법이 섞임: ${n.law} ${n.article}`)
  for (const p of Object.values(d)) assert.doesNotMatch(p.markdown, /[가-힣]/)
  assert.match(d.privacy.markdown, /^# Privacy Policy/)
  assert.ok(Object.values(d).every((p) => p.clauses.every((c) => !c.missing)), "사실이 다 있으면 빈 칸 없음")
})

test("draft: missing bizNo renders 「확인 필요」 in the page and marks clause needs", () => {
  const d = draftLegalPages(koContent, saasArch, "ko")
  assert.equal(PLACEHOLDER.ko, "확인 필요")
  assert.match(d.terms.markdown, /사업자등록번호: 확인 필요/)
  const provider = d.terms.clauses.find((c) => c.id === "terms.provider")
  assert.deepEqual(provider.missing, ["business.bizRegNo"])
  assert.deepEqual(provider.needs, [
    { law: "전자상거래 등에서의 소비자보호에 관한 법률", article: "제10조" },
    { law: "전자상거래 등에서의 소비자보호에 관한 법률", article: "제13조" },
  ])
  assert.doesNotMatch(d.terms.markdown, /undefined|null/)
  // 한국 초안의 모든 근거는 녹화한 세 법 가운데 하나이고 조 번호는 JO 로 바뀐다(law-api 로 바로 가져올 수 있다)
  const recorded = ["search-privacy.json", "search-ecommerce.json", "search-terms.json"].flatMap((f) => [].concat(fx(f).body.LawSearch.law).map((l) => l["법령명한글"]))
  for (const n of Object.values(d).flatMap((p) => p.clauses.flatMap((c) => c.needs))) {
    assert.ok(recorded.includes(n.law), `녹화에 없는 법: ${n.law}`)
    assert.match(toJo(n.article), /^\d{6}$/)
  }
  // 수집 항목이 없으면 지어내지 않고 빈 칸으로
  const bare = draftLegalPages({ business: { name: "예시 가게", address: "서울" } }, { id: "local", legal: { pages: ["privacy"], laws: { ko: [], en: [] } } }, "ko")
  const items = bare.privacy.clauses.find((c) => c.id === "privacy.items")
  assert.deepEqual(items.missing, ["legal.collects"])
  assert.match(items.text, /확인 필요/)
  assert.throws(() => draftLegalPages(koContent, { id: "x", legal: [] }, "ko"), /legal\.pages/)
  assert.throws(() => draftLegalPages(koContent, saasArch, "ja"), /locale/)
})

test("키 없음·API 실패(Review Focus 4): 초안은 나오고 모든 조항 unverified → legal-gate 1, 안내가 보인다", async () => {
  const drafts = draftLegalPages(koContent, saasArch, "ko")
  const review = pendingReview(drafts, NO_KEY_MESSAGE)
  const dir = await mkdtemp(join(tmpdir(), "legal-"))
  await mkdir(dir, { recursive: true })
  for (const [page, entries] of Object.entries(review)) {
    assert.ok(entries.every((e) => e.verdict === "unverified"))
    assert.equal(entries.length, drafts[page].clauses.length)
    await writeFile(join(dir, `${page}.review.json`), JSON.stringify(entries))
  }
  const r = await runGate([dir, "--locale", "ko", "--pages", "privacy,terms,refund"])
  assert.equal(r.code, 1)
  assert.match(r.out, /LAW_API_OC 없음 — open\.law\.go\.kr/)
  assert.match(r.out, /공개 불가\(법률 검토 미완\)/)
})

test("draft: 자리 표시 글자(「확인 필요」·To be confirmed)가 값으로 와도 빈 사실이다 — 조항에 missing 이 남는다(대장 C102)", () => {
  const blank = { ...koContent, business: { ...koContent.business, phone: PLACEHOLDER.ko, bizRegNo: PLACEHOLDER.ko } }
  const d = draftLegalPages(blank, saasArch, "ko")
  const provider = d.terms.clauses.find((c) => c.id === "terms.provider")
  assert.deepEqual([...provider.missing].sort(), ["business.bizRegNo", "business.phone"])
  const controller = d.privacy.clauses.find((c) => c.id === "privacy.controller")
  assert.deepEqual(controller.missing, ["business.phone"])
  // 음성 대조: 값이 진짜면 missing 이 없다(자리 표시를 값으로 읽던 옛 동작이면 위 단언이 실패한다)
  const real = draftLegalPages({ ...koContent, business: { ...koContent.business, phone: "02-1234-5678", bizRegNo: "123-45-67890" } }, saasArch, "ko")
  assert.equal(real.terms.clauses.find((c) => c.id === "terms.provider").missing, undefined)
  // en 자리 표시도 같다
  const en = draftLegalPages({ business: { name: "Example Cloud", address: "1 Example St", email: PLACEHOLDER.en }, legal: { effectiveDate: "2026-10-01" } }, saasArch, "en")
  assert.ok(en.privacy.clauses.find((c) => c.id === "privacy.controller").missing.includes("business.email"))
})

// ── 시행령(대통령령) 조회 — 2026-09-30 녹화: 전자상거래법 시행령·정보통신망법(+시행령·시행규칙) 검색, 시행령 제20조의2 ─────────────
const ECOM_LAW = "전자상거래 등에서의 소비자보호에 관한 법률"
const NETWORK_LAW = "정보통신망 이용촉진 및 정보보호 등에 관한 법률"

test("decree: decreeName 은 법률명 뒤에 「시행령」을 붙이고, 이미 시행령이면 그대로 둔다", () => {
  assert.equal(decreeName("개인정보 보호법"), "개인정보 보호법 시행령")
  assert.equal(decreeName(" 개인정보 보호법 시행령 "), "개인정보 보호법 시행령")
})

test("decree: 법률 검색 결과(법률·시행령·시행규칙)에서 이름이 같은 것만 — 시행령 요청은 대통령령 MST, 법률 요청은 법률 MST", async () => {
  const a = api(replay("search-network.json"))
  assert.equal((await a.current(NETWORK_LAW)).mst, "283843")
  const dec = await api(replay("search-network.json")).current(decreeName(NETWORK_LAW))
  assert.equal(dec.mst, "288033")
  assert.equal(dec.name, `${NETWORK_LAW} 시행령`)
  assert.notEqual(dec.mst, "230723", "시행규칙(부령)과 섞이면 안 된다")
  const decOnly = await api(replay("search-ecommerce-decree.json")).current(decreeName(ECOM_LAW))
  assert.equal(decOnly.mst, "288143")
})

test("decree: 이름이 같아도 법령구분명이 대통령령이 아니면 시행령으로 받지 않는다", async () => {
  const f = fx("search-ecommerce-decree.json")
  for (const l of [].concat(f.body.LawSearch.law)) l["법령구분명"] = "부령"
  await assert.rejects(api(replay(f)).current(decreeName(ECOM_LAW)), (e) => e.code === "not-current")
})

test("decree: basis(시행령 제20조의2) — JO 002002, 시행령 MST 로 인용 주소·시행일자, 본문에 30일(제13조⑥ 동의·고지 기간)", async () => {
  assert.equal(toJo("제20조의2"), "002002")
  const fetch = replay("search-ecommerce-decree.json", "article-ecommerce-decree-20-2.json")
  const b = await api(fetch).basis(decreeName(ECOM_LAW), "제20조의2")
  assert.equal(b.basis.law, `${ECOM_LAW} 시행령`)
  assert.equal(b.basis.article, "제20조의2")
  assert.equal(b.basis.mst, "288143")
  assert.equal(b.basis.url, "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=288143")
  assert.match(b.text, /전 30일/)
  assert.match(fetch.calls[1], /MST=288143&JO=002002/)
  assert.deepEqual(basisProblems(b.basis, "ko"), [], "legal-gate 가 받는 모양")
})

test("decree: CLI decree 는 인자 두 개가 필요하다(없으면 종료 2)", async () => {
  const run = (args) =>
    new Promise((res) => {
      const p = spawn(process.execPath, [join(HERE, "../legal/law-api.mjs"), ...args], { env: { ...process.env, LAW_API_OC: "" } })
      let e = ""
      p.stderr.on("data", (d) => (e += d))
      p.on("close", (code) => res({ code, err: e }))
    })
  const r = await run(["decree", "개인정보 보호법"])
  assert.equal(r.code, 2)
  assert.match(r.err, /decree/)
})

// ── 초안: 유료·체험·광고성·나이 조건 조항(2026-09-30 첫 실검토 반영) ─────────────────────────────────────
const saasFull = { id: "saas", legal: { pages: ["privacy", "terms", "refund", "withdrawal"], laws: { ko: [], en: [] } } }
const localArch = { id: "local", legal: { pages: ["privacy"], laws: { ko: [], en: [] } } }
const trialPaid = {
  business: { name: "견적노트", legalName: "주식회사 견적노트랩", representative: "김하늘", bizRegNo: "123-45-67890", mailOrderNo: "제2026-서울마포-0001호", address: "서울특별시 마포구 월드컵로 120", phone: "02-1234-5678", email: "help@example.com" },
  facts: { trial: "첫 14일 무료, 카드 등록 없이 시작", price: "월 9,900원" },
  plans: [{ name: "월 요금제", monthlyPrice: 9900, currency: "KRW", vatIncluded: true }],
}
const byId = (d, page, id) => d[page].clauses.find((c) => c.id === id)

test("draft(saas 체험+유료): 체험→유료 전환·정기결제 동의·법령 보존·14세 미만·환불 기간 조항이 생긴다(제13조⑥·시행령 제20조의2·제6조·제17조)", () => {
  const d = draftLegalPages(trialPaid, saasFull, "ko")
  // 무료 체험 → 유료 전환: 전환 전 30일 안에 일시·가격·결제방법을 알리고 동의(제13조⑥, 시행령 제20조의2)
  const conv = byId(d, "terms", "terms.trialConversion")
  assert.ok(conv, "체험+유료면 전환 조항")
  assert.match(conv.text, /30일/)
  assert.match(conv.text, /동의/)
  assert.deepEqual(conv.needs, [
    { law: ECOM_LAW, article: "제13조" },
    { law: `${ECOM_LAW} 시행령`, article: "제20조의2" },
  ])
  // 약관 변경: 요금 인상·유료 전환은 동의, 기간 문장은 법정 기간이 아니라는 출처 메모
  const change = byId(d, "terms", "terms.change")
  assert.match(change.text, /고객의 동의를 받은 뒤에만/)
  assert.ok(change.needs.some((n) => n.article === "제20조의2"))
  assert.ok(change.notes.some((n) => n.kind === "convention" && /법이 정한 기간이 아니라/.test(n.text)), "7일·30일이 약관법 조문에 없음을 조항이 스스로 밝힌다")
  // 유료면 결제 조항이 생기고, 결제 공급자를 모르면 빈 사실로 남는다(지어내지 않는다)
  const pay = byId(d, "terms", "terms.payment")
  assert.deepEqual(pay.missing, ["legal.paymentProvider"])
  assert.match(pay.text, /확인 필요/)
  // 법령에 따른 보존(전자상거래법 제6조·시행령 제6조): 5년·5년·3년
  const keep = byId(d, "privacy", "privacy.retention")
  assert.match(keep.text, /계약 또는 청약철회 등에 관한 기록: 5년/)
  assert.match(keep.text, /대금 결제 및 서비스 공급에 관한 기록: 5년/)
  assert.match(keep.text, /소비자 불만 또는 분쟁 처리에 관한 기록: 3년/)
  assert.ok(keep.needs.some((n) => n.law === `${ECOM_LAW} 시행령` && n.article === "제6조"))
  // 파기·권리: 다른 법령 보존 예외(개인정보 보호법 제21조 단서·제36조 단서)와 동의 철회
  assert.match(byId(d, "privacy", "privacy.destruction").text, /분리해 보관/)
  const rights = byId(d, "privacy", "privacy.rights")
  assert.match(rights.text, /동의를 철회/)
  assert.match(rights.text, /10일 안에/)
  assert.match(rights.text, /삭제를 요구할 수 없어요/)
  assert.ok(rights.needs.some((n) => n.law === "개인정보 보호법 시행령" && n.article === "제41조"))
  // 개인정보 보호책임자: 시행령 제32조(소상공인이면 대표자가 책임자)를 근거에 단다
  assert.ok(byId(d, "privacy", "privacy.officer").needs.some((n) => n.law === "개인정보 보호법 시행령" && n.article === "제32조"))
  // 만 14세 미만(제22조의2): 가입·계약이 있는 사이트. 나이 확인 방식 사실이 없으면 빈 사실
  const kids = byId(d, "privacy", "privacy.children")
  assert.deepEqual(kids.needs, [{ law: "개인정보 보호법", article: "제22조의2" }])
  assert.deepEqual(kids.missing, ["legal.ageGate"])
  const gated = draftLegalPages({ ...trialPaid, legal: { ageGate: 14 } }, saasFull, "ko")
  assert.match(byId(gated, "privacy", "privacy.children").text, /만 14세 미만 아동은 회원으로 가입할 수 없어요/)
  assert.equal(byId(gated, "privacy", "privacy.children").missing, undefined)
  // 환불: 기산일(서면 수령·공급 개시·체험 뒤 유료 시작 중 늦은 날)·3개월/30일·철회 제한·발송일 효력
  const win = byId(d, "refund", "refund.window")
  assert.match(win.text, /유료 이용을 시작한 날 가운데 늦은 날부터 7일/)
  assert.match(win.text, /3개월/)
  assert.match(win.text, /30일/)
  assert.match(byId(d, "withdrawal", "withdrawal.how").text, /보낸 날 철회의 효력이 생겨요/)
  assert.match(byId(d, "refund", "refund.effect").text, /지연배상금/)
  // 사업자 표기: 법인명(서비스명 상호), 청약철회 쪽 사업자 정보에 대표자·전화·메일·통신판매업 신고번호
  assert.match(byId(d, "terms", "terms.provider").text, /상호: 주식회사 견적노트랩\(서비스명 견적노트\)/)
  const wp = byId(d, "withdrawal", "withdrawal.provider").text
  for (const s of ["대표자: 김하늘", "통신판매업 신고번호: 제2026-서울마포-0001호", "전화: 02-1234-5678", "메일: help@example.com"]) assert.ok(wp.includes(s), s)
  assert.ok(byId(d, "privacy", "privacy.controller").text.includes("주식회사 견적노트랩(서비스명 견적노트)"))
})

test("draft(체험 없음): 유료여도 무료→유료 전환 조항·체험 문장은 없다", () => {
  const noTrial = { ...trialPaid, facts: { price: "월 9,900원" } }
  const d = draftLegalPages(noTrial, saasFull, "ko")
  assert.equal(byId(d, "terms", "terms.trialConversion"), undefined)
  assert.doesNotMatch(byId(d, "refund", "refund.window").text, /무료 체험 뒤/)
  assert.doesNotMatch(byId(draftLegalPages({ ...noTrial, legal: { withdrawalPolicy: "full" } }, saasFull, "ko"), "refund", "refund.limits").text, /무료 체험/)
  assert.ok(byId(d, "terms", "terms.payment"), "그래도 유료면 결제 조항")
})

test("draft(local 결제 없음): 유료·체험·나이·법령 보존 조항이 하나도 생기지 않는다(음성 대조)", () => {
  const local = { business: { name: "예시 식당", address: "서울", phone: "02-1", email: "a@b.kr" }, legal: { collects: [{ item: "이름", purpose: "예약", retention: "1년" }] } }
  const d = draftLegalPages(local, localArch, "ko")
  assert.deepEqual(Object.keys(d), ["privacy"])
  for (const id of ["privacy.retention", "privacy.children", "privacy.marketing"]) assert.equal(byId(d, "privacy", id), undefined, id)
  assert.doesNotMatch(d.privacy.markdown, /5년|청약철회|무료 체험/)
  assert.doesNotMatch(byId(d, "privacy", "privacy.rights").text, /삭제를 요구할 수 없어요/)
  assert.doesNotMatch(byId(d, "privacy", "privacy.destruction").text, /법령에 따라 보존/)
  assert.equal(legalContext(local, localArch).paid, false)
  // 같은 콘텐츠에 체험 사실이 있어도 결제 페이지가 없으면 전환 조항 대상이 아니다
  assert.equal(legalContext({ ...local, facts: { trial: "첫 14일 무료" } }, localArch).trialConversion, false)
})

test("draft(광고성 정보): marketingConsent 이면 채널·야간 전송·철회 조항(정보통신망법 제50조·시행령 제61조), 채널을 모르면 빈 사실", () => {
  const withMkt = { ...trialPaid, legal: { marketingConsent: true } }
  const d = draftLegalPages(withMkt, saasFull, "ko")
  const m = byId(d, "privacy", "privacy.marketing")
  assert.deepEqual(m.needs, [
    { law: NETWORK_LAW, article: "제50조" },
    { law: `${NETWORK_LAW} 시행령`, article: "제61조" },
  ])
  assert.deepEqual(m.missing, ["legal.marketingChannels"])
  assert.match(m.text, /오후 9시부터 다음 날 오전 8시/)
  assert.match(m.text, /전자우편을 뺀 채널/)
  assert.match(m.text, /통신 요금은 받지 않아요/)
  const withCh = draftLegalPages({ ...withMkt, legal: { marketingConsent: true, marketingChannels: ["이메일", "문자"] } }, saasFull, "ko")
  assert.match(byId(withCh, "privacy", "privacy.marketing").text, /이메일·문자/)
  assert.equal(byId(withCh, "privacy", "privacy.marketing").missing, undefined)
  assert.equal(byId(draftLegalPages(trialPaid, saasFull, "ko"), "privacy", "privacy.marketing"), undefined, "동의를 안 받으면 조항 없음")
})

test("draft: 종이 문서 파기 문장은 legal.paperRecords 사실이 있을 때만(SaaS 초안에 지어내지 않는다)", () => {
  assert.doesNotMatch(byId(draftLegalPages(trialPaid, saasFull, "ko"), "privacy", "privacy.destruction").text, /종이 문서/)
  assert.match(byId(draftLegalPages({ ...trialPaid, legal: { paperRecords: true } }, saasFull, "ko"), "privacy", "privacy.destruction").text, /종이 문서/)
})

test("draft: 새 조항의 근거는 law-api 로 가져올 수 있는 이름·조 번호다(시행령 포함, 녹화 검색에 이름이 있다)", () => {
  const d = draftLegalPages({ ...trialPaid, legal: { marketingConsent: true, ageGate: 14, paymentProvider: "paddle" } }, saasFull, "ko")
  const recorded = ["search-privacy.json", "search-ecommerce.json", "search-ecommerce-decree.json", "search-terms.json", "search-network.json", "search-network-decree.json"].flatMap((f) => [].concat(fx(f).body.LawSearch.law).map((l) => l["법령명한글"]))
  const needs = Object.values(d).flatMap((p) => p.clauses.flatMap((c) => c.needs))
  for (const n of needs) {
    assert.ok(recorded.includes(n.law), `녹화에 없는 법: ${n.law}`)
    assert.match(toJo(n.article), /^\d{6}$/)
  }
  assert.ok(needs.some((n) => /시행령$/.test(n.law)), "시행령 근거가 있다")
})

// ── 게이트: 초안에 없는 조항 제안(proposedClauses)은 fix ──────────────────────────────────────────────────
test("legal-gate: proposedClauses 가 비어 있지 않으면 조항이 전부 ok 여도 1(proposed-clause), 비어 있거나 없으면 0", async () => {
  const proposal = { title: "무료 체험 뒤 유료 전환", text: "전환 전 30일 안에 동의를 받아요.", law: ECOM_LAW, article: "제13조", reason: "제13조⑥" }
  const withProposal = await reviewDir({ terms: { clauses: [okEntry("terms.explain")], proposedClauses: [proposal] } })
  const r = await runGate([withProposal, "--locale", "ko", "--pages", "terms"])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /무료 체험 뒤 유료 전환 \[proposed-clause\]/)
  const res = JSON.parse(await readFile(join(withProposal, "legal-gate.json"), "utf8"))
  assert.equal(res.ok, false)
  assert.equal(res.pages.terms.proposed, 1)
  assert.equal(res.pages.terms.ok, 1)

  const emptyProposal = await reviewDir({ terms: { clauses: [okEntry("terms.explain")], proposedClauses: [] } })
  assert.equal((await runGate([emptyProposal, "--locale", "ko", "--pages", "terms"])).code, 0)
  const legacy = await reviewDir({ terms: [okEntry("terms.explain")] })
  assert.equal((await runGate([legacy, "--locale", "ko", "--pages", "terms"])).code, 0, "옛 배열 모양도 그대로 받는다")
  // ok 에 권고가 담긴 note 는 통과(권고는 note 에)
  const rec = await reviewDir({ terms: [{ ...okEntry("terms.explain"), note: "권고: 약관 사본 제공 문장을 더하면 좋다" }] })
  assert.equal((await runGate([rec, "--locale", "ko", "--pages", "terms"])).code, 0)
})

test("legal-gate: proposedClauses 모양이 틀리면 도구 실패(결과 파일 없음)", async () => {
  const bad = await reviewDir({ terms: { clauses: [okEntry("terms.explain")], proposedClauses: [{ title: "제목만" }] } })
  const r = await runGate([bad, "--locale", "ko"])
  assert.equal(r.code, 1)
  assert.match(r.err, /^도구 실패: .*proposedClauses\[0\]/)
  assert.equal(existsSync(join(bad, "legal-gate.json")), false)
  const notArray = await reviewDir({ terms: { clauses: [okEntry("terms.explain")], proposedClauses: "x" } })
  assert.match((await runGate([notArray, "--locale", "ko"])).err, /proposedClauses 는 배열/)
  const noClauses = await reviewDir({ terms: { proposedClauses: [] } })
  assert.match((await runGate([noClauses, "--locale", "ko"])).err, /도구 실패/)
})

test("legalContext: 유료 판정은 콘텐츠(요금제 가격·결제 공급자)와 원형(환불·청약철회 쪽)이 각각 독립으로 켠다", () => {
  const termsOnly = { id: "x", legal: { pages: ["privacy", "terms"], laws: { ko: [], en: [] } } }
  const base = { business: { name: "가게", address: "서울", phone: "02-1", email: "a@b.kr" } }
  assert.equal(legalContext(base, termsOnly).paid, false)
  assert.equal(legalContext({ ...base, plans: [{ name: "무료", monthlyPrice: 0 }] }, termsOnly).paid, false, "0원 요금제는 유료가 아니다")
  assert.equal(legalContext({ ...base, plans: [{ name: "월", monthlyPrice: 9900 }] }, termsOnly).paid, true)
  assert.equal(legalContext({ ...base, legal: { paymentProvider: "toss" } }, termsOnly).paid, true)
  assert.equal(legalContext({ ...base, legal: { paymentProvider: PLACEHOLDER.ko } }, termsOnly).paid, false, "자리 표시는 사실이 아니다")
  assert.equal(legalContext(base, { id: "y", legal: { pages: ["privacy", "refund"], laws: { ko: [], en: [] } } }).paid, true)
  assert.equal(legalContext({ ...base, plans: [{ name: "월", monthlyPrice: 9900, trialDays: 14 }] }, termsOnly).trial, true)
})

// ── 첫 실검토의 2차 지적(서비스 설명·미성년자·불만 처리·안전성 확보·자동 수집·철회 정책 충돌) 반영 ──────────────────────
test("draft(철회 정책): refund.limits 는 운영자가 정한 정책(full|limited)과 짝인 문장만 — 정책을 모르면 빈 사실, 두 값이 서로 어긋나지 않는다", () => {
  const missing = byId(draftLegalPages(trialPaid, saasFull, "ko"), "refund", "refund.limits")
  assert.deepEqual(missing.missing, ["legal.withdrawalPolicy"])
  assert.match(missing.text, /확인 필요/)
  const full = byId(draftLegalPages({ ...trialPaid, legal: { withdrawalPolicy: "full" } }, saasFull, "ko"), "refund", "refund.limits")
  assert.match(full.text, /이용했는지와 상관없이 철회할 수 있어요/)
  assert.doesNotMatch(full.text, /철회할 수 없어요/, "full 은 제한 문장을 쓰지 않는다(refund.window 와 충돌 방지)")
  assert.equal(full.missing, undefined)
  const limited = byId(draftLegalPages({ ...trialPaid, legal: { withdrawalPolicy: "limited" } }, saasFull, "ko"), "refund", "refund.limits")
  assert.match(limited.text, /이미 제공된 부분은 철회할 수 없어요/)
  assert.match(limited.text, /결제 전에 알려 드려요/)
  assert.match(limited.text, /제공이 시작되지 않은 부분은 철회할 수 있어요/)
  assert.doesNotMatch(limited.text, /이용했는지와 상관없이/)
})

test("draft(유료 계약): 서비스 내용·미성년자 취소 고지·불만 처리 조항(제13조②2·4·8, ③)과 결제 요금·인상 동의 문장", () => {
  const d = draftLegalPages({ ...trialPaid, product: { name: "견적노트", url: "https://gyeonjeok.example.com" }, facts: { ...trialPaid.facts, claim: "견적서를 링크로 보내고 승인 여부를 확인해요" }, legal: { provisionTiming: "결제 직후" } }, saasFull, "ko")
  const svc = byId(d, "terms", "terms.service")
  assert.deepEqual(svc.needs, [{ law: ECOM_LAW, article: "제13조" }])
  assert.match(svc.text, /서비스: 견적노트/)
  assert.match(svc.text, /내용: 견적서를 링크로 보내고 승인 여부를 확인해요/)
  assert.match(svc.text, /접속해 이용해요/)
  assert.match(svc.text, /이용 시작 시기: 결제 직후/)
  assert.equal(svc.missing, undefined)
  assert.deepEqual(byId(draftLegalPages(trialPaid, saasFull, "ko"), "terms", "terms.service").missing, ["facts.claim", "legal.provisionTiming"], "사실이 없으면 지어내지 않는다")
  assert.match(byId(d, "terms", "terms.minors").text, /미성년자 본인이나 법정대리인이 그 계약을 취소할 수 있어요/)
  const cmp = byId(d, "terms", "terms.complaint")
  assert.match(cmp.text, /전화 02-1234-5678 · 메일 help@example\.com/)
  const pay = byId(d, "terms", "terms.payment")
  assert.match(pay.text, /요금: 월 9,900원/)
  assert.match(pay.text, /오르기 전 30일 안에 오르는 일시와 오르기 전후의 가격, 결제 방법을 알리고 고객의 동의를 받아요/)
  assert.match(pay.text, /해지하는 조건과 방법, 그 효과/)
  assert.ok(pay.needs.some((n) => n.article === "제20조의2"))
  // 결제 없는 계약 페이지(약관만 있는 원형)에는 이 셋이 없다
  const termsOnly = draftLegalPages({ business: trialPaid.business }, { id: "x", legal: { pages: ["privacy", "terms"], laws: { ko: [], en: [] } } }, "ko")
  for (const id of ["terms.service", "terms.minors", "terms.complaint", "terms.payment"]) assert.equal(byId(termsOnly, "terms", id), undefined, id)
})

test("draft(방침 필수 기재): 안전성 확보 조치(시행령 제31조①3)는 모든 방침에 — 조치를 모르면 빈 사실 / 자동 수집 조항은 autoCollect 일 때만 / 대표자 책임자·보존 항목·동의 거부 문장", () => {
  const local = { business: { name: "예시 식당", representative: "홍길동", address: "서울", phone: "02-1", email: "a@b.kr" } }
  const d = draftLegalPages(local, localArch, "ko")
  const sec = byId(d, "privacy", "privacy.security")
  assert.deepEqual(sec.needs, [{ law: "개인정보 보호법", article: "제30조" }, { law: "개인정보 보호법 시행령", article: "제31조" }])
  assert.deepEqual(sec.missing, ["legal.security"])
  const secOk = draftLegalPages({ ...local, legal: { security: ["비밀번호는 암호화해 저장해요", "접근 권한을 필요한 사람에게만 줘요"] } }, localArch, "ko")
  assert.match(byId(secOk, "privacy", "privacy.security").text, /- 비밀번호는 암호화해 저장해요/)
  // 자동 수집
  assert.equal(byId(d, "privacy", "privacy.autoCollect"), undefined)
  const auto = byId(draftLegalPages({ ...local, legal: { autoCollect: true } }, localArch, "ko"), "privacy", "privacy.autoCollect")
  assert.deepEqual(auto.missing, ["legal.autoCollectItems"])
  assert.match(auto.text, /동의한 분의 것만 모아요/)
  const autoOk = byId(draftLegalPages({ ...local, legal: { autoCollect: true, autoCollectItems: ["방문한 쪽 · 통계 도구"] } }, localArch, "ko"), "privacy", "privacy.autoCollect")
  assert.equal(autoOk.missing, undefined)
  // 책임자: 대표자 = 책임자(소상공인)
  const self = byId(draftLegalPages({ ...local, legal: { officer: { self: true } } }, localArch, "ko"), "privacy", "privacy.officer")
  assert.match(self.text, /책임자: 대표자 홍길동/)
  assert.equal(self.missing, undefined)
  assert.deepEqual(byId(d, "privacy", "privacy.officer").missing, ["legal.officer.name", "legal.officer.contact"])
  // 보존 항목·동의 거부·시행일 문장
  const paid = draftLegalPages(trialPaid, saasFull, "ko")
  assert.match(byId(paid, "privacy", "privacy.retention").text, /보존하는 개인정보 항목: 거래 주체를 식별할 수 있는 정보/)
  assert.match(byId(paid, "privacy", "privacy.items").text, /필수 항목을 거부하면 서비스를 이용할 수 없고/)
  assert.match(byId(paid, "privacy", "privacy.effective").text, /바뀐 내용과 적용일을 알려요/)
  // 철회 서식(제13조②5)
  const how = byId(paid, "withdrawal", "withdrawal.how").text
  assert.match(how, /철회 서식/)
  assert.match(how, /- 받는 곳: help@example\.com/)
  assert.match(how, /「청약을 철회합니다」/)
})

// ── 영어 물품(goods)·서비스 불변·개인정보 권리(P4EN — 대장 C250 ①·C166) ────────────────────────────────────────────
// 근거: EUR-Lex 2026-10-01 실측 — 소비자권리지침 2011/83/EU 현행 통합본(02011L0083-20260927) 제6·9·11·11a·13·14·16조·부속서 I(B), GDPR 제7(3)·12(3)·13·15~22·77조.
// 실호출 없음 — 콘텐츠 객체만 쓴다. 서비스 해시는 이 레인을 시작하기 전(7fc8dbf)의 en 초안 출력의 sha256 이다.
const enPages = ["privacy", "terms", "refund", "withdrawal"]
const enDetailArch = { id: "detail", legal: { pages: enPages, laws: { ko: [], en: [] } } }
const enSaasArch = { id: "saas", legal: { pages: enPages, laws: { ko: [], en: [] } } }
const enSaas = { business: { name: "Example Cloud", address: "1 Example St, San Francisco, CA", email: "help@example.com" }, legal: { paymentProvider: "paddle", governingLaw: "the laws of Ireland", effectiveDate: "2026-10-01" }, plans: [{ name: "Pro", monthlyPrice: 900, currency: "USD" }] }
const enBusiness = { name: "Kiln & Kettle Studio", address: "12 Example Street, Seoul", email: "hello@example.com", phone: "+82-2-0000-0000" }
const enGoods = {
  locale: "en",
  business: enBusiness,
  product: {
    name: "Hand-thrown ceramic dripper",
    price: 4800,
    currency: "USD",
    taxIncluded: true,
    shipping: { fee: 600, freeThreshold: 8000, courier: "Example Post", leadDays: 3 },
    returns: { feePayer: "buyer", withdrawalDays: 14, exclusions: [] },
  },
  legal: {
    paymentProvider: "Stripe",
    governingLaw: "the laws of Ireland",
    effectiveDate: "2026-10-01",
    returnAddress: "Returns, 12 Example Street, Seoul",
    warranty: "none beyond the legal guarantee",
    withdrawalFunction: "use the 'Withdraw from contract here' link in your order confirmation email.",
    collects: [{ item: "Email", purpose: "Order updates", retention: "6 years after the order" }],
    processors: [{ name: "Example Post", task: "Delivery", country: "KR" }],
    withdrawalPolicy: "full",
  },
}
const enText = (d, page, id) => d[page].clauses.find((c) => c.id === id)
const withReturns = (over, legal = {}) => ({ ...enGoods, product: { ...enGoods.product, returns: { ...enGoods.product.returns, ...over } }, legal: { ...enGoods.legal, ...legal } })

test("en goods: 철회 기간은 구매일이 아니라 상품을 받은 날부터(소비자권리지침 제9조②(b))", () => {
  const d = draftLegalPages(enGoods, enDetailArch, "en")
  const w = enText(d, "refund", "refund.window")
  assert.match(w.text, /within 14 days after the day you receive the goods/)
  assert.match(w.text, /day you receive the last item/, "제9조②(b)(i) 따로 배송")
  assert.match(w.text, /last lot or piece/, "제9조②(b)(ii)")
  assert.doesNotMatch(w.text, /of purchase|purchase/i)
  assert.ok(w.needs.some((n) => n.law.startsWith("Consumer Rights Directive") && n.article === "Art. 9"))
  assert.match(enText(d, "withdrawal", "withdrawal.how").text, /^You have 14 days from the day you receive the goods/)
  // 사업자가 더 길게 정했으면 그 기간, 지침의 14일보다 짧게는 쓰지 않는다
  assert.match(enText(draftLegalPages(withReturns({ withdrawalDays: 30 }), enDetailArch, "en"), "refund", "refund.window").text, /within 30 days after the day you receive the goods/)
  assert.match(enText(draftLegalPages(withReturns({ withdrawalDays: 7 }), enDetailArch, "en"), "refund", "refund.window").text, /within 14 days after/)
  // 서비스 페이지에는 이 문장이 없다 — 서비스는 계약 체결일부터(제9조②(a))이고 「구매일에 전액 환불」 약속을 지어내지 않는다(FINAL-WF4 EN9)
  const svc = enText(draftLegalPages(enSaas, enSaasArch, "en"), "refund", "refund.window").text
  assert.match(svc, /from the day the contract is concluded \(Directive 2011\/83\/EU, Article 9\)/)
  assert.doesNotMatch(svc, /of purchase|full refund/)
})

test("en goods: 환급은 철회 통지를 안 날부터 14일·같은 결제 수단·반송 확인 전까지 보류 가능(제13조①②③) — 두 쪽이 같은 글", () => {
  const d = draftLegalPages(enGoods, enDetailArch, "en")
  const e = enText(d, "refund", "refund.effect")
  assert.match(e.text, /no later than 14 days after the day we are informed of your decision to withdraw/)
  assert.match(e.text, /including the costs of standard delivery/)
  assert.match(e.text, /same means of payment/)
  assert.match(e.text, /least expensive standard delivery/, "제13조② 추가 배송비 제외")
  assert.match(e.text, /may withhold the refund until we have received the goods back or you have shown evidence/, "제13조③")
  assert.equal(enText(d, "withdrawal", "withdrawal.effect").text, e.text)
  assert.ok(e.needs.some((n) => n.article === "Art. 13"))
  // 서비스는 법정 문장(제13조①·제14조③) — 근거 없는 「구매 뒤 14일 안 환불」 약속이 아니다(FINAL-WF4 EN9)
  const svcEffect = enText(draftLegalPages(enSaas, enSaasArch, "en"), "refund", "refund.effect")
  assert.match(svcEffect.text, /no later than 14 days after the day we are informed of your decision to withdraw \(Directive 2011\/83\/EU, Article 13\)/)
  assert.match(svcEffect.text, /proportionate amount/)
  assert.ok(svcEffect.needs.some((n) => n.article === "Art. 14"))
})

test("en goods 반품: 반송 기한 14일·반품 비용 부담자는 콘텐츠 사실(buyer·seller)·모르면 빈 사실(제14조①②)", () => {
  const buyer = enText(draftLegalPages(enGoods, enDetailArch, "en"), "refund", "refund.returnCost")
  assert.match(buyer.text, /no later than 14 days after the day you tell us you are withdrawing/)
  assert.match(buyer.text, /You only bear the direct cost of returning the goods/)
  assert.match(buyer.text, /loss in value of the goods that results from handling them beyond what is needed/, "제14조②")
  assert.match(buyer.text, /Return address: Returns, 12 Example Street/)
  assert.equal(buyer.missing, undefined)
  assert.ok(buyer.needs.some((n) => n.article === "Art. 14"))
  const seller = enText(draftLegalPages(withReturns({ feePayer: "seller" }), enDetailArch, "en"), "refund", "refund.returnCost")
  assert.match(seller.text, /We bear the cost of returning the goods/)
  assert.doesNotMatch(seller.text, /You only bear/)
  // 콘텐츠가 「To be confirmed」·반품 주소 없음이면 지어내지 않는다
  const bare = enText(draftLegalPages(withReturns({ feePayer: PLACEHOLDER.en }, { returnAddress: undefined }), enDetailArch, "en"), "refund", "refund.returnCost")
  assert.deepEqual(bare.missing.sort(), ["legal.returnAddress", "product.returns.feePayer"])
  assert.equal(bare.text, "To be confirmed: who pays for returning the goods; return address.", "빈 사실이 있으면 조항 전체가 한 줄(FINAL-WF4 EN9)")
  // 철회 쪽에도 같은 글
  assert.equal(enText(draftLegalPages(enGoods, enDetailArch, "en"), "withdrawal", "withdrawal.returnGoods").text, buyer.text)
  // 서비스에는 반품 조항이 없다
  assert.equal(enText(draftLegalPages(enSaas, enSaasArch, "en"), "refund", "refund.returnCost"), undefined)
})

test("en goods 예외: 지침 제16조 물품 예외 중 콘텐츠가 주장한 것만 — 디지털 콘텐츠 예외·구독 문장은 없다", () => {
  const lim = { withdrawalPolicy: "limited" }
  const d = draftLegalPages(withReturns({ exclusions: ["Custom-glazed pieces made to order", "Sealed cosmetics once opened"] }, lim), enDetailArch, "en")
  for (const [page, id] of [["refund", "refund.exceptions"], ["withdrawal", "withdrawal.exceptions"]]) {
    const c = enText(d, page, id)
    assert.match(c.text, /goods made to your specifications or clearly personalised/, id)
    assert.match(c.text, /sealed goods that are not suitable for return for health protection or hygiene reasons and that you unsealed after delivery/, id)
    assert.doesNotMatch(c.text, /deteriorate|inseparably|newspaper|audio or video|digital content|download|stream/i, `${id} — 주장하지 않은 예외는 싣지 않는다`)
    assert.equal(c.missing, undefined)
    assert.ok(c.needs.some((n) => n.article === "Art. 16"))
  }
  // 변질·혼합 사유를 주장하면 그 항만 더해진다
  const more = enText(draftLegalPages(withReturns({ exclusions: ["Fresh flowers (perishable)", "Loose beads mixed with other beads"] }, lim), enDetailArch, "en"), "refund", "refund.exceptions")
  assert.match(more.text, /liable to deteriorate or expire rapidly/)
  assert.match(more.text, /inseparably mixed with other items/)
  assert.doesNotMatch(more.text, /made to your specifications/)
  // 제16조에 없는 사유(예: 중고)는 예외로 싣지 않고 빈 사실 + 메모
  const odd = enText(draftLegalPages(withReturns({ exclusions: ["Used items"] }, lim), enDetailArch, "en"), "refund", "refund.exceptions")
  assert.doesNotMatch(odd.text, /Used items/)
  assert.equal(odd.text, "To be confirmed: exceptions to the right of withdrawal.")
  assert.deepEqual(odd.missing, ["product.returns.exclusions"])
  assert.equal(odd.notes[0].kind, "unmapped-exclusion")
  assert.match(odd.notes[0].text, /"Used items"/)
  // 정책 full = 예외 없음, 정책도 사유도 없으면 운영자에게 받는다(기본값 없음), full 인데 사유가 있으면 어긋남 → 빈 사실
  assert.match(enText(draftLegalPages(enGoods, enDetailArch, "en"), "refund", "refund.exceptions").text, /^None of the legal exceptions/)
  const none = enText(draftLegalPages(withReturns({}, { withdrawalPolicy: undefined }), enDetailArch, "en"), "withdrawal", "withdrawal.exceptions")
  assert.deepEqual(none.missing, ["legal.withdrawalPolicy"])
  assert.deepEqual(enText(draftLegalPages(withReturns({ exclusions: ["Sealed cosmetics"] }, { withdrawalPolicy: "full" }), enDetailArch, "en"), "refund", "refund.exceptions").missing, ["legal.withdrawalPolicy"])
  // 서비스(saas): 사업과 무관한 「디지털 콘텐츠 다운로드」 문장 대신 운영자가 정한 철회 정책을 읽는다(정책 없음 = 빈 사실, FINAL-WF4 EN9)
  const svcEx = enText(draftLegalPages(enSaas, enSaasArch, "en"), "withdrawal", "withdrawal.exceptions")
  assert.equal(svcEx.text, "To be confirmed: withdrawal policy (full or limited).")
  assert.deepEqual(svcEx.missing, ["legal.withdrawalPolicy"])
  assert.doesNotMatch(svcEx.text, /download or stream/)
})

test("en goods 페이지에는 서비스·구독·디지털 콘텐츠 문장이 없고 한글도 없다", () => {
  const d = draftLegalPages(withReturns({ exclusions: ["Custom made to order"] }, { withdrawalPolicy: "limited" }), enDetailArch, "en")
  for (const page of ["terms", "refund", "withdrawal"]) {
    assert.doesNotMatch(d[page].markdown, /subscription|digital content|download or stream|of purchase|cancel within/i, page)
    assert.doesNotMatch(d[page].markdown, /[가-힣]/, page)
  }
})

test("en goods 철회 안내: 부속서 I(B) 모델 양식·제11a조 온라인 철회 기능은 콘텐츠가 말할 때만(빈 사실이면 To be confirmed)", () => {
  const how = enText(draftLegalPages(enGoods, enDetailArch, "en"), "withdrawal", "withdrawal.how")
  assert.match(how.text, /Model withdrawal form/)
  assert.match(how.text, /I hereby give notice that I withdraw from my contract of sale of the following goods/)
  assert.match(how.text, /Signature of consumer \(only if this form is notified on paper\)/)
  assert.match(how.text, /You can also withdraw online: use the 'Withdraw from contract here' link/)
  assert.equal(how.missing, undefined)
  assert.ok(how.needs.some((n) => n.article === "Art. 11a"))
  assert.equal(how.notes[0].kind, "scope")
  const none = enText(draftLegalPages(withReturns({}, { withdrawalFunction: undefined }), enDetailArch, "en"), "withdrawal", "withdrawal.how")
  assert.deepEqual(none.missing, ["legal.withdrawalFunction"])
})

test("en goods 약관: 전화·가격·배송비·법정 보증은 콘텐츠 사실, 없으면 빈 사실", () => {
  const d = draftLegalPages(enGoods, enDetailArch, "en")
  assert.match(enText(d, "terms", "terms.provider").text, /phone \+82-2-0000-0000/)
  const del = enText(d, "terms", "terms.delivery")
  assert.match(del.text, /Price: \$48\.00 \(VAT included\)/)
  assert.match(del.text, /Delivery by Example Post\. Delivery fee: \$6\.00 \(free over \$80\.00\)\. We ship within 3 business days after you order\./)
  assert.equal(del.missing, undefined)
  assert.match(enText(d, "terms", "terms.guarantee").text, /legal guarantee of conformity .* lasts at least two years/)
  const bare = draftLegalPages({ ...enGoods, business: { ...enBusiness, phone: PLACEHOLDER.en }, product: { ...enGoods.product, shipping: { fee: PLACEHOLDER.en, courier: PLACEHOLDER.en, leadDays: 3 } }, legal: { ...enGoods.legal, warranty: undefined, paymentProvider: undefined } }, enDetailArch, "en")
  assert.deepEqual(enText(bare, "terms", "terms.provider").missing, ["business.phone"])
  assert.deepEqual(enText(bare, "terms", "terms.delivery").missing.sort(), ["product.shipping.courier", "product.shipping.fee"])
  assert.deepEqual(enText(bare, "terms", "terms.guarantee").missing, ["legal.warranty"])
  assert.deepEqual(enText(bare, "terms", "terms.payment").missing, ["legal.paymentProvider"], "물품은 결제 공급자가 없어도 결제 조항이 있다(빈 사실)")
})

// 서비스 해시: 7fc8dbf 의 en 초안(terms·refund·withdrawal)을 JSON.stringify 해 sha256 한 값. FINAL-WF4 EN9 가 환불·철회의 지어낸 숫자(「구매 뒤 14일 안 전액 환불」)·사업 무관 문장·
// 문장 가운데 「To be confirmed」를 고쳐 refund·withdrawal 해시와 빈 사실이 있는 terms(bare)를 다시 떴다. 사실이 다 있는 terms(paddle·stripe)는 한 글자도 안 바뀌었다(기준 해시 그대로).
const SERVICE_EN_BASELINE = {
  paddle: {
    content: enSaas,
    terms: "156868f84d94bb6c0a9c2bce9fc799117fae1648a6f305ff91b9efd61d7f8abe",
    refund: "8bb9a3471ec68684d9b6fab181a6cbc7799038851813a618e6726125478f048b",
    withdrawal: "5c06f155b27c015fc439d8b537835faf66c4240ae3224b34a4bb37c1ccd55cbb",
  },
  stripe: {
    content: { business: enSaas.business, legal: { paymentProvider: "Stripe", governingLaw: "the laws of Ireland" } },
    terms: "2778be668dfd94251f21d1dbb20b53419867dcf93e4d6c4b97d678644050d628",
    refund: "116a1153e24559cac5c9be9dfb4e6bca8b9eaffb42bb7f18fb56dd8c9f950e37",
    withdrawal: "5c06f155b27c015fc439d8b537835faf66c4240ae3224b34a4bb37c1ccd55cbb",
  },
  bare: {
    content: { business: { name: "Example Cloud", address: "1 Example St", email: PLACEHOLDER.en } },
    terms: "7cd472811be45f9af7d06aeb545ef15bb660d3a04831efd4913a36a83b9c5ba5",
    refund: "eba0111898d62062c73fad90be42be1a31859ed901c3886b816855a63b0b658a",
    withdrawal: "de4d408a0201be5b5e94c99fb66127330974a14591c791e6075bd75352242753",
  },
}
test("en 서비스·구독 초안(terms·refund·withdrawal)은 FINAL-WF4 EN9 기준 출력과 sha256 이 같다(사실이 다 있는 terms 는 7fc8dbf 와도 같다)", () => {
  for (const [name, base] of Object.entries(SERVICE_EN_BASELINE)) {
    const d = draftLegalPages(base.content, enSaasArch, "en")
    assert.equal(legalContext(base.content, enSaasArch).goods, false, name)
    for (const page of ["terms", "refund", "withdrawal"]) assert.equal(createHash("sha256").update(JSON.stringify(d[page])).digest("hex"), base[page], `${name}/${page}`)
  }
  // 음성 대조: 한 글자라도 다르면 해시가 달라진다(검사가 실제로 비교한다)
  const d = draftLegalPages(SERVICE_EN_BASELINE.paddle.content, enSaasArch, "en")
  assert.notEqual(createHash("sha256").update(JSON.stringify(d.refund).replace("14 days", "15 days")).digest("hex"), SERVICE_EN_BASELINE.paddle.refund)
  // 서비스 개인정보의 나머지 조항 문장도 그대로
  const p = draftLegalPages(SERVICE_EN_BASELINE.paddle.content, enSaasArch, "en").privacy
  assert.equal(p.clauses.find((c) => c.id === "privacy.controller").text, "Example Cloud, 1 Example St, San Francisco, CA. Contact: help@example.com.")
  assert.equal(p.clauses.find((c) => c.id === "privacy.effective").text, "This policy applies from 2026-10-01.")
})

test("en privacy 권리: 접근·정정·삭제·제한·이동·자동화 결정·동의 철회·감독기관 불만·기한(GDPR 제7(3)·12(3)·15~22·77조) — 서비스·물품 모두", () => {
  for (const [content, arch] of [[enSaas, enSaasArch], [enGoods, enDetailArch]]) {
    const d = draftLegalPages(content, arch, "en")
    const rights = enText(d, "privacy", "privacy.rights")
    for (const re of [/Access: .*Article 15/, /Rectification/, /Erasure: .*Article 17/, /Restriction: .*Article 18/, /Portability: .*machine-readable/, /Automated decisions: .*Article 22\(2\)/, /Withdrawing consent: .* at any time/, /Opting out: opt out of any sale or sharing/, /within one month/, /lodge a complaint with a supervisory authority/])
      assert.match(rights.text, re, String(re))
    for (const article of ["Art. 7(3)", "Art. 12(3)", "Art. 15", "Art. 16", "Art. 17", "Art. 18", "Art. 20", "Art. 22", "Art. 77"]) assert.ok(rights.needs.some((n) => /^GDPR/.test(n.law) && n.article === article), article)
    assert.equal(rights.missing, undefined)
    // 반대권은 따로 — 제21조④ 분리 제시
    const obj = enText(d, "privacy", "privacy.object")
    assert.match(obj.text, /object at any time, on grounds relating to your particular situation/)
    assert.match(obj.text, /object at any time to processing of your data for direct marketing/)
    assert.ok(obj.needs.some((n) => n.article === "Art. 21"))
    assert.ok(d.privacy.clauses.findIndex((c) => c.id === "privacy.object") > d.privacy.clauses.findIndex((c) => c.id === "privacy.rights"))
  }
  assert.doesNotMatch(draftLegalPages(enGoods, enDetailArch, "en").privacy.markdown, /[가-힣]/)
})

test("en privacy 보관 기간: 항목마다 적은 retention 이 있으면 그것, 없으면 전용 사실 legal.retention — 빈 사실은 legal.collects 가 아니라 legal.retention", () => {
  const withRows = enText(draftLegalPages(enGoods, enDetailArch, "en"), "privacy", "privacy.retention")
  assert.equal(withRows.text, "- Email: 6 years after the order")
  assert.equal(withRows.missing, undefined)
  // 항목은 있는데 보관 기간이 빠진 행 → 그 행의 경로
  const noRowRetention = { ...enGoods, legal: { ...enGoods.legal, collects: [{ item: "Email", purpose: "Order updates" }] } }
  assert.deepEqual(enText(draftLegalPages(noRowRetention, enDetailArch, "en"), "privacy", "privacy.retention").missing, ["legal.collects.0.retention"])
  // 수집 항목 자체가 없으면 전용 사실 자리
  const noCollects = { ...enGoods, legal: { ...enGoods.legal, collects: undefined } }
  const miss = enText(draftLegalPages(noCollects, enDetailArch, "en"), "privacy", "privacy.retention")
  assert.deepEqual(miss.missing, ["legal.retention"])
  assert.equal(miss.text, "To be confirmed: retention periods.")
  assert.deepEqual(enText(draftLegalPages(noCollects, enDetailArch, "en"), "privacy", "privacy.data").missing, ["legal.collects"], "수집 항목 조항은 여전히 legal.collects")
  const given = enText(draftLegalPages({ ...noCollects, legal: { ...noCollects.legal, retention: "Order records for 6 years; everything else until you delete your account" } }, enDetailArch, "en"), "privacy", "privacy.retention")
  assert.equal(given.text, "Retention: Order records for 6 years; everything else until you delete your account")
  assert.equal(given.missing, undefined)
  // 자리 표시 글자가 값으로 들어와도 빈 사실(C102)
  assert.deepEqual(enText(draftLegalPages({ ...noCollects, legal: { ...noCollects.legal, retention: PLACEHOLDER.en } }, enDetailArch, "en"), "privacy", "privacy.retention").missing, ["legal.retention"])
})

// ── FINAL-WF4 EN9: 영어 법정 초안 ─────────────────────────────────────────────────────────────────────────────
// 근거(영어 골든 감사): 빈 사실이 문장 가운데 "To be confirmed" 로 끼어 깨진 문장 · 사실 없는 숫자("14-day refund … of purchase") · 사업과 무관한 일반 철회 문장("download or stream").
const BROKEN = /\b(?:by|from|is|are|on) To be confirmed\b|To be confirmed\.\s+[A-Z]/
test("EN9 en 빈 사실: 조항 전체가 「To be confirmed: <무엇>」 한 줄이다 — 문장 가운데 끼지 않는다", () => {
  const bare = { business: { name: "Example Cloud", address: "1 Example St", email: PLACEHOLDER.en } }
  const d = draftLegalPages(bare, enSaasArch, "en")
  // 문장이 깨지던 조항들: 결제 공급자·준거법·시행일·수집 항목·철회 방법(메일)
  for (const [page, id, what] of [["terms", "terms.law", "governing law"], ["privacy", "privacy.effective", "effective date"], ["privacy", "privacy.data", "data collected and why"], ["withdrawal", "withdrawal.how", "contact email"]]) {
    const c = enText(d, page, id)
    assert.ok(c.missing?.length, `${id} 는 빈 사실이 있어야 한다`)
    assert.equal(c.text, `To be confirmed: ${what}.`, id)
  }
  // 모든 쪽 어디에도 깨진 문장(「… by To be confirmed.」)이 없다
  for (const page of enPages) assert.doesNotMatch(d[page].markdown, BROKEN, page)
  // 음성 대조: 검사식은 옛 깨진 문장을 잡는다
  assert.match("These terms are governed by To be confirmed. Consumers keep the protection", BROKEN)
  assert.match("Payments are processed by To be confirmed. Prices are shown", BROKEN)
  // 양성 대조: 사실이 다 있는 조항은 그대로 문장이다
  const full = draftLegalPages(enSaas, enSaasArch, "en")
  assert.match(enText(full, "terms", "terms.law").text, /^These terms are governed by the laws of Ireland\./)
  assert.equal(enText(full, "terms", "terms.law").missing, undefined)
  // 한국어는 예전 그대로(문장 가운데 「확인 필요」)
  const ko = draftLegalPages({ business: { name: "달빛", address: "서울", email: PLACEHOLDER.ko } }, { id: "saas", legal: { pages: ["privacy"], laws: { ko: [], en: [] } } }, "ko")
  assert.match(ko.privacy.clauses.find((c) => c.id === "privacy.controller").text, /확인 필요/)
})

test("EN9 en 서비스 초안: 지어낸 숫자·사업 무관 문장이 없다 — 14일은 지침 제9·13조 인용 문장에만, 전액 환불 약속은 없다", () => {
  const d = draftLegalPages(enSaas, enSaasArch, "en")
  const all = enPages.map((pg) => d[pg].markdown).join("\n")
  assert.doesNotMatch(all, /full refund|14 days of purchase|within 14 days to the original payment|download or stream|Digital content you started/)
  // 14일이 나오는 조항은 모두 근거 조문(Art. 9 또는 Art. 13)을 needs 에 달고 문장에 지침 조문을 인용한다
  for (const pg of ["refund", "withdrawal"]) {
    for (const c of d[pg].clauses.filter((x) => /\b14 days\b/.test(x.text))) {
      assert.ok(c.needs.some((n) => n.law.startsWith("Consumer Rights Directive") && (n.article === "Art. 9" || n.article === "Art. 13")), `${c.id}: 14일 조항에 근거 조문이 없다`)
    }
  }
  // 사업자가 더 길게 정한 철회 기간(콘텐츠)은 그대로 쓰고, 지침의 14일보다 짧게는 쓰지 않는다
  const long = { ...enSaas, product: { returns: { withdrawalDays: 30 } } }
  assert.match(enText(draftLegalPages(long, enSaasArch, "en"), "refund", "refund.window").text, /within 30 days from the day the contract is concluded/)
  // 철회 정책: full / limited 는 법정 문장(제14조③·제16조(a)), 정하지 않았으면 빈 사실
  const ex = (policy) => enText(draftLegalPages({ ...enSaas, legal: { ...enSaas.legal, withdrawalPolicy: policy } }, enSaasArch, "en"), "withdrawal", "withdrawal.exceptions")
  assert.match(ex("full").text, /^None of the legal exceptions to the right of withdrawal applies to the services/)
  assert.match(ex("limited").text, /Article 16\(a\)/)
  assert.ok(ex("limited").needs.some((n) => n.article === "Art. 16"))
  assert.deepEqual(ex(undefined).missing, ["legal.withdrawalPolicy"])
})
