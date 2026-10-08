import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { OnboardingChecklistPanelCopy, OnboardingChecklistPanelProps } from "./checklist-panel"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스의 첫 세션 체크리스트 — 가치 순서: 첫 항목 → 공유 → 알림 → 팀. 사업 중립 문장이다(특정 업종의 낱말을 쓰지 않는다 — FINAL-WF2 AB16).
const COPY: OnboardingChecklistPanelCopy = {
  title: "시작하기까지 네 단계예요",
  lead: "순서대로 하면 10분쯤 걸려요(예시).",
  progress: "{done}/{total} 끝냈어요",
  progressLabel: "시작 체크리스트 진행률",
  doneLabel: "끝냄",
  todoLabel: "할 일",
  items: [
    { id: "create-page", title: "첫 항목 만들기", body: "이름과 간단한 설명만 적으면 만들어져요.", action: { label: "첫 항목 만들기", href: "#create-page" } },
    { id: "share-link", title: "링크를 함께 쓸 사람에게 보내기", body: "링크를 복사해 팀 채팅방에 붙여 보세요.", action: { label: "링크 복사하러 가기", href: "#share-link" } },
    { id: "alerts", title: "알림 켜기", body: "새 소식이 생기면 알려 드려요.", action: { label: "알림 설정 열기", href: "#alerts" } },
    { id: "invite-staff", title: "팀원 초대하기", body: "함께 쓸 사람이 있으면 초대해요.", action: { label: "초대 화면 열기", href: "#invite-staff" } },
  ],
  dismiss: "시작 체크리스트 닫기",
  closedLine: "시작 체크리스트 {done}/{total}",
  reopen: "체크리스트 다시 열기",
  celebrate: { title: "네 단계를 모두 끝냈어요.", body: "이제 새 소식이 생기면 알림으로 알려 드려요(예시)." },
}

export const fixture: OnboardingChecklistPanelProps = { copy: COPY, completed: ["create-page"] }

export const fixtureMax: OnboardingChecklistPanelProps = {
  copy: {
    ...COPY,
    title: "시작하기까지 다섯 단계예요 — 순서대로 하면 오늘 안에 끝낼 수 있어요",
    lead: "단계마다 1~3분이면 끝나요. 중간에 닫아도 끝낸 단계는 그대로 남고, 이 판은 위의 한 줄에서 다시 열 수 있어요(예시).",
    items: [
      ...COPY.items.map((it) => ({ ...it, body: `${it.body} 필요하면 나중에 설정에서 언제든 바꿀 수 있어요(예시).` })),
      { id: "first-review", title: "처음 쓰는 사람에게 안내 보내기", body: "처음 쓰는 사람에게 사용 안내를 미리 보내면 헷갈림이 줄어요(예시).", action: { label: "안내 문구 만들기", href: "#visit-guide" } },
      { id: "sixth", title: "여섯 번째 항목은 보이지 않아요", body: "체크리스트는 5개까지만 그려요.", action: { label: "보이지 않아요", href: "#sixth" } },
    ],
  },
  completed: ["create-page", "share-link"],
}

export const fixtureMin: OnboardingChecklistPanelProps = {
  copy: { ...COPY, lead: undefined, items: COPY.items.slice(0, 3).map((it) => ({ id: it.id, title: it.title, action: it.action })) },
  completed: ["create-page", "share-link", "alerts"],
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<OnboardingChecklistPanelProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: OnboardingChecklistPanelProps = {
  ...fixture,
  copy: {
    title: "Four steps to get started",
    lead: "Following them in order takes about 10 minutes (example).",
    progress: "{done} of {total} done",
    progressLabel: "Getting-started checklist progress",
    doneLabel: "Done",
    todoLabel: "To do",
    items: [
      {
        id: "create-page",
        title: "Create your first project",
        body: "Just give it a name and your first project is ready.",
        action: {
          label: "Create your first project",
          href: "#create-page",
        },
      },
      {
        id: "share-link",
        title: "Share your project link",
        body: "Copy the link and paste it into your team chat.",
        action: {
          label: "Go copy the link",
          href: "#share-link",
        },
      },
      {
        id: "alerts",
        title: "Turn on notifications",
        body: "We'll text you when something new comes in.",
        action: {
          label: "Open notification settings",
          href: "#alerts",
        },
      },
      {
        id: "invite-staff",
        title: "Invite a teammate",
        body: "Invite someone to work on it with you.",
        action: {
          label: "Open the invite screen",
          href: "#invite-staff",
        },
      },
    ],
    dismiss: "Close the getting-started checklist",
    closedLine: "Getting-started checklist {done}/{total}",
    reopen: "Reopen the checklist",
    celebrate: {
      title: "You finished all four steps.",
      body: "You'll get a notification whenever something new comes in (example).",
    },
  },
}
