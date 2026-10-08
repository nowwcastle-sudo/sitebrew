import type { SocialProofWhipQuotesProps } from "./whip-quotes"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 인물·회사, 문구마다 「예시」.
const UI = { prevLabel: "이전 후기", nextLabel: "다음 후기", positionLabel: "{current}번째 후기, 모두 {total}개" }

export const fixture: SocialProofWhipQuotesProps = {
  copy: {
    title: "먼저 쓴 분들의 이야기",
    lead: "실명과 소속을 밝힌 후기만 실어요(예시).",
    quotes: [
      { quote: "월말마다 사흘 걸리던 정산이 반나절로 줄었어요. 그다음부터는 따로 손댈 일이 거의 없었어요(예시).", name: "김하늘", title: "운영 팀장", company: "모래시계 상회(예시)", result: "정산 시간 사흘 → 반나절" },
      { quote: "지점마다 숫자를 맞추느라 전화하던 일이 없어졌어요(예시).", name: "최유나", title: "재무 담당", company: "달빛베이커리(예시)" },
      { quote: "체험 기간에 재고 오차가 눈에 띄게 줄어서 바로 결제했어요(예시).", name: "이서연", title: "매니저", company: "초록 약국(예시)", result: "재고 오차 월 12건 → 2건" },
    ],
    ...UI,
  },
}

// 최대: 긴 후기·긴 이름표, 후기 다섯.
export const fixtureMax: SocialProofWhipQuotesProps = {
  copy: {
    title: "먼저 쓴 분들의 이야기 — 가게·공방·작은 회사(예시)",
    lead: "실명·직함·소속과 구체적인 결과를 밝힌 후기만 실어요. 후기를 준 분께 대가를 드리지 않았고, 게재 전에 내용을 다시 확인받았어요(예시).",
    quotes: [
      { quote: "월말마다 사흘 걸리던 정산이 반나절로 줄었어요. 표 파일을 옮기는 데 십 분이면 됐고, 그다음부터는 따로 손댈 일이 거의 없었어요. 무엇보다 숫자가 안 맞을 때 어디가 다른지 바로 보여서 좋았어요(예시).", name: "김하늘", title: "운영 팀장 겸 재무 담당", company: "모래시계 상회 협동조합(예시)", result: "정산 시간 사흘 → 반나절" },
      { quote: "지점마다 숫자를 맞추느라 전화하던 일이 없어졌어요(예시).", name: "최유나", title: "재무 담당", company: "달빛베이커리(예시)" },
      { quote: "체험 기간에 재고 오차가 눈에 띄게 줄어서 바로 결제했어요(예시).", name: "이서연", title: "매니저", company: "초록 약국(예시)", result: "재고 오차 월 12건 → 2건" },
      { quote: "직원마다 권한을 나눌 수 있어서 안심이 돼요(예시).", name: "박도윤", title: "대표", company: "오늘공방(예시)" },
      { quote: "상담 창구 답이 빨라요. 보통 한 시간 안에 와요(예시).", name: "정민재", title: "사무장", company: "파란우산 협동조합(예시)" },
    ],
    ...UI,
  },
}

// 최소: 후기 하나(넘김 단추 없음), 설명 없음.
export const fixtureMin: SocialProofWhipQuotesProps = {
  copy: {
    title: "후기",
    quotes: [{ quote: "정산이 빨라졌어요(예시).", name: "김하늘", title: "팀장", company: "모래시계 상회(예시)" }],
    ...UI,
  },
}
