import type { SocialProofQuoteWallProps } from "./quote-wall"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 인물·회사, 문구마다 「예시」.
export const fixture: SocialProofQuoteWallProps = {
  copy: {
    title: "먼저 쓴 분들의 이야기",
    lead: "실명과 소속을 밝힌 후기만 실어요(예시).",
    quotes: [
      {
        quote: "월말마다 사흘 걸리던 정산이 반나절로 줄었습니다. 엑셀을 옮기는 데 10분이면 됐고, 그다음부터는 따로 손댈 일이 거의 없었어요(예시).",
        name: "김하늘",
        title: "운영 팀장",
        company: "모래시계 상회(예시)",
        result: "정산 시간 사흘 → 반나절",
      },
      { quote: "직원마다 권한을 나눌 수 있어서 안심이 됩니다(예시).", name: "박도윤", title: "대표", company: "오늘공방(예시)" },
      {
        quote: "처음에는 반신반의했는데, 체험 기간에 재고 오차가 눈에 띄게 줄어서 바로 결제했습니다(예시).",
        name: "이서연",
        title: "매니저",
        company: "초록 약국(예시)",
        result: "재고 오차 월 12건 → 2건",
      },
      { quote: "상담 창구 답이 빨라요. 보통 한 시간 안에 옵니다(예시).", name: "정민재", title: "사무장", company: "파란우산 협동조합(예시)" },
      {
        quote: "지점이 세 곳인데 한 화면에서 매출을 같이 보니 회의가 짧아졌습니다. 숫자를 맞추느라 전화할 일이 없어요(예시).",
        name: "최유나",
        title: "재무 담당",
        company: "달빛베이커리(예시)",
      },
    ],
  },
}

// 최대: 문구 끝까지, 후기 9개(긴 후기 섞음).
export const fixtureMax: SocialProofQuoteWallProps = {
  copy: {
    title: "먼저 쓴 분들의 이야기 — 가게·공방·작은 회사(예시)",
    lead: "실명·직함·소속과 구체적인 결과를 밝힌 후기만 실어요. 후기를 준 분께 대가를 드리지 않았고, 게재 전에 내용을 다시 확인받았어요(예시).",
    quotes: Array.from({ length: 9 }, (_, i) => ({
      quote:
        i % 3 === 0
          ? "월말마다 사흘 걸리던 정산이 반나절로 줄었습니다. 엑셀을 옮기는 데 10분이면 됐고, 그다음부터는 따로 손댈 일이 거의 없었어요. 지점이 늘어도 화면 하나에서 같이 보니 회의가 짧아지고, 숫자를 맞추느라 서로 전화할 일도 없어졌습니다(예시)."
          : i % 3 === 1
            ? "직원마다 권한을 나눌 수 있어서 안심이 됩니다(예시)."
            : "체험 기간에 재고 오차가 눈에 띄게 줄어서 바로 결제했습니다. 상담 창구 답도 빨라요(예시).",
      name: `김하늘${i + 1}`,
      title: "운영 팀장 겸 재무 담당",
      company: "모래시계 상회 연남점(예시)",
      result: i % 2 === 0 ? "정산 시간 사흘 → 반나절, 재고 오차 월 12건 → 2건" : undefined,
    })),
  },
}

// 최소: 머리말 없이 후기 1개(결과 줄 없음).
export const fixtureMin: SocialProofQuoteWallProps = {
  copy: { title: "먼저 쓴 분들의 이야기", quotes: [{ quote: "정산이 빨라졌어요(예시).", name: "박도윤", title: "대표", company: "오늘공방(예시)" }] },
}
