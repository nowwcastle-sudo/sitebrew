// 국가법령정보센터 Open API 클라이언트(J13). 정본 사용법: docs/inputs/law-api.md (2026-09-29 실측).
// 검색 → 현행 MST → 조문. MST 는 개정마다 바뀌므로 캐시하지 않고 부를 때마다 검색한다.
// 키(LAW_API_OC)는 readSecret 으로 주입받고(프로세스 환경; Windows 사용자 환경 대체 읽기는 FACTORY_USER_ENV=1 일 때만), 오류 메시지에서는 *** 로 가린다.
//
// CLI(법률 에이전트용, factory/legal/AGENT.md):
//   node factory/legal/law-api.mjs current "<법령명>"
//   node factory/legal/law-api.mjs article "<법령명>" "<제N조[의M]>"   → review.json basis 한 칸 + 조문 본문
//   node factory/legal/law-api.mjs decree "<법률명>" "<제N조[의M]>"    → 그 법률의 시행령(대통령령) 조문. article 에 "<법률명> 시행령" 을 직접 줘도 같다.
// 시행령은 같은 API(target=law)의 별개 법령이다: 이름 "<법률명> 시행령", 법령구분명 「대통령령」, MST 도 따로다(법률 MST 로 시행령 조문을 찾지 않는다).
// 종료 코드: 0 = 결과 JSON(stdout), 1 = 도구 실패(stderr `도구 실패:`), 2 = 인자 오류.

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const BASE = "https://www.law.go.kr/DRF"
export const KEY_NAME = "LAW_API_OC"
export const RETRY_DELAYS_MS = [5000, 20000]
const TIMEOUT_MS = 10000
export const NO_KEY_MESSAGE = `도구 실패: ${KEY_NAME} 없음 — open.law.go.kr에서 발급해 환경 변수 ${KEY_NAME}로 넣는다`

export class LawApiError extends Error {
  /** @param {"no-key"|"http"|"empty"|"shape"|"not-current"|"no-article"} code */
  constructor(code, message) {
    super(message)
    this.name = "LawApiError"
    this.code = code
  }
}

