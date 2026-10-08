// 이벤트 속성 조립: 출처 태그(meta.attribution) → PostHog 속성 wf_*, 개인정보 모양 거부. 클라이언트·서버 어댑터가 함께 쓴다.
import type { Attribution } from "@launch-factory/contract"
// 브라우저 번들에 들어가는 파일이다 — 보안 패키지의 index 는 node:net 을 부르는 서버 코드(access-log)를 끌어와 Turbopack 개발 서버가 멈춘다. pii 만 부른다(v0 Task 10)
import { containsPii } from "@launch-factory/security/pii"

/**
 * 출처 태그 속성 이름(J11 학습 집계 P3-5 의 입력). props 칸과 섞이지 않게 wf_ 접두사를 쓴다.
 * wf_experiment 는 "<key>:<arm>" 한 문자열이다 — PostHog 에서 한 속성으로 나눠 보기(breakdown) 쉽게.
 * 키에 ":" 가 있으면 되읽을 수 없어 이벤트를 거부한다(PostHog 기능 플래그 키는 보통 글자·숫자·-·_ 이다).
 */
export const ATTRIBUTION_PROPERTY = {
  blockId: "wf_block",
  recipeId: "wf_recipe",
  copyVariant: "wf_copy",
  experiment: "wf_experiment",
} as const satisfies Record<keyof Attribution, string>

const WF_KEYS: readonly string[] = Object.values(ATTRIBUTION_PROPERTY)

export function attributionProperties(a: Attribution | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!a) return out
  if (a.blockId !== undefined) out.wf_block = a.blockId
  if (a.recipeId !== undefined) out.wf_recipe = a.recipeId
  if (a.copyVariant !== undefined) out.wf_copy = a.copyVariant
  if (a.experiment !== undefined) out.wf_experiment = `${a.experiment.key}:${a.experiment.arm}`
  return out
}

/** PostHog 로 보낸 속성을 계약 모양({ props, attribution })으로 되읽는다. 적합성 묶음의 sent() 와 테스트가 쓴다 */
export function splitProperties(properties: Record<string, unknown>): { props: Record<string, unknown>; attribution?: Attribution } {
  const props: Record<string, unknown> = {}
  const attribution: Attribution = {}
  for (const [k, v] of Object.entries(properties)) {
    if (!WF_KEYS.includes(k)) props[k] = v
    else if (k === "wf_block") attribution.blockId = String(v)
    else if (k === "wf_recipe") attribution.recipeId = String(v)
    else if (k === "wf_copy") attribution.copyVariant = String(v)
    else {
      const s = String(v)
      const i = s.indexOf(":")
      attribution.experiment = { key: s.slice(0, i), arm: s.slice(i + 1) }
    }
  }
  return Object.keys(attribution).length ? { props, attribution } : { props }
}

// 칸 이름: 이메일·전화·이름·주소. web-factory 적합성 묶음(contract/conformance/analytics.ts PII_KEY, p3-3 b2fb648)의 식에 `tel$` 만 더했다.
// events.ts 의 칸(path·label·planId·marketingConsent …)은 걸리지 않는다.
const PII_KEY = /e[-_]?mail|phone|mobile|tel$|name|addr(ess)?|street|postal|zip/i
// 값: 이메일·전화·토큰은 @launch-factory/security containsPii(Task 2, 날짜·주문번호·UUID 음성 대조 통과)를 쓴다.
// 주소: 한국 도로명(「…로 12」·「…길 3」)과 시·도 + 구·군, 영어 번지 + 거리 이름(123 Main St).
const ADDRESS_VALUE = [
  /(?:특별시|광역시|특별자치시|특별자치도|[가-힣]도)\s*[가-힣]+(?:시|군|구)/,
  /[가-힣0-9]+(?:로|길)\s*\d+(?:-\d+)?(?:\s|$|,|번길)/,
  /\b\d{1,6}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pkwy|Parkway|Pl|Place|Hwy|Highway)\b\.?/,
]

export function valueLooksPersonal(s: string): boolean {
  return containsPii(s) || ADDRESS_VALUE.some((re) => re.test(s))
}

/**
 * 개인정보 모양 칸의 경로("a.b[0].c"). 칸 이름이 이메일·전화·이름·주소 꼴이거나, 문자열 값이 이메일·전화·토큰·주소 꼴이면 걸린다.
 * 사람 이름 **값**은 모양으로 알 수 없다(「김」·「Kim」은 흔한 낱말과 구별되지 않는다) — 칸 이름으로만 막는다.
 */
export function personalDataPaths(value: unknown, at = ""): string[] {
  if (typeof value === "string") return valueLooksPersonal(value) ? [at || "(value)"] : []
  if (typeof value !== "object" || value === null) return []
  if (Array.isArray(value)) return value.flatMap((v, i) => personalDataPaths(v, `${at}[${i}]`))
  return Object.entries(value).flatMap(([k, v]) => {
    const p = at ? `${at}.${k}` : k
    return [...(PII_KEY.test(k) ? [p] : []), ...personalDataPaths(v, p)]
  })
}

export interface RejectedEvent {
  name: string
  /** 거부 이유: 개인정보 칸 경로 또는 태그 문제. 값은 싣지 않는다 */
  reasons: string[]
}

/** props·태그를 검사하고 PostHog 속성으로 합친다. 문제가 있으면 { rejected } */
export function buildProperties(
  name: string,
  props: unknown,
  attribution: Attribution | undefined,
): { properties: Record<string, unknown> } | { rejected: RejectedEvent } {
  const reasons = [...personalDataPaths(props), ...personalDataPaths(attribution ?? {}).map((p) => `attribution.${p}`)]
  if (attribution?.experiment?.key.includes(":")) reasons.push("attribution.experiment.key contains ':'")
  const own = (props ?? {}) as Record<string, unknown>
  const clash = Object.keys(own).filter((k) => WF_KEYS.includes(k))
  if (clash.length) reasons.push(...clash.map((k) => `props.${k} is a reserved attribution property name`))
  if (reasons.length) return { rejected: { name, reasons } }
  return { properties: { ...own, ...attributionProperties(attribution) } }
}
