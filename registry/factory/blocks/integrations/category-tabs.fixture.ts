import type { IntegrationsCategoryTabsProps } from "./category-tabs"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 연동 제품 이름은 모두 가상, 문구마다 「예시」.
const KIND = { native: "기본 연동", api: "API", webhook: "웹훅" } as const

export const fixture: IntegrationsCategoryTabsProps = {
  copy: {
    title: "분류별 연동",
    lead: "쓰는 도구를 분류에서 찾아 연결하세요(예시).",
    tabsLabel: "연동 분류",
    linkLabel: "연결 방법",
    kindLabels: KIND,
    categories: [
      {
        name: "장부·회계",
        items: [
          { name: "숫자장부", url: "#ledger", kind: "native", note: "매출과 비용을 매일 밤 자동으로 옮겨요(예시)." },
          { name: "종이서명", url: "#sign", kind: "api", note: "세금계산서에 전자 서명을 붙여요(예시)." },
        ],
      },
      {
        name: "메신저·메일",
        items: [
          { name: "바람메일", url: "#mail", kind: "native", note: "정산이 끝나면 담당자에게 메일로 알려요(예시)." },
          { name: "별빛메신저", url: "#chat", kind: "webhook", note: "재고 알림을 팀 대화방으로 보내요(예시)." },
        ],
      },
      {
        name: "결제·배송",
        items: [
          { name: "파란결제", url: "#pay", kind: "api", note: "카드 결제 내역을 주문과 짝지어 가져와요(예시)." },
          { name: "초록택배", url: "#ship", kind: "api", note: "송장 번호를 주문에 붙이고 배송 상태를 받아요(예시)." },
          { name: "새벽캘린더", url: "#cal", kind: "native", note: "배송 예정일을 일정에 올려요(예시)." },
        ],
      },
    ],
  },
}

// 최대: 문구 끝까지, 분류 6개 × 연동 5개(긴 이름·설명).
export const fixtureMax: IntegrationsCategoryTabsProps = {
  copy: {
    title: "분류별 연동 — 장부·메일·결제·배송·일정·서명(예시)",
    lead: "쓰는 도구를 분류에서 찾아 연결하세요. 연결은 설정 화면에서 한 번 로그인하면 끝나고, 언제든 끊을 수 있어요. 목록에 없는 도구는 API와 웹훅으로 연결해요(예시).",
    tabsLabel: "연동 분류",
    linkLabel: "연결 방법",
    kindLabels: KIND,
    categories: ["장부·회계와 세무", "메신저·메일", "결제·정산 대행", "택배·배송 추적", "일정·예약 관리", "전자 서명·문서"].map((name, c) => ({
      name,
      items: Array.from({ length: 5 }, (_, i) => ({
        name: `숫자장부 비즈니스 플러스 ${c + 1}-${i + 1}`,
        url: `#int-${c}-${i}`,
        kind: (["native", "api", "webhook"] as const)[i % 3],
        note: "매출과 비용, 카드 결제 내역을 매일 밤 자동으로 옮기고, 맞지 않는 건은 아침에 담당자에게 알려 확인을 받아요(예시).",
      })),
    })),
  },
}

// 최소: 분류 1개(탭 없이 목록) · 연동 1개 · 설명 없음.
export const fixtureMin: IntegrationsCategoryTabsProps = {
  copy: { title: "연동", tabsLabel: "연동 분류", linkLabel: "연결 방법", kindLabels: KIND, categories: [{ name: "메일", items: [{ name: "바람메일", url: "#mail", kind: "native" }] }] },
}
