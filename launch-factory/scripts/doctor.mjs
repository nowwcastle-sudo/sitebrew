#!/usr/bin/env node
// 실행 전 점검(v0 Task 11, web-factory J14 와 같은 규칙). 이름만 보지 않고 키마다 **가장 가벼운 읽기 전용 호출 1회**로 지금 동작하는지 본다.
//   node scripts/doctor.mjs --stage dev|sandbox|preview [--only id,id] [--json] [--repo owner/repo] [--no-user-env]
//
// 규칙(J14): 값은 출력하지 않는다(있는지·길이만). 키는 프로세스 환경 → Windows 사용자 환경 순으로 읽는다. 빠지면 종료 1 +
//   「무엇을·어디서 발급해·어느 이름으로 넣나」 한 줄(+ 운영자 할 일 행 번호 O#). 한 번에 빠진 것을 모두 알린다.
// 종료 코드: 0 = 실패 없음(경고·건너뜀은 있을 수 있다) · 1 = 실패가 하나라도 있음 · 2 = 사용법 오류.
//
// 단계
//   dev      키가 없어도 mock 으로 켜진다 → 없는 키는 건너뜀. 넣어 둔 키는 부르되 실패는 경고(mock 에서는 앱이 쓰지 않는다). LF_MODE=live 면 sandbox 와 같다.
//   sandbox  이 기계에서 공급자 **샌드박스**를 부른다. 모든 키 필수. 실결제 키(pdl_live_…)·LF_PADDLE_LIVE=1 은 실패 — 실결제는 대표 몫(Global Constraints).
//   preview  Vercel 미리보기 배포 직전. sandbox + CRON_SECRET + 마지막 백업 26시간 이내(D152).
//   소셜 로그인 키(선택, sandbox·preview): 공급자마다 ID·비밀이 둘 다 있으면 통과, 하나만 있으면 경고(앱이 그 공급자를 켜지 않는다), 없으면 건너뜀. 호출 없음·길이만.
//
// 각 호출의 1차 출처는 docs/qa/task-11-report.md 「공식 문서 근거」 표.
import { readFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { SOCIAL_PROVIDERS, socialEnvNames, socialsFromEnv } from "../packages/auth/src/socials.ts"
import { maskSecrets, missingRequiredBusinessInfo, PLAIN_NAMES, readSecrets, SECRET_NAMES, windowsUserEnv } from "../packages/env/src/index.ts"
import { lastBackupCheck } from "../packages/db/src/backup.ts"
import { resolvePostHog } from "../packages/analytics-posthog/src/region.ts"

export const STAGES = ["dev", "sandbox", "preview"]
/** 법정 쪽 본문 자리(템플릿 content/legal) — 시험은 runDoctor({ legalDir })로 바꾼다 */
export const LEGAL_DIR = fileURLToPath(new URL("../template/content/legal/", import.meta.url))
export const LEGAL_SLUGS = ["terms", "privacy", "refund"]
export const PADDLE_SANDBOX_API = "https://sandbox-api.paddle.com"
export const RESEND_API = "https://api.resend.com"
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
export const GUMROAD_API = "https://api.gumroad.com/v2"
export const DEFAULT_REPO = "nowwcastle-sudo/sitebrew"

/** 이름 목록은 @launch-factory/env 가 한 원천이다(대장 D193) — 값을 출력·로그에 절대 싣지 않는 이름(SECRET_NAMES)과 비밀은 아니지만 읽어야 하는 이름(PLAIN_NAMES) */
export { PLAIN_NAMES, SECRET_NAMES }
const ALL_NAMES = [...SECRET_NAMES, ...PLAIN_NAMES]

/** 발급 안내(J14: 무엇을·어디서 발급해·어느 이름으로) — owner 는 web-factory docs/owner-actions.md 행 번호 */
const GUIDE = {
  database: { owner: "O2", what: "Supabase 서울(ap-northeast-2) 프로젝트의 트랜잭션 풀러(포트 6543) 연결 문자열", name: "DATABASE_URL" },
  authSecret: { owner: null, what: "32자 이상 무작위 값(대표 몫 아님 — 만들어 사용자 환경 변수로 넣는다)", name: "BETTER_AUTH_SECRET · SUBJECT_REF_KEY" },
  paddle: { owner: "O3", what: "Paddle 샌드박스 대시보드 → Developer tools → Authentication 의 API 키(권한 product.read 포함)", name: "PADDLE_API_KEY" },
  paddleWebhook: { owner: "O3", what: "Paddle 샌드박스 → Developer tools → Notifications 알림 대상의 비밀 키(pdl_ntfset_…)", name: "PADDLE_WEBHOOK_SECRET" },
  paddleClient: { owner: "O3", what: "Paddle 샌드박스 클라이언트 토큰(test_…)", name: "PADDLE_CLIENT_TOKEN" },
  resend: { owner: "O4", what: "Resend 대시보드의 API 키 + DNS 로 인증한 발신 도메인, 발신 주소는 그 도메인이어야 한다", name: "RESEND_API_KEY · EMAIL_FROM" },
  posthog: { owner: "O5", what: "PostHog 프로젝트 키·호스트(지역 US/EU) + 개인 API 키(scope person:write + project:read)·프로젝트 숫자 id", name: "POSTHOG_PROJECT_KEY · POSTHOG_HOST · POSTHOG_PERSONAL_API_KEY · POSTHOG_PROJECT_ID" },
  sentry: { owner: "O6", what: "Sentry 프로젝트의 DSN", name: "SENTRY_DSN" },
  turnstile: { owner: "O7", what: "Cloudflare Turnstile 사이트의 비밀 키·사이트 키", name: "TURNSTILE_SECRET_KEY · TURNSTILE_SITE_KEY" },
  social: { owner: "O8", what: "공급자 콘솔에서 만든 OAuth 클라이언트의 ID·비밀(Google: Cloud Console → APIs & Services → Credentials → Web application, 승인된 리디렉션 URI 에 https://<도메인>/api/auth/callback/google)", name: "<GOOGLE|KAKAO|NAVER>_CLIENT_ID · <GOOGLE|KAKAO|NAVER>_CLIENT_SECRET" },
  gumroad: { owner: "O29", what: "Gumroad 액세스 토큰 + Ping 비밀(Paddle 미승인 대비일 때만)", name: "GUMROAD_ACCESS_TOKEN · GUMROAD_PING_SECRET" },
  cron: { owner: null, what: "16자 이상 무작위 값(대표 몫 아님 — Vercel 크론 호출 확인용)", name: "CRON_SECRET" },
  backup: { owner: "O28", what: "GitHub 토큰(actions 읽기)과 backup.yml 의 비밀(세션 풀러 5432 DATABASE_URL·BACKUP_PASSPHRASE)", name: "GITHUB_TOKEN 또는 GH_TOKEN" },
}

const ownerTag = (g) => (g.owner ? ` · 운영자 할 일 ${g.owner}` : "")
const missingLine = (names, g) => `없음 ${names.join(", ")} — 발급: ${g.what} · 넣을 이름: ${g.name}${ownerTag(g)}`

/** 검사 하나가 돌려주는 모양 */
const R = {
  pass: (detail) => ({ status: "pass", detail }),
  warn: (detail) => ({ status: "warn", detail }),
  fail: (detail) => ({ status: "fail", detail }),
  skip: (detail) => ({ status: "skip", detail }),
}

/** 이름 목록 중 값이 없는 것 */
const missingOf = (ctx, names) => names.filter((n) => !ctx.has(n))
const len = (ctx, name) => `길이 ${ctx.get(name).length}`

async function httpCall(ctx, url, init = {}) {
  try {
    const res = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(ctx.timeoutMs) })
    const text = await res.text().catch(() => "")
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { res, json }
  } catch (e) {
    // 원인 문구에 URL·값이 섞일 수 있어 이름만 싣는다
    return { error: e instanceof Error ? e.name : "error" }
  }
}

