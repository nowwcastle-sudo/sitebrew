import type { FeaturesStaggerCardsProps } from "./stagger-cards"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 정산 도구의 쓰는 순서.
export const fixture: FeaturesStaggerCardsProps = {
  copy: {
    title: "장부가 맞기까지",
    lead: "처음 한 번만 연결하면 그다음은 알아서 맞춰요(예시).",
    steps: [
      { title: "매출 연결", body: "카드사와 배달 앱 정산 내역을 한 번 연결해요(예시)." },
      { title: "자동 맞춤", body: "입금일이 달라도 같은 거래끼리 짝을 지어 둬요(예시)." },
      { title: "차이 알림", body: "맞지 않는 거래만 골라 알려 드려요(예시)." },
    ],
  },
}

// 최대: 긴 제목·설명, 카드 여섯.
export const fixtureMax: FeaturesStaggerCardsProps = {
  copy: {
    title: "처음 연결부터 세무사 자료까지 한 흐름으로 맞춰지는 장부",
    lead: "처음 한 번만 연결하면 그다음은 알아서 맞춰요. 맞지 않는 거래만 사람이 보면 되고, 월말에는 세무사에게 보낼 자료가 한 번에 만들어져요(예시).",
    steps: [
      { title: "매출 연결", body: "카드사와 배달 앱 정산 내역을 한 번 연결해요. 지점이 여럿이어도 같은 화면에서 이어요(예시)." },
      { title: "자동 맞춤", body: "입금일이 달라도 같은 거래끼리 짝을 지어 둬요(예시)." },
      { title: "차이 알림", body: "맞지 않는 거래만 골라 알려 드려요. 알림은 하루 한 번 모아서 보내요(예시)." },
      { title: "비용 분류", body: "자주 쓰는 거래처는 한 번 정하면 다음부터 같은 칸으로 들어가요(예시)." },
      { title: "지점 비교", body: "지점마다 매출과 비용을 나란히 놓고 봐요(예시)." },
      { title: "자료 내려받기", body: "월말에 세무사에게 보낼 자료를 한 번에 내려받아요(예시)." },
    ],
  },
}

// 최소: 설명 없음, 카드 셋(짧게).
export const fixtureMin: FeaturesStaggerCardsProps = {
  copy: {
    title: "쓰는 순서",
    steps: [
      { title: "연결", body: "한 번 연결(예시)." },
      { title: "맞춤", body: "알아서 맞춤(예시)." },
      { title: "확인", body: "차이만 확인(예시)." },
    ],
  },
}
