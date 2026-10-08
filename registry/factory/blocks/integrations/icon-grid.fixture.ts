import type { IntegrationsIconGridProps } from "./icon-grid"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 연동 제품 이름은 모두 가상, 문구마다 「예시」.
const KIND = { native: "기본 연동", api: "API", webhook: "웹훅" } as const
const NAMES: [string, "native" | "api" | "webhook"][] = [
  ["바람메일", "native"],
  ["새벽캘린더", "native"],
  ["구름드라이브", "native"],
  ["파란결제", "api"],
  ["초록택배", "api"],
  ["별빛메신저", "webhook"],
  ["숫자장부", "native"],
  ["종이서명", "api"],
]

export const fixture: IntegrationsIconGridProps = {
  copy: {
    title: "쓰던 도구와 그대로 이어집니다",
    lead: "지금 연결할 수 있는 도구만 실었습니다(예시).",
    items: NAMES.map(([name, kind]) => ({ name, url: `#integration-${name}`, kind })),
    kindLabels: KIND,
    apiNote: "목록에 없는 도구는 API와 웹훅으로 연결할 수 있고, 엑셀·CSV로 언제든 가져오고 내보낼 수 있습니다(예시).",
  },
}

// 최대: 문구 끝까지, 연동 16개(긴 이름 섞음).
export const fixtureMax: IntegrationsIconGridProps = {
  copy: {
    title: "쓰던 도구와 그대로 이어집니다 — 메일·일정·결제·배송·장부(예시)",
    lead: "지금 바로 연결할 수 있는 도구만 실었습니다. 연결은 설정 화면에서 한 번 로그인하면 끝나고, 언제든 끊을 수 있습니다. 끊으면 그 도구에서 가져온 자료는 30일 뒤 지웁니다(예시).",
    items: Array.from({ length: 16 }, (_, i) => {
      const [name, kind] = NAMES[i % NAMES.length]
      return { name: i % 3 === 0 ? `${name} 비즈니스 플러스 ${i + 1}` : `${name} ${i + 1}`, url: `#integration-${i + 1}`, kind }
    }),
    kindLabels: KIND,
    apiNote: "목록에 없는 도구는 REST API와 웹훅으로 연결할 수 있고, 개발 문서와 예제 코드를 함께 드립니다. 엑셀·CSV로 언제든 가져오고 내보낼 수 있으며, 해지한 뒤에도 30일 동안 전체 자료를 내려받을 수 있습니다(예시).",
  },
}

// 최소: 머리말·아래 줄 없이 연동 1개.
export const fixtureMin: IntegrationsIconGridProps = {
  copy: { title: "연결되는 도구", items: [{ name: "바람메일", url: "#integration-mail", kind: "native" }], kindLabels: KIND },
}