const bearer = (token) => ({ authorization: `Bearer ${token}`, accept: "application/json" })

/**
 * 검사 목록. stages: 그 단계에서 돌리는가. `required(ctx)`: 값이 없을 때 실패인가(아니면 건너뜀).
 * run(ctx) 은 R.* 하나를 돌려준다. 던지지 않는다(밖에서 잡아 실패로 바꾼다).
 */
export const CHECKS = [
  {
    id: "mode",
    title: "LF_MODE",
    stages: STAGES,
    run(ctx) {
      const v = ctx.env.LF_MODE
      if (v !== undefined && v !== "mock" && v !== "live") return R.fail(`LF_MODE 는 mock 또는 live 여야 한다(지금 길이 ${v.length}) — .env.example`)
      if (ctx.stage === "dev") {
        if (v === undefined) return R.warn("미설정 — dev 단계는 mock 으로 본다. 앱은 LF_MODE 없이는 켜지지 않는다(조용히 mock 으로 가지 않는다): .env.example 의 LF_MODE=mock 을 넣는다")
        return R.pass(`${v} — ${v === "mock" ? "키 없이 목 어댑터로 켜진다" : "live 라서 sandbox 와 같은 요구를 한다"}`)
      }
      if (v !== "live") return R.fail(`${ctx.stage} 단계는 LF_MODE=live 여야 한다(지금 ${v ?? "미설정"}) — mock 으로는 공급자 연결을 점검할 수 없다`)
      return R.pass("live")
    },
  },
  {
    id: "secrets-local",
    title: "BETTER_AUTH_SECRET · SUBJECT_REF_KEY",
    stages: STAGES,
    guide: GUIDE.authSecret,
    needs: ["BETTER_AUTH_SECRET", "SUBJECT_REF_KEY"],
    run(ctx) {
      const bad = []
      for (const n of ["BETTER_AUTH_SECRET", "SUBJECT_REF_KEY"]) if (ctx.has(n) && ctx.get(n).length < 32) bad.push(`${n} ${len(ctx, n)}(32 미만)`)
      if (bad.length) return R.fail(`너무 짧다: ${bad.join(", ")}`)
      if (ctx.has("BETTER_AUTH_SECRET") && ctx.has("SUBJECT_REF_KEY") && ctx.get("BETTER_AUTH_SECRET") === ctx.get("SUBJECT_REF_KEY")) return R.fail("두 값이 같다 — SUBJECT_REF_KEY 는 BETTER_AUTH_SECRET 과 따로 둔다(바꾸면 옛 기록을 이메일로 못 찾는다)")
      return R.pass(`${ctx.has("BETTER_AUTH_SECRET") ? len(ctx, "BETTER_AUTH_SECRET") : "BETTER_AUTH_SECRET 없음"} · ${ctx.has("SUBJECT_REF_KEY") ? len(ctx, "SUBJECT_REF_KEY") : "SUBJECT_REF_KEY 없음"} — 호출 없음(로컬 값)`)
    },
  },
  {
    id: "database",
    title: "Supabase 연결(DATABASE_URL)",
    stages: STAGES,
    guide: GUIDE.database,
    needs: ["DATABASE_URL"],
    async run(ctx) {
      let url
      try {
        url = new URL(ctx.get("DATABASE_URL"))
        if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error("scheme")
      } catch {
        return R.fail("DATABASE_URL 형식이 postgres://사용자:비밀번호@호스트:포트/DB 가 아니다")
      }
      const port = url.port || "5432"
      const pooler = url.hostname.endsWith(".pooler.supabase.com")
      let note = ""
      if (pooler && port !== "6543") note = " — 앱은 트랜잭션 풀러(6543)를 쓴다. 5432 는 백업용(O28)이다"
      else if (url.hostname.endsWith(".supabase.co")) note = " — 직접 연결(db.<ref>.supabase.co)은 IPv6 라 풀러를 권한다(6543)"
      let handle
      let timer
      try {
        handle = await ctx.connectDb(ctx.get("DATABASE_URL"))
        const timeout = new Promise((_, rej) => {
          timer = setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), ctx.timeoutMs)
        })
        await Promise.race([handle.ping(), timeout])
      } catch (e) {
        // postgres-js 오류 문구에 호스트가 들어갈 수 있다 — 코드만
        const code = e && typeof e === "object" && "code" in e ? String(e.code) : e instanceof Error ? e.name : "error"
        return R.fail(`select 1 실패(코드 ${code}, 포트 ${port}) — 연결 문자열·비밀번호·풀러 주소를 확인한다`)
      } finally {
        clearTimeout(timer)
        await Promise.resolve(handle?.close()).catch(() => {})
      }
      const r = R.pass(`select 1 통과 · 포트 ${port}${pooler ? " · Supabase 풀러" : ""}`)
      return note ? R.warn(`${r.detail}${note}`) : r
    },
  },
  {
    id: "paddle",
    title: "Paddle 상품 목록(PADDLE_API_KEY)",
    stages: STAGES,
    guide: GUIDE.paddle,
    needs: ["PADDLE_API_KEY"],
    async run(ctx) {
      const key = ctx.get("PADDLE_API_KEY")
      if (key.startsWith("pdl_live_")) return R.fail("실결제 키(pdl_live_…)다 — 샌드박스 단계에서는 쓰지 않는다. 샌드박스 키(pdl_sdbx_…)를 넣는다")
      const shape = /^pdl_sdbx_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/.test(key) ? "샌드박스 키 형식" : /^[a-z\d]{50}$/.test(key) ? "옛 형식 키(2025-05-06 이전)" : "알 수 없는 키 형식"
      const { res, json, error } = await httpCall(ctx, `${PADDLE_SANDBOX_API}/products?per_page=1`, { headers: bearer(key) })
      if (error) return R.fail(`GET /products 네트워크 오류(${error})`)
      if (res.status === 401) return R.fail(`GET /products 401 — 키가 거부됐다(${shape}, ${len(ctx, "PADDLE_API_KEY")}). 샌드박스 대시보드에서 새로 발급하거나 만료(기본 90일)를 확인한다`)
      if (res.status === 403) return R.fail("GET /products 403 — 키에 product.read 권한이 없다. Authentication 에서 권한을 더한다")
      if (!res.ok) return R.fail(`GET /products 응답 ${res.status}`)
      const n = Array.isArray(json?.data) ? json.data.length : null
      if (n === null) return R.fail("GET /products 응답 모양이 다르다(data 배열 없음)")
      const detail = `샌드박스 GET /products 200 · ${shape} · ${len(ctx, "PADDLE_API_KEY")} · 상품 ${n === 0 ? "0개" : "1개 이상"}`
      return n === 0 ? R.warn(`${detail} — 대시보드에서 상품·가격을 만들어야 흐름을 돌 수 있다(Task 12)`) : R.pass(detail)
    },
  },
  {
    id: "paddle-webhook",
    title: "Paddle 웹훅 비밀(PADDLE_WEBHOOK_SECRET)",
    stages: STAGES,
    guide: GUIDE.paddleWebhook,
    needs: ["PADDLE_WEBHOOK_SECRET", "PADDLE_API_KEY"],
    // LFFIX F10: 형식(pdl_ntfset_…)만 보면 자리표시자도 통과한다. 샌드박스의 알림 대상을 읽어(읽기 전용 GET) 이 비밀과 같은 비밀을 가진 대상이 실제로 있는지 본다.
    // Paddle 문서(2026-10-03): GET /notification-settings(목록)·GET /notification-settings/{id}(한 건 — endpoint_secret_key 를 돌려준다). 비밀 값은 출력하지 않고 개수만 쓴다.
    async run(ctx) {
      const v = ctx.get("PADDLE_WEBHOOK_SECRET")
      const name = len(ctx, "PADDLE_WEBHOOK_SECRET")
      if (!v.startsWith("pdl_ntfset_")) return R.fail(`형식이 pdl_ntfset_… 이 아니다(${name}) — 알림 대상의 비밀 키가 맞는지 확인한다`)
      if (v.includes("local_placeholder")) return R.fail(`로컬 자리표시자다(${name}) — 진짜 알림 대상의 비밀이 아니라 서명을 하나도 검증하지 못한다. 알림 대상을 만들고 그 비밀을 넣는다`)
      const key = ctx.get("PADDLE_API_KEY")
      if (key.startsWith("pdl_live_")) return R.warn(`${name} · 형식만 확인(실결제 키라 알림 대상을 읽지 않았다)`)
      const headers = bearer(key)
      const list = await httpCall(ctx, `${PADDLE_SANDBOX_API}/notification-settings?per_page=20`, { headers })
      const formatOnly = (why) => R.warn(`${name} · 형식만 확인(${why}) — 알림 대상과 맞는지는 보지 못했다`)
      if (list.error) return formatOnly("GET /notification-settings 네트워크 오류")
      if (list.res.status === 401 || list.res.status === 403) return formatOnly(`GET /notification-settings ${list.res.status} — 키에 notification_setting.read 권한이 없을 수 있다`)
      if (!list.res.ok || !Array.isArray(list.json?.data)) return formatOnly(`GET /notification-settings 응답 ${list.res.status}`)
      const active = list.json.data.filter((d) => d && d.active !== false)
      if (active.length === 0) return R.fail("샌드박스에 쓸 수 있는 알림 대상이 하나도 없다 — Paddle 샌드박스에서 알림 대상을 만들고 그 비밀 키를 넣는다(운영자 할 일 O3)")
      let matched = false
      for (const d of active.slice(0, 10)) {
        let secret = d.endpoint_secret_key
        if (typeof secret !== "string") {
          const one = await httpCall(ctx, `${PADDLE_SANDBOX_API}/notification-settings/${encodeURIComponent(String(d.id))}`, { headers })
          if (one.error || !one.res.ok) continue
          secret = one.json?.data?.endpoint_secret_key
        }
        if (secret === v) {
          matched = true
          break
        }
      }
      return matched ? R.pass(`${name} · 샌드박스 알림 대상 ${active.length}개 중 이 비밀을 가진 대상이 있다(읽기 전용 GET)`) : R.fail(`${name} · 샌드박스 알림 대상 ${active.length}개 어느 것의 비밀과도 다르다 — 알림 대상의 비밀 키를 다시 복사한다`)
    },
  },
  {
    id: "paddle-client-token",
    title: "Paddle 클라이언트 토큰(PADDLE_CLIENT_TOKEN)",
    stages: STAGES,
    guide: GUIDE.paddleClient,
    needs: ["PADDLE_CLIENT_TOKEN"],
    run(ctx) {
      const v = ctx.get("PADDLE_CLIENT_TOKEN")
      if (v.startsWith("live_")) return R.fail("실결제 토큰(live_…)이다 — 샌드박스 단계에서는 test_… 를 쓴다")
      if (!/^test_[a-zA-Z0-9]{27}$/.test(v)) return R.fail(`형식이 test_ + 27자가 아니다(${len(ctx, "PADDLE_CLIENT_TOKEN")})`)
      return R.pass(`샌드박스 토큰 형식 · ${len(ctx, "PADDLE_CLIENT_TOKEN")}`)
    },
  },
  {
    id: "paddle-live-guard",
    title: "LF_PADDLE_LIVE(실결제 스위치)",
    stages: STAGES,
    run(ctx) {
      if (ctx.env.LF_PADDLE_LIVE === undefined) return R.pass("꺼져 있다(실결제는 대표만 켠다)")
      if (ctx.stage === "dev") return R.warn("켜져 있다 — 실결제 스위치는 대표 몫이다")
      return R.fail("켜져 있다 — sandbox·preview 단계에서는 꺼야 한다(실결제는 운영자가 켠다)")
    },
  },
  {
    id: "resend",
    title: "Resend 도메인(RESEND_API_KEY · EMAIL_FROM)",
    stages: STAGES,
    guide: GUIDE.resend,
    needs: ["RESEND_API_KEY", "EMAIL_FROM"],
    async run(ctx) {
      const key = ctx.get("RESEND_API_KEY")
      if (!key.startsWith("re_")) return R.fail(`키 형식이 re_… 가 아니다(${len(ctx, "RESEND_API_KEY")})`)
      const from = ctx.get("EMAIL_FROM")
      const addr = /<([^>]+)>/.exec(from)?.[1] ?? from
      const domain = addr.includes("@") ? addr.split("@").pop().trim().toLowerCase() : ""
      if (!domain || !domain.includes(".")) return R.fail('EMAIL_FROM 이 "이름 <주소@도메인>" 도 주소@도메인 도 아니다')
      const { res, json, error } = await httpCall(ctx, `${RESEND_API}/domains?limit=100`, { headers: bearer(key) })
      if (error) return R.fail(`GET /domains 네트워크 오류(${error})`)
      if (res.status === 401 && json?.name === "restricted_api_key") {
        // 발송 전용 키(최소 권한)는 도메인 조회가 안 된다 — 키가 죽은 것이 아니라 확인 범위 밖이다
        return R.warn(`GET /domains 401 restricted_api_key — 발송 전용 키라 도메인 인증 상태는 못 본다(${len(ctx, "RESEND_API_KEY")}). 발신 도메인 ${domain} 의 인증은 Resend 대시보드에서 확인한다(확인 안 됨)`)
      }
      if (res.status === 401 || res.status === 403) return R.fail(`GET /domains ${res.status}${json?.name ? ` ${json.name}` : ""} — 키가 거부됐거나 꺼져 있다(${len(ctx, "RESEND_API_KEY")})`)
      if (!res.ok) return R.fail(`GET /domains 응답 ${res.status}`)
      if (!Array.isArray(json?.data)) return R.fail("GET /domains 응답 모양이 다르다(data 배열 없음)")
      const hit = json.data.find((d) => typeof d?.name === "string" && d.name.toLowerCase() === domain)
      if (!hit) return R.fail(`발신 도메인 ${domain} 이 이 계정에 없다(도메인 ${json.data.length}개) — Resend 에 도메인을 더하고 DNS 를 넣는다`)
      if (hit.status !== "verified") return R.fail(`발신 도메인 ${domain} 상태가 ${String(hit.status)} — DNS 인증을 마쳐야 한다`)
      return R.pass(`GET /domains 200 · 발신 도메인 ${domain} verified · ${len(ctx, "RESEND_API_KEY")}`)
    },
  },
  {
    id: "posthog",
    title: "PostHog 프로젝트(POSTHOG_PROJECT_KEY 외)",
    stages: STAGES,
    guide: GUIDE.posthog,
    needs: ["POSTHOG_PROJECT_KEY", "POSTHOG_HOST", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"],
    async run(ctx) {
      let info
      try {
        info = resolvePostHog({ host: ctx.get("POSTHOG_HOST") })
      } catch {
        return R.fail("POSTHOG_HOST 를 지역(US·EU)으로 풀지 못했다 — https://us.i.posthog.com 또는 https://eu.i.posthog.com 을 넣는다(프록시는 지역을 코드에서 따로 준다)")
      }
      if (!/^\d+$/.test(ctx.get("POSTHOG_PROJECT_ID"))) return R.fail("POSTHOG_PROJECT_ID 는 숫자 id 여야 한다")
      const parts = []
      // ① 프로젝트 키(공개 키) — /flags 는 이 키 하나로 부르는 공개 엔드포인트다
      const a = await httpCall(ctx, `${info.apiHost}/flags?v=2`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: ctx.get("POSTHOG_PROJECT_KEY"), distinct_id: "lf-doctor" }) })
      if (a.error) return R.fail(`POST /flags 네트워크 오류(${a.error})`)
      if (a.res.status === 401 || a.res.status === 403) return R.fail(`POST /flags ${a.res.status} — 프로젝트 키가 거부됐다(${len(ctx, "POSTHOG_PROJECT_KEY")}, 지역 ${info.region})`)
      if (!a.res.ok) return R.fail(`POST /flags 응답 ${a.res.status}`)
      parts.push(`POST /flags 200(${info.region})`)
      // ② 개인 API 키 — 프로젝트를 읽는다. 돌려준 프로젝트 토큰이 우리 프로젝트 키와 같은지도 본다(같은 값이면 통과, 값은 싣지 않는다)
      const b = await httpCall(ctx, `${info.uiHost}/api/projects/${ctx.get("POSTHOG_PROJECT_ID")}/`, { headers: bearer(ctx.get("POSTHOG_PERSONAL_API_KEY")) })
      if (b.error) return R.fail(`GET /api/projects/:id 네트워크 오류(${b.error})`)
      if (b.res.status === 401 || b.res.status === 403) return R.fail(`GET /api/projects/:id ${b.res.status} — 개인 API 키가 거부됐거나 project:read 범위가 없다(${len(ctx, "POSTHOG_PERSONAL_API_KEY")})`)
      if (b.res.status === 404) return R.fail("GET /api/projects/:id 404 — POSTHOG_PROJECT_ID 가 이 지역·계정에 없다")
      if (!b.res.ok) return R.fail(`GET /api/projects/:id 응답 ${b.res.status}`)
      parts.push("GET /api/projects/:id 200")
      const token = b.json?.api_token
      if (typeof token === "string") {
        if (token !== ctx.get("POSTHOG_PROJECT_KEY")) return R.fail("프로젝트 키가 POSTHOG_PROJECT_ID 프로젝트의 키가 아니다 — 다른 프로젝트의 키를 섞어 넣었다")
        parts.push("프로젝트 키 일치")
        return R.pass(parts.join(" · "))
      }
      return R.warn(`${parts.join(" · ")} · 응답에 api_token 이 없어 키와 프로젝트의 짝은 확인 못 했다(확인 안 됨)`)
    },
  },
  {
    id: "turnstile",
    title: "Cloudflare Turnstile(TURNSTILE_SECRET_KEY)",
    stages: STAGES,
    guide: GUIDE.turnstile,
    needs: ["TURNSTILE_SECRET_KEY", "TURNSTILE_SITE_KEY"],
    async run(ctx) {
      // 일부러 틀린 토큰을 보낸다. 비밀 키가 맞으면 응답 토큰만 틀렸다고(invalid-input-response), 비밀 키가 틀리면 비밀 키가 틀렸다고(invalid-input-secret) 한다.
      const body = new URLSearchParams({ secret: ctx.get("TURNSTILE_SECRET_KEY"), response: "lf-doctor-probe" })
      const { res, json, error } = await httpCall(ctx, SITEVERIFY_URL, { method: "POST", body })
      if (error) return R.fail(`siteverify 네트워크 오류(${error})`)
      if (!res.ok || !json || typeof json !== "object") return R.fail(`siteverify 응답 ${res.status}`)
      const codes = Array.isArray(json["error-codes"]) ? json["error-codes"].map(String) : []
      if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) return R.fail(`비밀 키가 거부됐다(${codes.join(", ")}, ${len(ctx, "TURNSTILE_SECRET_KEY")}) — 위젯 사이트의 비밀 키를 다시 복사한다`)
      const site = ctx.get("TURNSTILE_SITE_KEY")
      const testKey = /^[123]x0{10,}/.test(site) || /^[123]x0{10,}/.test(ctx.get("TURNSTILE_SECRET_KEY"))
      if (json.success === true && !testKey) return R.warn("시험 토큰이 통과했다 — 시험용 비밀 키가 아닌데 검증이 통과한다. 응답을 다시 확인한다(확인 안 됨)")
      if (!(json.success === true || codes.includes("invalid-input-response"))) return R.fail(`예상하지 못한 응답(${codes.join(", ") || "코드 없음"})`)
      const detail = `siteverify 응답 ${res.status} · 비밀 키 수락(${len(ctx, "TURNSTILE_SECRET_KEY")}) · 사이트 키 ${len(ctx, "TURNSTILE_SITE_KEY")}`
      return testKey ? R.warn(`${detail} · 시험 키다(항상 통과·항상 실패) — 실제 위젯 키로 바꾼다`) : R.pass(detail)
    },
  },
  {
    id: "sentry",
    title: "Sentry DSN(SENTRY_DSN)",
    stages: STAGES,
    guide: GUIDE.sentry,
    needs: ["SENTRY_DSN"],
    run(ctx) {
      let u
      try {
        u = new URL(ctx.get("SENTRY_DSN"))
      } catch {
        return R.fail("DSN 이 URL 이 아니다(https://공개키@호스트/프로젝트번호)")
      }
      if (u.protocol !== "https:" || !u.username || !/\/\d+$/.test(u.pathname)) return R.fail("DSN 모양이 https://공개키@호스트[/경로]/프로젝트번호 가 아니다")
      // Sentry 에는 DSN 이 살아 있는지 읽는 공개 엔드포인트가 없다(수집 전용) — 형식만 본다
      return R.warn(`DSN 형식 통과(${len(ctx, "SENTRY_DSN")}) — 호출 없음: DSN 은 수집 전용이라 읽기 확인 엔드포인트가 없다(실제 수신은 확인 안 됨, Task 12)`)
    },
  },
  {
    id: "social",
    title: "소셜 로그인 키(GOOGLE·KAKAO·NAVER _CLIENT_ID · _CLIENT_SECRET)",
    stages: ["sandbox", "preview"],
    guide: GUIDE.social,
    // 선택 조각: 공급자마다 ID·비밀이 둘 다 있으면 켜진다(앱과 같은 규칙 — packages/auth/src/socials.ts). 하나만 있으면 앱은 그 공급자를 켜지 않는다 → 경고. 하나도 없으면 건너뜀.
    // 공급자에는 부르지 않는다: 클라이언트 ID·비밀의 유효성을 읽기 전용으로 확인하는 공개 엔드포인트가 없다(실제 로그인은 운영자가 한 번 눌러 본다 — docs/qa/social-login.md).
    run(ctx) {
      const { enabled, partial } = socialsFromEnv(ctx.env)
      if (enabled.length === 0 && partial.length === 0) return R.skip("쓰지 않는다 — 소셜 키를 넣은 공급자가 없다(켜려면 " + GUIDE.social.name + ")")
      const on = enabled.map((p) => {
        const [id, secret] = socialEnvNames(p)
        return `${p}(${id} 길이 ${ctx.get(id).length} · ${secret} 길이 ${ctx.get(secret).length})`
      })
      const parts = []
      if (on.length) parts.push(`켜짐 ${on.join(", ")}`)
      const off = SOCIAL_PROVIDERS.filter((p) => !enabled.includes(p) && !partial.some((x) => x.provider === p))
      if (off.length) parts.push(`꺼짐 ${off.join(", ")}`)
      const warns = partial.map((x) => `${x.provider} 는 ${x.missing.join(", ")} 가 없어 앱이 켜지 않는다`)
      // Google 클라이언트 ID 는 <숫자>-<문자>.apps.googleusercontent.com 모양이다(Google Identity 문서). 다르면 다른 값을 넣은 것일 수 있다.
      if (enabled.includes("google") && !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(ctx.get("GOOGLE_CLIENT_ID"))) warns.push("GOOGLE_CLIENT_ID 모양이 <숫자>-<문자>.apps.googleusercontent.com 이 아니다")
      if (warns.length) return R.warn(`${parts.join(" · ")} — ${warns.join("; ")} · 발급: ${GUIDE.social.what} · 넣을 이름: ${GUIDE.social.name}${ownerTag(GUIDE.social)}`)
      return R.pass(parts.join(" · ") + " — 호출 없음(로컬 값). 콜백 주소 https://<도메인>/api/auth/callback/<공급자> 를 공급자 콘솔에 등록했는지는 확인 안 됨")
    },
  },
  {
    id: "gumroad",
    title: "Gumroad(GUMROAD_ACCESS_TOKEN)",
    stages: STAGES,
    guide: GUIDE.gumroad,
    optionalUnlessConfigured: ["GUMROAD_ACCESS_TOKEN", "GUMROAD_PING_SECRET"],
    async run(ctx) {
      // 둘 중 하나라도 넣었으면 Gumroad 를 쓰는 것이다 — 나머지가 없으면 실패
      const gone = missingOf(ctx, ["GUMROAD_ACCESS_TOKEN", "GUMROAD_PING_SECRET"])
      if (gone.length) return R.fail(missingLine(gone, GUIDE.gumroad))
      const { res, json, error } = await httpCall(ctx, `${GUMROAD_API}/products`, { headers: bearer(ctx.get("GUMROAD_ACCESS_TOKEN")) })
      if (error) return R.fail(`GET /products 네트워크 오류(${error})`)
      if (res.status === 401 || res.status === 403) return R.fail(`GET /products ${res.status} — 액세스 토큰이 거부됐다(${len(ctx, "GUMROAD_ACCESS_TOKEN")})`)
      if (!res.ok || json?.success !== true) return R.fail(`GET /products 응답 ${res.status}${json?.success === false ? " success:false" : ""}`)
      return R.pass(`GET /products 200 success · 토큰 ${len(ctx, "GUMROAD_ACCESS_TOKEN")} · Ping 비밀 ${len(ctx, "GUMROAD_PING_SECRET")}`)
    },
  },
  {
    id: "cron",
    title: "크론 비밀(CRON_SECRET)",
    stages: ["preview"],
    guide: GUIDE.cron,
    needs: ["CRON_SECRET"],
    run(ctx) {
      if (ctx.get("CRON_SECRET").length < 16) return R.fail(`너무 짧다(${len(ctx, "CRON_SECRET")}, 16 미만)`)
      return R.pass(`${len(ctx, "CRON_SECRET")} — 호출 없음(Vercel 크론이 부를 때 확인하는 값)`)
    },
  },
  {
    id: "business-info",
    title: "사업자 정보(LF_BUSINESS_*)",
    // 실제 서비스에 가까운 단계(sandbox·preview — 둘 다 LF_MODE=live)에서만 본다. dev 는 비워 두어도 된다. 경고만 한다(실패로 막지 않는다 — 값은 제품 설정이고 첫 매출 전에는 비어 있을 수 있다)
    stages: ["sandbox", "preview"],
    run(ctx) {
      const missing = missingRequiredBusinessInfo(ctx.env)
      if (missing.length === 0) return R.pass("표시 의무 칸이 모두 채워져 있다 — 값은 출력하지 않는다")
      return R.warn(`비어 있음 ${missing.join(", ")} — 전자상거래법 제10조 초기 화면 표시 의무(상호·대표자·주소·전화·이메일·사업자등록번호·호스팅 제공자). 값은 제품 설정(환경 변수)에서 읽고 빈 칸은 화면에서 숨긴다 — 공개·첫 매출 전에 채운다. 통신판매업 신고번호(LF_MAIL_ORDER_NO)는 신고 대상일 때만 넣는다(간이과세·직전 연도 50회 미만은 면제)`)
    },
  },
  {
    id: "legal-pages",
    title: "법정 쪽 승인(약관·개인정보·환불)",
    // 경고만 한다 — 초안을 미리보기에서 보는 것은 막지 않는다. 공개는 세 쪽이 모두 status "final"(운영자 승인)일 때만이다(final 인데 빈 자리가 있으면 쪽이 아예 그려지지 않는다)
    stages: ["sandbox", "preview"],
    run(ctx) {
      const states = LEGAL_SLUGS.map((slug) => {
        try {
          return [slug, JSON.parse(readFileSync(`${ctx.legalDir}/${slug}.json`, "utf8")).status]
        } catch {
          return [slug, "unreadable"]
        }
      })
      const pending = states.filter(([, st]) => st !== "final")
      if (pending.length === 0) return R.pass("세 쪽 모두 final(운영자 승인)")
      return R.warn(`공개 불가 — ${pending.map(([slug, st]) => `${slug}: ${st}`).join(", ")}. placeholder = 본문 없음, draft = 초안 검토를 마치고 운영자 승인을 기다림. 승인하면 해당 JSON 의 status 를 final 로 바꾸고, 자리표시(LF_BUSINESS_* · content/legal/variables.json)를 모두 채운다`)
    },
  },
  {
    id: "backup",
    title: "마지막 백업(GitHub artifact)",
    stages: ["sandbox", "preview"],
    guide: GUIDE.backup,
    // sandbox 는 버려도 되는 데이터라 경고, preview 는 실패(D152). 어느 쪽이든 「확인 못 함」과 「오래됨」을 그대로 말한다
    severity: (ctx) => (ctx.stage === "preview" ? "fail" : "warn"),
    async run(ctx) {
      const repo = ctx.repo
      const token = ctx.has("GITHUB_TOKEN") ? ctx.get("GITHUB_TOKEN") : ctx.has("GH_TOKEN") ? ctx.get("GH_TOKEN") : undefined
      const s = await lastBackupCheck({ repo, token, now: ctx.now, fetchImpl: ctx.fetch })
      const line = `${s.line}${token ? ` (토큰 길이 ${token.length})` : ` · 넣을 이름: ${GUIDE.backup.name} · ${GUIDE.backup.what} · 운영자 할 일 ${GUIDE.backup.owner}`}`
      return s.ok ? R.pass(line) : { status: "fail", detail: line }
    },
  },
]

