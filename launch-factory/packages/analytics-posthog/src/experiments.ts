// 실험 스위치 — PostHog 기능 플래그를 읽는 얇은 React 훅(§9 Q16·Q18).
//
// 규칙(§9 Q18, web-factory remaining-direction §6): 사이트 안 A/B 실험은 **주 1,000 방문 이상인 페이지에서만**, 한 번에 한 가지
// (히어로 블록 또는 CTA 문구)만 켠다. 방문이 적은 페이지는 30건 전환(§9 Q17)에 닿지 못해 결과가 나오지 않는다.
//   - 이 훅은 그 기준을 검사하지 않는다 — 훅은 방문 수를 모른다. 기준 검사와 「켜기 제안」은 web-factory P3-5 학습 집계기
//     (factory/learning/aggregate.mjs)가 PostHog 방문 수로 한다. 사람이 PostHog 에서 플래그를 켜는 것도 그 제안을 따른다.
//   - 훅은 플래그를 읽을 뿐이다: 동의 전·플래그를 아직 못 받음·꺼짐이면 늘 "control"(기본 화면)이다. 서버 렌더도 "control" 이다.
//   - 갈래는 출처 태그 attribution.experiment = { key, arm } 로 이벤트에 싣는다(withAttribution) — 속성 wf_experiment "<key>:<arm>".
// react 는 peerDependency 다. 이 파일은 하위 경로 "@launch-factory/analytics-posthog/experiments" 로만 부른다(서버 코드가 react 를 끌어오지 않게).
import { useCallback, useSyncExternalStore } from "react"
import { CONTROL_ARM, type PostHogAnalytics } from "./client.ts"

/** 실험을 켜도 되는 페이지의 주 방문 하한(§9 Q18). 검사는 P3-5 집계기가 한다 */
export const EXPERIMENT_MIN_WEEKLY_VISITS = 1_000

export type ExperimentSource = Pick<PostHogAnalytics, "experiment" | "onExperimentsChange">

const noop = () => {}

/** 실험 갈래. source 가 없으면(계측 없는 페이지) "control" */
export function useExperiment(key: string, source: ExperimentSource | null | undefined): string {
  const subscribe = useCallback((onChange: () => void) => (source ? source.onExperimentsChange(onChange) : noop), [source])
  return useSyncExternalStore(
    subscribe,
    () => (source ? source.experiment(key) : CONTROL_ARM),
    () => CONTROL_ARM,
  )
}

export { CONTROL_ARM }
