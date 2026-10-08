import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"
import type { AuthMethod } from "@/registry/factory/contract/ports"

import type { SubmitNotices } from "../_shared/submit-guard"
import type { AuthSignInCopy, AuthSignInProps } from "./sign-in"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 일정 관리 서비스 「모아플랜(예시)」의 로그인. 문구는 해요체.
// 갤러리는 포트를 fixturePorts 로 바꿔 끼운다: ?auth=signed-out|two-factor · &submit=ok|field-error|server-error|pending · &state=(methods 읽기).
// 소셜 버튼 이름의 카카오·네이버·구글은 기능 이름(플랫폼 로그인 규격 — DESIGN §17)이라 그대로 쓴다.
export const SOCIAL_SIGN_IN = { kakao: "카카오로 로그인하기", naver: "네이버로 로그인하기", google: "구글 계정으로 로그인하기" }
// 제출 보호 문구(시간 초과·요청 제한·지원 안 함 — _shared/submit-guard). 폼을 가진 모든 예시가 같은 문구를 쓴다.
export const SUBMIT_NOTICES: SubmitNotices = {
  rateLimited: "{seconds}초 뒤에 다시 보낼 수 있어요",
  timeout: { title: "응답이 늦어요", body: "서버가 아직 답하지 않아요. 적은 내용은 그대로 있으니 다시 시도해 주세요.", retry: "다시 시도하기" },
  unsupported: { title: "여기서는 바꿀 수 없어요", link: "직접 관리하는 곳으로 가기" },
  // 승인 대기(R21) — 실패가 아니다. 서버가 사람 확인 없이 자동으로 부른 승인 행동을 멈췄을 때(approval_required)
  approval: { title: "직접 확인해 주세요", attempted: "요청한 변경을 받았어요.", progress: "아직 아무것도 바뀌지 않았어요.", reason: "이 변경은 사람이 내용을 확인하고 직접 눌러야 해요.", next: "화면의 확인 버튼을 직접 눌러 주세요.", route: { label: "고객센터에 문의하기", href: "#contact" } },
}
export const EMAIL_ERRORS = { emailRequired: "이메일 주소를 적어 주세요.", emailFormat: "이메일 주소 형식이 맞지 않아요. 예: name@example.com", passwordRequired: "비밀번호를 적어 주세요." }

const COPY: AuthSignInCopy = {
  title: "모아플랜에 로그인해요",
  lead: "쓰던 방법으로 로그인하면 일정이 그대로 있어요(예시).",
  social: SOCIAL_SIGN_IN,
  inApp: {
    title: "이 화면에서는 구글 로그인이 안 될 수 있어요",
    guide: "지금은 앱 안 브라우저로 열려 있어요. 오른쪽 위 ⋯ 메뉴에서 「다른 브라우저로 열기」를 눌러 주세요.",
    open: "기본 브라우저로 열기",
    copy: { copy: "주소 복사", copied: "주소를 복사했어요", manual: "복사가 막혔어요. 주소창의 주소를 직접 복사해 주세요" },
  },
  divider: "또는 이메일로 로그인",
  email: { label: "이메일", marker: "(필수)", placeholder: "name@example.com" },
  password: { label: "비밀번호", marker: "(필수)", show: "비밀번호 보기", capsLock: "Caps Lock이 켜져 있어요" },
  errors: EMAIL_ERRORS,
  forgot: { label: "비밀번호를 잊었어요", href: "#password-reset" },
  submit: "로그인하기",
  pending: "로그인하는 중",
  alert: { field: "확인이 필요한 칸이 있어요", server: "로그인하지 못했어요 — 적은 내용은 그대로 있어요" },
  notices: SUBMIT_NOTICES,
  methods: { loading: "로그인 방법을 불러오는 중이에요", error: "간편 로그인 버튼을 불러오지 못했어요. 이메일로는 로그인할 수 있어요.", retry: "다시 불러오기" },
  signUp: { text: "처음이세요?", label: "무료로 가입하기", href: "#sign-up" },
  done: { title: "로그인했어요", body: "오늘 일정으로 이동할게요(예시).", label: "오늘 일정 보기", href: "#today" },
  twoFactor: { title: "인증 코드가 필요해요", body: "인증 앱에 뜬 6자리 코드를 적으면 로그인이 끝나요.", label: "인증 코드 적기", href: "#two-factor" },
  emailSent: { title: "로그인 링크를 보냈어요", body: "메일함에서 링크를 누르면 로그인돼요. 10분 안에 눌러 주세요(예시)." },
  rememberMe: { label: "로그인 유지" },
  lastUsed: { badge: "최근 사용", password: "지난번에는 이메일로 로그인했어요" },
}