/** 값 하나를 읽어 두는 맥락 */
function makeCtx({ stage, fetchImpl, connectDb, now, repo, timeoutMs, legalDir }, values) {
  const mode = values.LF_MODE === "live" ? "live" : values.LF_MODE === "mock" ? "mock" : stage === "dev" ? "mock" : "live"
  return {
    stage,
    mode,
    env: values,
    now,
    repo,
    timeoutMs,
    legalDir,
    fetch: fetchImpl,
    connectDb,
    has: (n) => typeof values[n] === "string" && values[n] !== "",
    get: (n) => values[n],
    /** 값이 없을 때 실패로 볼지: dev + mock 이 아니면 필수 */
    required: !(stage === "dev" && mode === "mock"),
  }
}

async function defaultConnectDb(url) {
  const { db } = await import("../packages/db/src/client.ts")
  const { sql } = await import("drizzle-orm")
  const d = db(url)
  return {
    ping: async () => {
      await d.execute(sql`select 1 as ok`)
    },
    close: () => d.$client.end({ timeout: 2 }),
  }
}

/**
 * 점검을 돌린다. 값은 어디에도 싣지 않는다 — 돌려주는 detail 은 이미 가려진 문장이다.
 * @returns {Promise<{ stage: string, mode: string, checks: { id: string, title: string, status: string, detail: string }[], counts: Record<string, number>, exit: number }>}
 */
