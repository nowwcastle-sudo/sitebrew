import type { IntegrationsHubDiagramProps } from "./hub-diagram"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 제품·연동 이름은 모두 가상, 문구마다 「예시」.
const KIND = { native: "기본 연동", api: "API", webhook: "웹훅" } as const
const ITEMS: [string, "native" | "api" | "webhook"][] = [
  ["바람메일", "native"],
  ["새벽캘린더", "native"],
  ["파란결제", "api"],
  ["초록택배", "api"],
  ["별빛메신저", "webhook"],
  ["숫자장부", "native"],
]

export const fixture: IntegrationsHubDiagramProps = {
  copy: {
    title: "마감노트를 가운데 두고",
    lead: "쓰던 도구가 한곳으로 모입니다(예시).",
    product: "마감",
    items: ITEMS.map(([name, kind]) => ({ name, url: `#hub-${name}`, kind })),
    kindLabels: KIND,
    apiNote: "그 밖의 도구는 API와 웹훅으로 연결합니다(예시).",
  },
}

// 최대: 문구 끝까지, 연동 14개(둘레에는 12개, 목록에는 모두).
export const fixtureMax: IntegrationsHubDiagramProps = {
  copy: {
    title: "마감노트를 가운데 두고 쓰던 도구가 한곳으로 모입니다(예시)",
    lead: "메일·일정·결제·배송·장부·서명까지 지금 연결할 수 있는 도구를 모두 그렸습니다. 연결은 설정 화면에서 한 번 로그인하면 끝나고, 언제든 끊을 수 있습니다(예시).",
    product: "마감",
    items: Array.from({ length: 14 }, (_, i) => {
      const [name, kind] = ITEMS[i % ITEMS.length]
      return { name: i % 4 === 0 ? `${name} 비즈니스 플러스 ${i + 1}` : `${name} ${i + 1}`, url: `#hub-${i + 1}`, kind }
    }),
    kindLabels: KIND,
    apiNote: "목록에 없는 도구는 REST API와 웹훅으로 연결할 수 있고, 개발 문서와 예제 코드를 함께 드립니다. 엑셀·CSV로 언제든 가져오고 내보낼 수 있습니다(예시).",
  },
}

// 최소: 머리말·아래 줄 없이 연동 1개.
export const fixtureMin: IntegrationsHubDiagramProps = {
  copy: { title: "연결되는 도구", product: "마감", items: [{ name: "바람메일", url: "#hub-mail", kind: "native" }], kindLabels: KIND },
}