/** 키 가리기 — 값 자체와 `OC=` 인자를 모두 *** 로. Task 2 `maskSecrets` 가 합류하면 그것으로 바꿔도 된다. */
export function mask(text, key) {
  let s = String(text)
  if (key) s = s.split(key).join("***")
  return s.replace(/([?&]OC=)[^&\s"']*/g, "$1***")
}

/** 조 번호 → JO 6자리(조 4자리 + 가지 조 2자리). "제22조의2" | "22의2" | "22-2" | "002202" → "002202" */
export function toJo(article) {
  const s = String(article).replace(/\s+/g, "")
  if (/^\d{6}$/.test(s)) return s
  const m = s.match(/^제?(\d{1,4})(?:조)?(?:(?:의|-)(\d{1,2}))?(?:조)?$/)
  if (!m) throw new LawApiError("no-article", `조 번호를 읽지 못함: ${article} (예: 제22조, 제22조의2)`)
  return m[1].padStart(4, "0") + (m[2] ?? "0").padStart(2, "0")
}

/** JO 6자리 → 사람이 읽는 조 번호. "002202" → "제22조의2" */
export function joLabel(jo) {
  const n = Number(jo.slice(0, 4))
  const b = Number(jo.slice(4))
  return `제${n}조${b ? `의${b}` : ""}`
}

/** 법률명 → 그 시행령 이름. "개인정보 보호법" → "개인정보 보호법 시행령"(이미 시행령이면 그대로) */
export const decreeName = (lawName) => {
  const n = String(lawName).trim()
  return /시행령$/.test(n) ? n : `${n} 시행령`
}

/** review.json basis[].url 형식(사람용 인용 주소) */
export const citationUrl = (mst) => `https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=${mst}`

const norm = (s) => String(s ?? "").replace(/\s+/g, "")
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {{ readSecret: (name: string) => string | null, fetch: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => Date }} deps
 */
export function lawApi(deps) {
  const { readSecret, fetch: doFetch } = deps ?? {}
  if (typeof readSecret !== "function" || typeof doFetch !== "function") {
    throw new TypeError("lawApi: readSecret 과 fetch 는 필수 주입값이다")
  }
  const sleep = deps.sleep ?? defaultSleep
  const now = deps.now ?? (() => new Date())

  function key() {
    const k = readSecret(KEY_NAME)
    if (!k) throw new LawApiError("no-key", NO_KEY_MESSAGE)
    return k.trim()
  }

  /** 한 번 요청. 재시도할 실패(http·empty·timeout)는 retryable=true 로 던진다. */
  async function once(url, k, check) {
    let res
    try {
      res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (e) {
      throw Object.assign(new LawApiError("http", `요청 실패(${e?.name ?? "Error"}: ${e?.message ?? e})`), { retryable: true })
    }
    if (!res.ok) throw Object.assign(new LawApiError("http", `HTTP ${res.status}`), { retryable: true })
    let body
    try {
      body = await res.json()
    } catch {
      throw new LawApiError("shape", "응답이 JSON 이 아니다(키 검증 실패 안내 페이지일 수 있다)")
    }
    return check(body)
  }

  async function request(url, check) {
    const k = key()
    let last
    for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
      try {
        return await once(url, k, check)
      } catch (e) {
        last = e
        if (!e.retryable || i === RETRY_DELAYS_MS.length) break
        await sleep(RETRY_DELAYS_MS[i])
      }
    }
    const tries = last.retryable ? `, ${RETRY_DELAYS_MS.length + 1}회 시도` : ""
    throw new LawApiError(last.code ?? "http", mask(`도구 실패: 법령 API ${last.message}${tries} — ${url}`, k))
  }

  const withKey = (path, params) => {
    const q = new URLSearchParams({ OC: key(), target: "law", type: "JSON", ...params })
    return `${BASE}/${path}?${q}`
  }

  /** 법령명 → 현행본 { mst, lawId, effectiveDate, name } */
  async function current(lawName) {
    const url = withKey("lawSearch.do", { query: lawName })
    const laws = await request(url, (body) => {
      const s = body?.LawSearch
      if (!s || typeof s !== "object") throw new LawApiError("shape", "응답 모양이 바뀜: 최상위 LawSearch 없음")
      const items = list(s.law)
      if (Number(s.totalCnt ?? items.length) < 1 || items.length === 0) {
        throw Object.assign(new LawApiError("empty", `검색 결과 없음: ${lawName}`), { retryable: true })
      }
      for (const it of items) {
        if (!it?.["법령명한글"] || !it?.["법령일련번호"]) throw new LawApiError("shape", "응답 모양이 바뀜: 법령명한글·법령일련번호 없음")
      }
      return items
    })
    // 시행령을 찾을 때는 법령구분명이 「대통령령」인 항목만 받는다(같은 이름의 다른 종류로 대신하지 않는다).
    const wantKind = /시행령$/.test(norm(lawName)) ? "대통령령" : null
    const same = laws.filter((l) => norm(l["법령명한글"]) === norm(lawName) && (!wantKind || norm(l["법령구분명"]) === wantKind))
    const cur = same.find((l) => (l["현행연혁코드"] ?? "현행") === "현행")
    if (!cur) {
      throw new LawApiError(
        "not-current",
        same.length
          ? `도구 실패: 「${lawName}」 현행본 없음(폐지·명칭 변경 가능) — 옛 MST 로 대신하지 않는다`
          : `도구 실패: 「${lawName}」과 이름이 같은 법령 없음(명칭 변경 가능) — 검색 결과: ${laws.map((l) => l["법령명한글"]).join(", ")}`,
      )
    }
    return { mst: String(cur["법령일련번호"]), lawId: String(cur["법령ID"] ?? ""), effectiveDate: String(cur["시행일자"] ?? ""), name: cur["법령명한글"] }
  }

  /** MST + 조 번호 → { number, title, text } */
  async function article(mst, jo) {
    const code = toJo(jo)
    const url = withKey("lawService.do", { MST: String(mst), JO: code })
    return request(url, (body) => {
      const law = body?.["법령"]
      if (!law || typeof law !== "object") throw new LawApiError("shape", "응답 모양이 바뀜: 최상위 법령 없음")
      const units = list(law["조문"]?.["조문단위"])
      if (units.length === 0) throw Object.assign(new LawApiError("empty", `조문 없음: MST ${mst} JO ${code}`), { retryable: true })
      const want = [String(Number(code.slice(0, 4))), String(Number(code.slice(4)))]
      const unit = units.find(
        (u) => (u["조문여부"] ?? "조문") === "조문" && String(u["조문번호"]) === want[0] && String(Number(u["조문가지번호"] ?? 0)) === want[1],
      )
      if (!unit) throw new LawApiError("no-article", `MST ${mst} 에 ${joLabel(code)} 없음`)
      if (typeof unit["조문내용"] !== "string") throw new LawApiError("shape", "응답 모양이 바뀜: 조문내용 없음")
      const lines = [unit["조문내용"]]
      for (const h of list(unit["항"])) {
        if (h?.["항내용"]) lines.push(h["항내용"])
        for (const ho of list(h?.["호"])) {
          if (ho?.["호내용"]) lines.push(ho["호내용"])
          for (const mok of list(ho?.["목"])) if (mok?.["목내용"]) lines.push(mok["목내용"])
        }
      }
      return { number: joLabel(code), title: String(unit["조문제목"] ?? ""), text: lines.map((l) => String(l).trim()).join("\n") }
    })
  }

  /** 법령명 + 조 번호 → review.json basis 한 칸(+ 조문 본문). 매번 현행 MST 를 새로 찾는다. */
  async function basis(lawName, jo) {
    const cur = await current(lawName)
    const art = await article(cur.mst, jo)
    return {
      basis: { law: cur.name, article: art.number, url: citationUrl(cur.mst), mst: cur.mst, effectiveDate: cur.effectiveDate, fetchedAt: now().toISOString() },
      title: art.title,
      text: art.text,
    }
  }

  return { current, article, basis }
}

async function main(argv) {
  const [cmd, ...rest] = argv
  if (!["current", "article", "decree"].includes(cmd) || (cmd === "current" && rest.length !== 1) || (cmd !== "current" && rest.length !== 2)) {
    console.error('인자 오류: law-api.mjs current "<법령명>" | article "<법령명>" "<제N조[의M]>" | decree "<법률명>" "<제N조[의M]>"')
    return 2
  }
  let readSecret
  try {
    ;({ readSecret } = await import("../lib/secret-env.mjs"))
  } catch {
    console.error("도구 실패: factory/lib/secret-env.mjs 없음(P3-3 Task 2) — 키 읽기 모듈이 있어야 CLI 가 돈다")
    return 1
  }
  const api = lawApi({ readSecret, fetch: globalThis.fetch })
  try {
    const out = cmd === "current" ? await api.current(rest[0]) : await api.basis(cmd === "decree" ? decreeName(rest[0]) : rest[0], rest[1])
    console.log(JSON.stringify(out, null, 2))
    return 0
  } catch (e) {
    const msg = e instanceof LawApiError ? e.message : `도구 실패: ${e?.message ?? e}`
    console.error(msg.startsWith("도구 실패:") ? msg : `도구 실패: ${msg}`)
    return 1
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  process.exitCode = await main(process.argv.slice(2))
}
