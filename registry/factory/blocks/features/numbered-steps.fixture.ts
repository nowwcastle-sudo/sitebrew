import type { FeaturesNumberedStepsProps } from "./numbered-steps"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스, 문구마다 「예시」.
export const fixture: FeaturesNumberedStepsProps = {
  copy: {
    title: "세 단계면 시작합니다",
    lead: "가입부터 첫 정산까지 하루면 됩니다(예시).",
    steps: [
      { title: "자료 가져오기", body: "쓰던 엑셀·CSV 파일을 끌어다 놓으면 열 이름을 맞춰 가져옵니다(예시)." },
      { title: "직원 초대", body: "메일 주소만 적으면 직원마다 계정과 권한이 만들어집니다(예시)." },
      { title: "첫 정산", body: "월말에 버튼 하나로 지점별 합계와 세금계산서가 나옵니다(예시)." },
    ],
  },
}

// 최대: 문구 끝까지, 단계 5개.
export const fixtureMax: FeaturesNumberedStepsProps = {
  copy: {
    title: "다섯 단계면 쓰던 방식을 그대로 옮겨 옵니다(예시)",
    lead: "가입, 자료 가져오기, 직원 초대, 권한 나누기, 첫 정산까지 순서대로 따라 하면 됩니다. 막히는 단계는 상담 창구가 화면을 같이 보며 도와드립니다(예시).",
    steps: ["가입과 사업자 정보 입력", "쓰던 자료 가져오기", "직원 초대와 계정 만들기", "직원마다 권한 나누기", "첫 정산과 세금계산서 발행"].map((title) => ({
      title,
      body: "쓰던 엑셀·CSV 파일을 끌어다 놓으면 열 이름을 맞춰 가져오고, 맞지 않는 열은 화면에서 하나씩 짝을 지어 줄 수 있습니다. 가져온 뒤에도 원본 파일은 그대로 둡니다(예시).",
    })),
  },
}

// 최소: 머리말 없이 단계 1개.
export const fixtureMin: FeaturesNumberedStepsProps = {
  copy: { title: "바로 시작합니다", steps: [{ title: "가입", body: "메일 주소만 있으면 됩니다(예시)." }] },
}
