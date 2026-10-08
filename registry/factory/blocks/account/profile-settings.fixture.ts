import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import type { AccountProfileSettingsCopy, AccountProfileSettingsProps } from "./profile-settings"
import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 서비스 「모아플랜(예시)」 계정 설정. 사용자는 목의 가상 인물(김예시·example.com).
// 갤러리 포트: ?auth=signed-in(기본)|signed-out · &state=loading|empty|error|ready(session 읽기) · &submit=(signOut 결과).
const COPY: AccountProfileSettingsCopy = {
  title: "계정",
  lead: "로그인 정보와 보안 설정을 여기서 바꿔요(예시).",
  rows: { name: "이름", email: "이메일", password: "비밀번호", twoFactor: "2단계 인증" },
  values: { noName: "아직 적지 않았어요", passwordSet: "설정되어 있어요", twoFactorOn: "켜져 있어요", twoFactorOff: "꺼져 있어요" },
  actions: {
    name: { label: "이름 바꾸기", href: "#settings-name" },
    email: { label: "이메일 바꾸기", href: "#settings-email" },
    password: { label: "비밀번호 바꾸기", href: "#password-reset" },
    twoFactor: { labelOn: "인증 방법 바꾸기", labelOff: "2단계 인증 켜기", href: "#settings-2fa" },
  },
  signOut: {
    label: "로그아웃하기",
    question: "이 기기에서 로그아웃할까요?",
    cancel: "취소",
    confirm: "로그아웃하기",
    pending: "로그아웃하는 중",
    errorTitle: "로그아웃하지 못했어요 — 잠시 뒤 다시 눌러 주세요",
    done: { title: "로그아웃했어요", body: "다른 기기의 로그인은 그대로예요(예시).", label: "다시 로그인하기", href: "#sign-in" },
  },
  notices: SUBMIT_NOTICES,
  remove: { label: "계정 지우기", href: "#settings-delete", note: "지우면 일정·할 일이 30일 뒤 모두 사라져요(예시)." },
  empty: { title: "로그인이 필요해요", body: "로그인하면 계정 정보를 볼 수 있어요.", label: "로그인하기", href: "#sign-in" },
  loading: "계정 정보를 불러오는 중이에요",
  error: "계정 정보를 불러오지 못했어요",
  retry: "다시 불러오기",
}
const SESSION = { userId: "user-example-1", name: "김예시", email: "kim@example.com", twoFactor: false }

export const fixture: AccountProfileSettingsProps = {
  copy: COPY,
  session: async () => ({ ok: true, data: SESSION }),
  signOut: async () => ({ ok: true, data: {} }),
}

export const fixtureMax: AccountProfileSettingsProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "계정 — 로그인 정보·보안 설정·로그아웃과 계정 지우기(예시)",
    lead: "로그인 정보와 보안 설정을 여기서 바꿔요. 회사 계정은 관리자가 정한 설정(2단계 인증 필수 등)을 바꿀 수 없고, 바꿀 수 없는 항목은 관리자에게 물어봐 주세요(예시).",
    remove: { ...COPY.remove, note: "지우면 일정·할 일·공유 캘린더가 30일 뒤 모두 사라지고, 그 전에는 같은 이메일로 로그인해 되살릴 수 있어요(예시)." },
  },
}

export const fixtureMin: AccountProfileSettingsProps = { ...fixture, copy: { ...COPY, lead: undefined, remove: { label: COPY.remove.label, href: COPY.remove.href } } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AccountProfileSettingsProps> => {
  const qq = new URLSearchParams(q)
  if (!qq.has("auth")) qq.set("auth", "signed-in")
  const auth = mockAuth(qq, g.fx === "max" ? { session: { ...SESSION, name: "김예시 — 모아플랜 예시 팀 운영 담당(예시)", twoFactor: true } } : {})
  return { session: auth.session, signOut: auth.signOut, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: AccountProfileSettingsProps = {
  ...fixture,
  copy: {
    title: "Account",
    lead: "Change your sign-in details and security settings here (example).",
    rows: {
      name: "Name",
      email: "Email",
      password: "Password",
      twoFactor: "Two-step verification",
    },
    values: {
      noName: "Not set yet",
      passwordSet: "Set",
      twoFactorOn: "On",
      twoFactorOff: "Off",
    },
    actions: {
      name: {
        label: "Change name",
        href: "#settings-name",
      },
      email: {
        label: "Change email",
        href: "#settings-email",
      },
      password: {
        label: "Change password",
        href: "#password-reset",
      },
      twoFactor: {
        labelOn: "Change verification method",
        labelOff: "Turn on two-step verification",
        href: "#settings-2fa",
      },
    },
    signOut: {
      label: "Sign out",
      question: "Sign out on this device?",
      cancel: "Cancel",
      confirm: "Sign out",
      pending: "Signing out",
      errorTitle: "We couldn't sign you out. Please try again in a moment.",
      done: {
        title: "You're signed out",
        body: "Your sign-ins on other devices are unchanged (example).",
        label: "Sign in again",
        href: "#sign-in",
      },
    },
    notices: {
      rateLimited: "You can send again in {seconds} seconds",
      timeout: {
        title: "Taking longer than expected",
        body: "The server has not answered yet. What you wrote is still here, so please try again.",
        retry: "Try again",
      },
      unsupported: {
        title: "This cannot be changed here",
        link: "Go to where you manage it",
      },
      approval: {
        title: "Please confirm this yourself",
        attempted: "We received the change you asked for.",
        progress: "Nothing has changed yet.",
        reason: "A person has to review this change and press the button.",
        next: "Please press the confirm button on the screen yourself.",
        route: {
          label: "Contact support",
          href: "#contact",
        },
      },
    },
    remove: {
      label: "Delete account",
      href: "#settings-delete",
      note: "If you delete it, your projects and tasks are permanently removed after 30 days (example).",
    },
    empty: {
      title: "Sign-in required",
      body: "Sign in to see your account details.",
      label: "Sign in",
      href: "#sign-in",
    },
    loading: "Loading your account details",
    error: "We couldn't load your account details",
    retry: "Reload",
  },
}