// 갤러리: &last=kakao|naver|google|password 이면 그 방법에 「최근 사용」 표시(fixturePorts 가 lastMethod 로 넘긴다), 기본은 표시 없음.
export const fixture: AuthSignInProps = {
  copy: COPY,
  methods: async () => ({ ok: true, data: ["password", "kakao", "naver", "google"] }),
  signIn: async () => ({ ok: true, data: {} }),
}

// 최대: 문구 끝까지.
export const fixtureMax: AuthSignInProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "모아플랜에 로그인해요 — 가족·팀 일정을 한곳에서 이어서 관리하세요(예시)",
    lead: "쓰던 방법으로 로그인하면 일정·할 일·알림 설정이 그대로 있어요. 회사 계정은 관리자가 연결한 방법으로만 로그인할 수 있어요(예시).",
    divider: "또는 가입할 때 쓴 이메일 주소로 로그인",
    alert: { field: "확인이 필요한 칸이 있어요 — 칸 아래 설명을 보고 고쳐 주세요", server: "지금은 로그인하지 못했어요 — 적은 내용은 그대로 있으니 잠시 뒤 다시 눌러 주세요" },
    signUp: { text: "아직 계정이 없으세요? 가입은 1분이면 끝나요.", label: "무료로 가입하기", href: "#sign-up" },
  },
}

// 최소: 머리말·가입 링크 없이, 로그인 방법은 이메일만(갤러리 fx=min 이면 methods 가 password 하나).
export const fixtureMin: AuthSignInProps = {
  ...fixture,
  copy: { ...COPY, lead: undefined, signUp: undefined },
  methods: async () => ({ ok: true, data: ["password"] }),
}

// 갤러리 포트 목: 인증 목(?auth=·&submit=·&state=)과 계측 목(?consent= — 동의가 있을 때만 기록).
export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AuthSignInProps> => {
  const auth = mockAuth(q, {
    methods: g.fx === "min" ? ["password"] : ["password", "kakao", "naver", "google"],
    fieldErrors: { password: ["이메일 또는 비밀번호가 맞지 않아요. 비밀번호를 잊었다면 아래에서 다시 설정해요."] },
    formError: "입력한 내용을 확인해 주세요.",
  })
  const last = q.get("last") ?? (g.fx === "max" ? "kakao" : null)
  return { methods: auth.methods, signIn: auth.signIn, track: mockAnalytics(q, { onTrack: g.onTrack }).track, ...(last ? { lastMethod: last as AuthMethod } : {}) }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: AuthSignInProps = {
  ...fixture,
  copy: {
    title: "Sign in to your account",
    lead: "Sign in the way you did before and your projects are right where you left them (example).",
    social: {
      kakao: "Sign in with Kakao",
      naver: "Sign in with Naver",
      google: "Sign in with Google",
    },
    inApp: {
      title: "Google sign-in may not work in this view",
      guide: "You're in an in-app browser. Open the ⋯ menu at the top right and choose “Open in another browser”.",
      open: "Open in your default browser",
      copy: {
        copy: "Copy address",
        copied: "Address copied",
        manual: "Copying was blocked. Please copy the address from the address bar.",
      },
    },
    divider: "Or sign in with email",
    email: {
      label: "Email",
      marker: "(Required)",
      placeholder: "name@example.com",
    },
    password: {
      label: "Password",
      marker: "(Required)",
      show: "Show password",
      capsLock: "Caps Lock is on",
    },
    errors: {
      emailRequired: "Enter your email address.",
      emailFormat: "That email address doesn't look right. Example: name@example.com",
      passwordRequired: "Enter a password.",
    },
    forgot: {
      label: "Forgot your password?",
      href: "#password-reset",
    },
    submit: "Sign in",
    pending: "Signing you in",
    alert: {
      field: "Some fields need checking",
      server: "We couldn't sign you in. Your entries are still here.",
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
    methods: {
      loading: "Loading sign-in options",
      error: "We couldn't load the quick sign-in buttons. You can still sign in with email.",
      retry: "Reload",
    },
    signUp: {
      text: "New here?",
      label: "Sign up for free",
      href: "#sign-up",
    },
    done: {
      title: "You're signed in",
      body: "Taking you to your dashboard (example).",
      label: "Go to your dashboard",
      href: "#today",
    },
    twoFactor: {
      title: "Verification code needed",
      body: "Enter the 6-digit code from your authenticator app to finish signing in.",
      label: "Enter code",
      href: "#two-factor",
    },
    emailSent: {
      title: "We sent you a sign-in link",
      body: "Click the link in your inbox to sign in. It works for 10 minutes (example).",
    },
    rememberMe: {
      label: "Keep me signed in",
    },
    lastUsed: {
      badge: "Last used",
      password: "You signed in with email last time",
    },
  },
}