export async function runDoctor({ stage, env = process.env, userEnv = windowsUserEnv, fetch: fetchImpl = globalThis.fetch, connectDb = defaultConnectDb, now = new Date(), repo, only, timeoutMs = 10_000, legalDir = LEGAL_DIR } = {}) {
  if (!STAGES.includes(stage)) throw new Error(`stage 는 ${STAGES.join("|")} 중 하나다`)
  const values = readSecrets(ALL_NAMES, env, userEnv)
  const ctx = makeCtx({ stage, fetchImpl, connectDb, now, repo: repo ?? values.GITHUB_REPOSITORY ?? DEFAULT_REPO, timeoutMs, legalDir }, values)
  const secrets = SECRET_NAMES.map((n) => values[n]).filter(Boolean)
  const checks = []
  for (const c of CHECKS) {
    if (!c.stages.includes(stage)) continue
    if (only && !only.includes(c.id)) continue
    let out
    try {
      out = await runOne(c, ctx)
    } catch (e) {
      out = R.fail(`점검 중 예외(${e instanceof Error ? e.name : "error"})`)
    }
    // 마지막 안전망: 어떤 문장이든 비밀 값이 들어 있으면 가린다
    checks.push({ id: c.id, title: c.title, status: out.status, detail: maskSecrets(out.detail, secrets) })
  }
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 }
  for (const c of checks) counts[c.status] += 1
  return { stage, mode: ctx.mode, checks, counts, exit: counts.fail > 0 ? 1 : 0 }
}

