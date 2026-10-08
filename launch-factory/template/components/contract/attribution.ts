import type { AnalyticsPort, Attribution } from "@/components/contract/ports"

// 바깥 태그 위에 안쪽 태그를 얹는다. 값이 undefined 인 칸은 적지 않은 것으로 본다(바깥 값이 남는다). 결과는 새 객체다.
function mergeAttribution(outer: Attribution, inner: Attribution | undefined): Attribution {
  const out: Attribution = { ...outer }
  for (const [k, v] of Object.entries(inner ?? {}) as [keyof Attribution, Attribution[keyof Attribution]][]) {
    if (v !== undefined) (out as Record<keyof Attribution, unknown>)[k] = typeof v === "object" ? { ...v } : v
  }
  return out
}

/**
 * 계측 포트를 감싸 track 마다 출처 태그(meta.attribution)를 붙인다. consent·setConsent 는 그대로 원래 포트로 간다(동의가 false 면 어댑터가 태그째 버린다).
 * 블록은 태그를 모른다 — 조립하는 쪽이 감싼 포트의 track 을 블록 props 로 넘긴다:
 *   const page = withAttribution(analytics, { recipeId: "r1-measure" })                    // 페이지에서 한 번
 *   <FaqSingleAccordion {...content} track={withAttribution(page, { blockId: "faq-single-accordion" }).track} />  // 블록마다
 * 합치는 규칙: 블록에 가까운(안쪽) 감싸기의 칸이 이기고, 안쪽이 적지 않은 칸은 바깥 감싸기에서 온다. 호출하며 meta.attribution 을 직접 주면 그것이 모두를 이긴다.
 * 감쌀 때 태그를 복사한다(나중에 넘긴 객체를 바꿔도 흔들리지 않는다). track 은 감쌀 때 한 번 만든 같은 함수다 — 렌더마다 감싸지 말고 한 번 감싸 둔다.
 */
export function withAttribution(port: AnalyticsPort, attribution: Attribution): AnalyticsPort {
  const own = mergeAttribution({}, attribution)
  // 합친 태그가 비면(모든 칸이 빠졌거나 undefined) attribution 키를 싣지 않는다 — 태그 없는 호출과 같은 기록(대장 A17).
  const track: AnalyticsPort["track"] = (name, props, meta) => {
    const attribution = mergeAttribution(own, meta?.attribution)
    if (Object.keys(attribution).length) return port.track(name, props, { ...meta, attribution })
    if (!meta) return port.track(name, props)
    const rest = { ...meta }
    delete rest.attribution
    return port.track(name, props, rest)
  }
  return { track, consent: () => port.consent(), setConsent: (next) => port.setConsent(next) }
}
