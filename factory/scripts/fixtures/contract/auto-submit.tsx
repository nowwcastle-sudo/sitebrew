// tsc 고정물(contract.test.mjs): AgentToolMeta.autoSubmit 은 false 이거나 생략뿐이다(factory-rules.md §20-6 — 되돌릴 수 없는 행위는 에이전트가 제출하지 않는다).
// 아래 @ts-expect-error 가 「쓰이지 않음」이 되면(autoSubmit 이 boolean 으로 풀리면) tsc 가 TS2578 로 멈춘다. 저장소 tsconfig 에서는 빠진다(fixtures 제외).
import type { AgentToolMeta } from "@/registry/factory/contract/block-contract"

export const omitted: AgentToolMeta = { toolName: "request-booking", description: "방문 예약을 요청한다(예시)" }
export const off: AgentToolMeta = { toolName: "request-booking", description: "방문 예약을 요청한다(예시)", autoSubmit: false }

export const literalTrue: AgentToolMeta = {
  toolName: "request-booking",
  description: "방문 예약을 요청한다(예시)",
  // @ts-expect-error — autoSubmit: true 는 타입으로 막는다
  autoSubmit: true,
}

const flag: boolean = Math.random() > 2
export const widened: AgentToolMeta = {
  toolName: "request-booking",
  description: "방문 예약을 요청한다(예시)",
  // @ts-expect-error — boolean 으로 넓힌 값도 막는다(true 일 수 있으므로)
  autoSubmit: flag,
}