async function runOne(c, ctx) {
  const g = c.guide
  if (c.optionalUnlessConfigured) {
    if (!c.optionalUnlessConfigured.some((n) => ctx.has(n))) return R.skip(`쓰지 않는다 — 넣은 것이 없다(Paddle 미승인 대비일 때만 켠다${g?.owner ? `: ${g.owner}` : ""})`)
    return degrade(c, ctx, await c.run(ctx))
  }
  if (c.needs) {
    const gone = missingOf(ctx, c.needs)
    // 일부만 없어도 나머지로 부분 점검은 하지 않는다 — 한 번에 모두 알려 주고 끝낸다(J14). 단 dev+mock 은 건너뜀
    if (gone.length === c.needs.length && !ctx.required) return R.skip(`mock 모드라 건너뜀 — 없음 ${gone.join(", ")}`)
    if (gone.length) {
      const line = missingLine(gone, g)
      // dev+mock 에서 일부만 넣었으면 알려 준다(경고), 필수 단계면 실패
      return ctx.required ? R.fail(line) : R.warn(`일부만 있다 — ${line}`)
    }
  }
  return degrade(c, ctx, await c.run(ctx))
}

/** 실패의 무게를 단계에 맞춘다: dev+mock 이면 경고, severity 를 가진 검사는 그 값 */
function degrade(c, ctx, out) {
  if (out.status !== "fail") return out
  const sev = c.severity?.(ctx)
  if (sev === "warn") return R.warn(out.detail)
  if (!ctx.required && c.id !== "mode" && c.id !== "paddle-live-guard") return R.warn(`${out.detail} · mock 모드라 앱은 이 값을 쓰지 않는다(경고)`)
  return out
}

