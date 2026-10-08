import type { StateScreenLoadingProps } from "./loading"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 앱의 읽는 중 화면.
const COPY = {
  label: "예약 화면을 불러오는 중이에요",
  slow: { title: "응답이 늦어요", body: "평소보다 오래 걸려요. 조금 더 기다리거나 다시 불러와 주세요(예시).", reload: { label: "다시 불러오기", href: "./" } },
}

export const fixture: StateScreenLoadingProps = { copy: COPY }

// 최대: 느릴 때 안내까지.
export const fixtureMax: StateScreenLoadingProps = { copy: { ...COPY, label: "예약 목록과 일정, 알림을 한꺼번에 불러오는 중이에요 — 잠시만 기다려 주세요(예시)" }, slow: true }

// 최소: 읽는 도구용 글 하나.
export const fixtureMin: StateScreenLoadingProps = { copy: { label: COPY.label } }
