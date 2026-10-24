// 레지스트리 조립 파일(app/actions/*.ts 등)을 진짜 파일 그대로 불러 동작을 시험하는 도우미.
// `@/lib/launch/<이름>`(앱이 가진 조립 모듈)만 시험 대역으로 바꾸고, 나머지(@launch-factory/*)는 진짜다.
// node --test 는 파일마다 프로세스가 따로라 훅이 다른 시험에 새지 않는다.
import { registerHooks } from "node:module"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const KEY = "__lfGlueStubs"
globalThis[KEY] ??= {}

/** 모듈 이름 → { 내보낼 이름: 값 또는 함수 }. 대역은 호출 시점에 읽으므로 시험마다 바꿀 수 있다 */
export const stubs = globalThis[KEY]

/** 대역 없이 진짜로 불러오는 `@/lib/launch/<이름>` → registry 기준 경로 */
const REAL = {
  "eu-sales": "_shared/lib/launch/eu-sales.ts",
  purgers: "feature-account-lifecycle/files/lib/launch/purgers.ts",
  // 상점 조립(계획 3a): 바깥을 부르는 곳(env·db·mailer·config)만 대역으로 두고 조립 자체는 진짜 파일을 시험한다
  cron: "_shared/lib/launch/cron.ts",
  payments: "feature-payments-kr/files/lib/launch/payments.ts",
  catalog: "feature-commerce/files/lib/launch/catalog.ts",
  commerce: "feature-commerce/files/lib/launch/commerce.ts",
  "commerce-session": "feature-commerce/files/lib/launch/commerce-session.ts",
  // 상점이 모르는 결제 번호를 마지막으로 묻는 자리(기본 「내 것 아님」) — 예약금 항목이 대신하는 파일이라 바깥을 부르지 않는 기본형을 쓴다
  "payment-claim": "feature-commerce/files/lib/launch/payment-claim.ts",
  // 관리 셸(계획 3d L1): 신원 판독과 콘솔 조립은 진짜 파일을 시험한다(세션·DB·설정만 대역). 구획은 시험이 ADMIN_SECTIONS 에 밀어 넣는다
  "admin-identity": "feature-admin-console/files/lib/launch/admin-identity.ts",
  "admin-console": "feature-admin-console/files/lib/launch/admin-console.ts",
  // 관리 구획(계획 3d L2a): 상점 부품이 싣는 구획 모듈 — 콘솔 등록부가 불러온다
  "admin-sections/orders": "feature-commerce/files/lib/launch/admin-sections/orders.ts",
  "admin-sections/stock": "feature-commerce/files/lib/launch/admin-sections/stock.ts",
}

/** 대역 모듈의 소스 — 대문자 상수는 불러올 때 읽고(먼저 stubs 를 채운다), 함수 이름은 호출할 때 읽는다 */
function stubSource(module, names) {
  return names
    .map((n) => {
      const at = `globalThis.${KEY}[${JSON.stringify(module)}][${JSON.stringify(n)}]`
      return /^[A-Z_]+$/.test(n) ? `export const ${n} = ${at}` : `export const ${n} = (...a) => ${at}(...a)`
    })
    .join("\n")
}

let installed = false
/** exportsByModule: { auth: ["authPort"], db: ["database"] } — 대역 모듈이 내보낼 함수 이름 */
export function installGlueStubs(exportsByModule) {
  if (installed) throw new Error("installGlueStubs: 한 번만 부른다")
  installed = true
  registerHooks({
    resolve(specifier, context, nextResolve) {
      // 요청 머리: 서버 액션이 `headers()` 로 읽는다. 순수 node 에는 요청 범위가 없어 대역이다(stubs["next/headers"].headers·cookies 로 바꾼다 — 기본은 빈 머리·빈 쿠키)
      if (specifier === "next/headers") {
        const src = `export const headers = async () => (globalThis.${KEY}["next/headers"]?.headers ?? (async () => new Headers()))()
export const cookies = async () => (globalThis.${KEY}["next/headers"]?.cookies ?? (async () => ({ get: () => undefined })))()`
        return { url: `data:text/javascript,${encodeURIComponent(src)}`, shortCircuit: true }
      }
      // 앱 포트 조립(`@/lib/ports`): 템플릿 전용이라 시험이 대역을 줄 때만(stubs["@/lib/ports"]) 바꿔 끼운다 — 제품 템플릿 파일(importTemplateFile)이 부른다
      if (specifier === "@/lib/ports" && exportsByModule[specifier]) return { url: `data:text/javascript,${encodeURIComponent(stubSource(specifier, exportsByModule[specifier] ?? []))}`, shortCircuit: true }
      // 콘텐츠 모듈(`@/content/…`)은 템플릿 전용이라 시험이 값을 줄 때만(stubs["@/content/…"]) 바꿔 끼운다 — 값은 불러올 때 읽는다
      if (specifier.startsWith("@/content/") && exportsByModule[specifier]) {
        const src = exportsByModule[specifier].map((n) => `export const ${n} = globalThis.${KEY}[${JSON.stringify(specifier)}][${JSON.stringify(n)}]`).join("\n")
        return { url: `data:text/javascript,${encodeURIComponent(src)}`, shortCircuit: true }
      }
      const m = /^@\/lib\/launch\/(.+)$/.exec(specifier)
      if (!m) return nextResolve(specifier, context)
      // 순수 모듈(바깥을 부르지 않는 판정 코드)은 대역 대신 진짜 공유 파일을 쓴다 — 결제 입구의 EU 관문 등
      if (REAL[m[1]] && !exportsByModule[m[1]]) return { url: pathToFileURL(join(ROOT, "registry", REAL[m[1]])).href, shortCircuit: true }
      const names = exportsByModule[m[1]]
      if (!names) throw new Error(`glue stub 없음: ${specifier}`)
      return { url: `data:text/javascript,${encodeURIComponent(stubSource(m[1], names))}`, shortCircuit: true }
    },
  })
}

/** 레지스트리 원천 파일을 불러온다(예: "feature-billing-paddle/files/app/actions/billing.ts") */
export const importRegistryFile = (relFromRegistry) => import(pathToFileURL(join(ROOT, "registry", relFromRegistry)).href)

/** 제품 템플릿 파일을 불러온다(예: "lib/launch/commerce-session.ts") — 템플릿 것만 시험할 때 */
export const importTemplateFile = (relFromTemplate) => import(pathToFileURL(join(ROOT, "template", relFromTemplate)).href)