const LABEL = { pass: "PASS", warn: "WARN", fail: "FAIL", skip: "SKIP" }

export function renderReport(report) {
  const lines = [`doctor --stage ${report.stage} (mode ${report.mode})`]
  for (const c of report.checks) lines.push(`[${LABEL[c.status]}] ${c.id} — ${c.detail}`)
  const k = report.counts
  lines.push(`검사 ${report.checks.length}개 · 통과 ${k.pass} · 경고 ${k.warn} · 실패 ${k.fail} · 건너뜀 ${k.skip} → 종료 ${report.exit}`)
  return lines.join("\n")
}

function parseArgs(argv) {
  const a = { stage: undefined, only: undefined, json: false, repo: undefined, userEnv: true }
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]
    if (x === "--stage") a.stage = argv[++i]
    else if (x === "--only") a.only = String(argv[++i] ?? "").split(",").filter(Boolean)
    else if (x === "--json") a.json = true
    else if (x === "--repo") a.repo = argv[++i]
    else if (x === "--no-user-env") a.userEnv = false
    else return { error: `모르는 인자 ${x}` }
  }
  if (!STAGES.includes(a.stage)) return { error: `--stage ${STAGES.join("|")} 가 필요하다` }
  if (a.only) {
    const bad = a.only.filter((id) => !CHECKS.some((c) => c.id === id))
    if (bad.length) return { error: `모르는 검사 id: ${bad.join(", ")}(있는 것: ${CHECKS.map((c) => c.id).join(", ")})` }
  }
  return a
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.error) {
    console.error(`${a.error}\nusage: node scripts/doctor.mjs --stage dev|sandbox|preview [--only id,id] [--json] [--repo owner/repo] [--no-user-env]`)
    process.exitCode = 2
    return
  }
  const report = await runDoctor({ stage: a.stage, only: a.only, repo: a.repo, userEnv: a.userEnv ? windowsUserEnv : (names) => Object.fromEntries(names.map((n) => [n, null])) })
  console.log(a.json ? JSON.stringify(report, null, 2) : renderReport(report))
  process.exitCode = report.exit
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(`doctor 자체 오류: ${e instanceof Error ? e.name : "error"}`)
    process.exitCode = 1
  })
}
