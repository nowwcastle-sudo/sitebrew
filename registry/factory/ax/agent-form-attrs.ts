import type { AgentToolMeta } from "@/registry/factory/contract/block-contract"

/** `<form>`에 펼쳐 넣는 WebMCP 선언형 속성. `toolautosubmit` 은 만들지 않는다 — 에이전트는 채우고 사람이 누른다(factory-rules.md §20-6). */
export interface AgentFormAttrs {
  toolname: string
  tooldescription: string
}

const TOOL_NAME = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/

/**
 * 블록 계약의 AgentToolMeta → `<form {...agentFormAttrs(meta)}>` 속성. 미지원 브라우저는 속성을 무시한다.
 * 자동 제출 속성은 어떤 입력에도 만들지 않는다(타입도 autoSubmit 을 false 만 받는다).
 * toolName 은 영문 소문자로 시작하는 kebab/snake 이름(예: request-booking), description 은 사람이 읽어도 맞는 한 문장이다.
 * 틀리면 개발자용 한국어 오류를 던진다 — 모듈 범위나 렌더 때 한 번 불러 설정 실수를 바로 드러낸다.
 */
export function agentFormAttrs(meta: AgentToolMeta): AgentFormAttrs {
  const name = meta.toolName.trim()
  const description = meta.description.trim().replace(/\s+/g, " ")
  if (!TOOL_NAME.test(name)) throw new Error(`agentFormAttrs: toolName 은 영문 소문자로 시작하는 kebab/snake 이름이어야 합니다 — "${meta.toolName}"`)
  if (!description) throw new Error(`agentFormAttrs: description 이 비었습니다 — 도구가 무엇을 하는지 한 문장으로 적어 주세요 (${name})`)
  return { toolname: name, tooldescription: description }
}
