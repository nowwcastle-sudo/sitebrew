import { mockAnalytics, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { OnboardingSetupWizardCopy, OnboardingSetupWizardProps } from "./setup-wizard"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」의 첫 화면 — 질문 하나로 첫 할 일을 고른다.
const PERMISSION = {
  reason: "새 소식이 오면 이 기기로 바로 알려 드리려고 알림 권한을 여쭤요.",
  label: "이 기기로 알림 받기",
  granted: "알림을 켰어요. 새 소식이 오면 바로 알려 드려요.",
  denied: "알림을 켜지 않았어요. 나중에 설정에서 켤 수 있어요.",
  unsupported: "이 브라우저는 알림을 지원하지 않아요. 문자 알림을 써 보세요.",
}
const COPY: OnboardingSetupWizardCopy = {
  title: "무엇부터 할까요?",
  lead: "고른 답에 맞춰 첫 할 일 하나만 보여 드려요(예시).",
  stepLabel: "{step}/{total}단계",
  question: {
    legend: "예약노트로 가장 먼저 하고 싶은 일을 골라 주세요",
    options: [
      { id: "take", label: "첫 프로젝트 만들기", hint: "빈 프로젝트에서 바로 시작해요" },
      { id: "move", label: "쓰던 자료 옮기기", hint: "파일을 올려 한 번에 옮겨요" },
      { id: "remind", label: "알림 켜기", hint: "중요한 소식을 놓치지 않게 알려 드려요" },
    ],
  },
  required: "하나를 골라 주세요. 나중에 언제든 바꿀 수 있어요.",
  next: "다음",
  back: "질문으로 돌아가기",
  skip: { label: "건너뛰고 둘러보기", href: "#dashboard" },
  branches: {
    take: { title: "프로젝트부터 만들어요", body: "이름만 적으면 첫 프로젝트가 생겨요. 3분쯤 걸려요.", action: { label: "프로젝트 만들기", href: "#create-page" }, permission: PERMISSION },
    move: { title: "쓰던 자료를 옮겨요", body: "파일을 올리면 이름·날짜·담당자 칸을 알아서 맞춰요.", action: { label: "자료 파일 올리기", href: "#import" } },
    remind: { title: "알림을 켜요", body: "새 소식이 오면 문자나 앱 알림으로 알려 드려요. 받는 방법은 바꿀 수 있어요.", action: { label: "알림 방법 정하기", href: "#reminder" }, permission: PERMISSION },
  },
}

export const fixture: OnboardingSetupWizardProps = { copy: COPY }

export const fixtureMax: OnboardingSetupWizardProps = {
  copy: {
    ...COPY,
    title: "무엇부터 할까요? 고른 답에 맞춰 첫 할 일 하나만 보여 드려요",
    lead: "질문은 하나뿐이고 건너뛸 수 있어요. 팀 정보는 첫 프로젝트를 만든 뒤에 여쭤요. 답은 설정에서 언제든 바꿀 수 있어요(예시).",
    question: {
      ...COPY.question,
      options: [
        ...COPY.question.options.map((o) => ({ ...o, hint: `${o.hint} — 처음 한 번만 하면 되고 5분 안에 끝나요(예시)` })),
        { id: "team", label: "팀원과 함께 보기", hint: "팀원을 초대해 같은 화면을 봐요 — 처음 한 번만 하면 되고 5분 안에 끝나요(예시)" },
      ],
    },
    branches: { ...COPY.branches, team: { title: "팀원을 초대해요", body: "팀원 연락처로 초대 링크를 보내면 같은 화면을 볼 수 있어요. 권한은 초대할 때 고를 수 있어요(예시).", action: { label: "팀원 초대 링크 만들기", href: "#invite" } } },
  },
}

export const fixtureMin: OnboardingSetupWizardProps = {
  copy: { ...COPY, lead: undefined, question: { ...COPY.question, options: COPY.question.options.slice(0, 2).map((o) => ({ id: o.id, label: o.label })) } },
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<OnboardingSetupWizardProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  return { track: a.track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: OnboardingSetupWizardProps = {
  ...fixture,
  copy: {
    title: "Where would you like to start?",
    lead: "We'll show you just one first task that fits your answer (example).",
    stepLabel: "Step {step} of {total}",
    question: {
      legend: "Pick the first thing you want to do",
      options: [
        {
          id: "take",
          label: "Create a first project",
          hint: "Start right away from a blank project",
        },
        {
          id: "move",
          label: "Move your existing files",
          hint: "Upload a file and bring everything over at once",
        },
        {
          id: "remind",
          label: "Turn on notifications",
          hint: "We'll make sure you don't miss important news",
        },
      ],
    },
    required: "Pick one. You can change it later at any time.",
    next: "Next",
    back: "Back to the question",
    skip: {
      label: "Skip and look around",
      href: "#dashboard",
    },
    branches: {
      take: {
        title: "Let's create a project first",
        body: "Just add a name and your first project is ready. It takes about 3 minutes.",
        action: {
          label: "Create a project",
          href: "#create-page",
        },
        permission: {
          reason: "We're asking for notification permission so we can tell you on this device as soon as something new arrives.",
          label: "Get notifications on this device",
          granted: "Notifications are on. We'll tell you as soon as something new arrives.",
          denied: "Notifications are off. You can turn them on later in settings.",
          unsupported: "This browser doesn't support notifications. Try text message alerts.",
        },
      },
      move: {
        title: "Move your existing files",
        body: "Upload a file and we'll match the name, date and owner columns for you.",
        action: {
          label: "Upload a file",
          href: "#import",
        },
      },
      remind: {
        title: "Turn on notifications",
        body: "We'll tell you about new activity by text or app notification. You can change how you get them.",
        action: {
          label: "Choose how to get notifications",
          href: "#reminder",
        },
        permission: {
          reason: "We're asking for notification permission so we can tell you on this device as soon as something new arrives.",
          label: "Get notifications on this device",
          granted: "Notifications are on. We'll tell you as soon as something new arrives.",
          denied: "Notifications are off. You can turn them on later in settings.",
          unsupported: "This browser doesn't support notifications. Try text message alerts.",
        },
      },
    },
  },
}
