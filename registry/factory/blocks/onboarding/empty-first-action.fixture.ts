import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { OnboardingEmptyFirstActionCopy, OnboardingEmptyFirstActionProps } from "./empty-first-action"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」의 빈 예약표.
const COPY: OnboardingEmptyFirstActionCopy = {
  title: "아직 받은 예약이 없어요",
  what: "예약표에는 손님이 예약 페이지에서 잡은 방문 일정이 날짜순으로 쌓여요.",
  why: "예약 페이지를 아직 만들지 않아서 비어 있어요.",
  action: { label: "예약 페이지 만들기", href: "#create-page" },
  sample: { label: "예시 예약으로 먼저 둘러보기", href: "#sample" },
  help: { label: "예약표는 어떻게 쓰나요?", body: "예약을 누르면 손님 연락처와 요청 사항이 열려요. 날짜를 끌어 옮기면 손님에게 변경 문자가 가요(예시)." },
}

export const fixture: OnboardingEmptyFirstActionProps = { copy: COPY }

export const fixtureMax: OnboardingEmptyFirstActionProps = {
  copy: {
    ...COPY,
    title: "아직 받은 예약이 없어요 — 예약 페이지를 만들면 여기에 날짜순으로 쌓여요",
    what: "예약표에는 손님이 예약 페이지에서 잡은 방문 일정이 날짜순으로 쌓여요. 전화로 받은 예약도 직접 적어 같은 표에서 볼 수 있어요(예시).",
    why: "예약 페이지를 아직 만들지 않았고, 직접 적은 예약도 없어서 비어 있어요. 페이지는 가게 이름과 영업시간만 있으면 3분 안에 만들 수 있어요(예시).",
    help: { label: "예약표는 어떻게 쓰나요? 옮기기·취소·메모까지", body: "예약을 누르면 손님 연락처와 요청 사항이 열려요. 날짜를 끌어 옮기면 손님에게 변경 문자가 가고, 취소하면 취소 안내 문자가 가요. 메모는 직원끼리만 보여요(예시)." },
  },
}

export const fixtureMin: OnboardingEmptyFirstActionProps = { copy: { title: COPY.title, what: COPY.what, why: COPY.why, action: COPY.action } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<OnboardingEmptyFirstActionProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}
