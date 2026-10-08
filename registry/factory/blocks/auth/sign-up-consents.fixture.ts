import { APPROVAL_HINT } from "@/registry/factory/contract/human-actions"
import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { isCommonPassword } from "./new-password.fixture"
import { EMAIL_ERRORS, SUBMIT_NOTICES } from "./sign-in.fixture"
import type { AuthSignUpConsentsCopy, AuthSignUpConsentsProps } from "./sign-up-consents"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 일정 관리 서비스 「모아플랜(예시)」 가입. 문구는 해요체.
// 갤러리 포트: ?auth= · &submit=ok|field-error|server-error|pending · &state=(methods 읽기) · ?consent=(계측 기록).
// &submit=field-error 는 「이미 가입된 이메일」(code email_exists)이다 — 이메일 칸 오류 + 로그인·비밀번호 찾기 알림(A02). 비밀번호 password1 같은 흔한 값은 isWeakPassword 가 막는다(A03).
// 마케팅 채널은 이 예시 제품이 쓰는 셋(이메일·카카오톡·앱 알림)뿐이다 — 문자는 문구가 없어 그려지지 않는다(A05). fx=max 는 넷 다 그린다.
const COPY: AuthSignUpConsentsCopy = {
  humanHint: APPROVAL_HINT.ko,
  title: "모아플랜 계정 만들기",
  lead: "이메일과 비밀번호만 있으면 바로 시작해요. 이름은 나중에 적어도 돼요(예시).",
  steps: ["계정 정보", "약관 동의", "가입 완료"],
  social: { kakao: "카카오로 시작하기", naver: "네이버로 시작하기", google: "구글 계정으로 시작하기" },
  inApp: {
    title: "이 화면에서는 구글 로그인이 안 될 수 있어요",
    guide: "지금은 앱 안 브라우저로 열려 있어요. 오른쪽 위 ⋯ 메뉴에서 「다른 브라우저로 열기」를 눌러 주세요.",
    open: "기본 브라우저로 열기",
    copy: { copy: "주소 복사", copied: "주소를 복사했어요", manual: "복사가 막혔어요. 주소창의 주소를 직접 복사해 주세요" },
  },
  divider: "또는 이메일로 가입",
  email: { label: "이메일", marker: "(필수)", placeholder: "name@example.com" },
  password: { label: "비밀번호", marker: "(필수)", hint: "8자 이상으로 만들어 주세요.", show: "비밀번호 보기", capsLock: "Caps Lock이 켜져 있어요" },
  errors: { ...EMAIL_ERRORS, passwordShort: "비밀번호가 짧아요. 8자 이상으로 적어 주세요.", passwordWeak: "너무 흔한 비밀번호예요. 다른 단어나 문장으로 8자 이상 만들어 주세요.", termsRequired: "이용약관에 동의해야 가입할 수 있어요.", privacyRequired: "개인정보 수집·이용에 동의해야 가입할 수 있어요." },
  next: "다음 — 약관 보기",
  newTab: "새 탭에서 열려요",
  exists: {
    title: "이미 가입된 이메일이에요",
    body: "이 이메일로 만든 계정이 있어요. 로그인하거나, 비밀번호가 기억나지 않으면 새로 정할 수 있어요(예시).",
    signIn: { label: "로그인하기", href: "#sign-in" },
    reset: { label: "비밀번호 찾기", href: "#password-reset" },
  },
  required: { legend: "꼭 필요한 동의" },
  back: "이전으로",
  consentsTitle: "약관에 동의해 주세요",
  viaSocial: "{provider} 계정으로 가입해요 — 약관에 동의해 주세요",
  providers: { kakao: "카카오", naver: "네이버", google: "구글" },
  terms: { label: "이용약관에 동의해요", marker: "(필수)", href: "#terms", view: "약관 보기" },
  privacy: { label: "개인정보 수집·이용에 동의해요", marker: "(필수)", href: "#privacy", view: "내용 보기" },
  ageOver14: { label: "만 14세 이상이에요", marker: "(필수)", help: "만 14세 미만은 보호자 동의가 필요해서 지금은 가입할 수 없어요(예시).", required: "만 14세 이상인지 체크해 주세요." },
  marketing: {
    legend: "혜택·새 기능 소식 받기",
    marker: "(선택)",
    hint: "받지 않아도 가입할 수 있어요. 설정에서 언제든 끌 수 있어요.",
    // 이 제품이 쓰는 채널만(문자 없음, A05)
    channels: { email: "이메일", kakao: "카카오톡", push: "앱 알림" },
  },
  submit: "가입하기",
  pending: "가입하는 중",
  alert: { field: "확인이 필요한 칸이 있어요", server: "가입하지 못했어요 — 적은 내용은 그대로 있어요" },
  notices: SUBMIT_NOTICES,
  methods: { loading: "가입 방법을 불러오는 중이에요", error: "간편 가입 버튼을 불러오지 못했어요. 이메일로는 가입할 수 있어요.", retry: "다시 불러오기" },
  done: { title: "가입했어요", body: "첫 일정을 만들러 가요(예시).", label: "첫 일정 만들기", href: "#first-event" },
  emailSent: { title: "메일을 확인해 주세요", body: "보낸 메일의 링크를 누르면 가입이 끝나요(예시)." },
  signIn: { text: "이미 계정이 있으세요?", label: "로그인하기", href: "#sign-in" },
}

export const fixture: AuthSignUpConsentsProps = {
  copy: COPY,
  methods: async () => ({ ok: true, data: ["password", "kakao", "naver", "google"] }),
  signUp: async () => ({ ok: true, data: {} }),
  // 약한 비밀번호 거르개는 포트가 아니라 앱의 규칙이다 — fixturePorts 가 아니라 여기 둔다(갤러리가 포트 호출로 세지 않도록)
  isWeakPassword: isCommonPassword,
}

export const fixtureMax: AuthSignUpConsentsProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "모아플랜 계정 만들기 — 가족·팀 일정을 한곳에서 챙겨요(예시)",
    lead: "이메일과 비밀번호만 있으면 바로 시작해요. 이름·회사·연락처는 가입한 뒤 필요할 때 적어도 되고, 적지 않아도 모든 기본 기능을 쓸 수 있어요(예시).",
    marketing: { ...COPY.marketing, channels: { ...COPY.marketing.channels, sms: "문자" }, legend: "혜택·새 기능·이벤트 소식 받기", hint: "받지 않아도 가입할 수 있어요. 받기로 해도 설정 > 알림에서 채널마다 언제든 끌 수 있고, 바꾼 결과는 메일로 알려 드려요(예시)." },
  },
}

export const fixtureMin: AuthSignUpConsentsProps = {
  ...fixture,
  copy: { ...COPY, lead: undefined, signIn: undefined },
  methods: async () => ({ ok: true, data: ["password"] }),
}

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<AuthSignUpConsentsProps> => {
  const auth = mockAuth(q, {
    methods: g.fx === "min" ? ["password"] : ["password", "kakao", "naver", "google"],
    fieldErrors: { email: ["이미 가입된 이메일이에요. 로그인하거나 다른 이메일을 적어 주세요."] },
    formError: "입력한 내용을 확인해 주세요.",
    requireAgeOver14: true, // launch-factory 기본과 같다 — 만 14세 체크를 빠뜨린 블록은 갤러리에서 가입이 필드 오류로 끝난다
  })
  // 이미 가입된 이메일은 code 로 알려 준다(A02) — 어댑터가 중복 가입을 email_exists 로 돌려주는 것과 같다
  const signUp: AuthSignUpConsentsProps["signUp"] = async (input) => {
    const r = await auth.signUp(input)
    return !r.ok && r.fieldErrors?.email?.length ? { ...r, code: "email_exists" } : r
  }
  return { methods: auth.methods, signUp, track: mockAnalytics(q, { onTrack: g.onTrack }).track }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: AuthSignUpConsentsProps = {
  ...fixture,
  copy: {
    humanHint: "You'll confirm this yourself",
    title: "Create your account",
    lead: "All you need is an email and a password. You can add your name later (example).",
    steps: ["Account details", "Terms", "Done"],
    social: {
      kakao: "Continue with Kakao",
      naver: "Continue with Naver",
      google: "Continue with Google",
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
    divider: "Or sign up with email",
    email: {
      label: "Email",
      marker: "(Required)",
      placeholder: "name@example.com",
    },
    password: {
      label: "Password",
      marker: "(Required)",
      hint: "Use at least 8 characters.",
      show: "Show password",
      capsLock: "Caps Lock is on",
    },
    errors: {
      emailRequired: "Enter your email address.",
      emailFormat: "That email address doesn't look right. Example: name@example.com",
      passwordRequired: "Enter a password.",
      passwordShort: "That password is too short. Use at least 8 characters.",
      passwordWeak: "That password is too common. Try a different word or phrase with at least 8 characters.",
      termsRequired: "You need to agree to the Terms of Service to sign up.",
      privacyRequired: "You need to agree to the collection and use of personal data to sign up.",
    },
    next: "Next: review the terms",
    newTab: "Opens in a new tab",
    exists: {
      title: "This email is already registered",
      body: "An account already exists for this email. Sign in, or reset your password if you can't remember it (example).",
      signIn: {
        label: "Sign in",
        href: "#sign-in",
      },
      reset: {
        label: "Reset password",
        href: "#password-reset",
      },
    },
    required: {
      legend: "Required consents",
    },
    back: "Back",
    consentsTitle: "Please agree to the terms",
    viaSocial: "You're signing up with your {provider} account. Please agree to the terms.",
    providers: {
      kakao: "Kakao",
      naver: "Naver",
      google: "Google",
    },
    terms: {
      label: "I agree to the Terms of Service",
      marker: "(Required)",
      href: "#terms",
      view: "View terms",
    },
    privacy: {
      label: "I agree to the collection and use of my personal data",
      marker: "(Required)",
      href: "#privacy",
      view: "View details",
    },
    ageOver14: {
      label: "I'm 14 or older",
      marker: "(Required)",
      help: "People under 14 need a guardian's consent and can't sign up right now (example).",
      required: "Please confirm you're 14 or older.",
    },
    marketing: {
      legend: "Get news about offers and new features",
      marker: "(Optional)",
      hint: "Optional. You can sign up without it and turn it off at any time in settings.",
      channels: {
        email: "Email",
        kakao: "KakaoTalk",
        push: "App notifications",
      },
    },
    submit: "Sign up",
    pending: "Signing you up",
    alert: {
      field: "Some fields need checking",
      server: "We couldn't sign you up. Your entries are still here.",
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
      loading: "Loading sign-up options",
      error: "We couldn't load the quick sign-up buttons. You can still sign up with email.",
      retry: "Reload",
    },
    done: {
      title: "You're signed up",
      body: "Let's create your first project (example).",
      label: "Create your first project",
      href: "#first-event",
    },
    emailSent: {
      title: "Check your email",
      body: "Click the link in the email we sent to finish signing up (example).",
    },
    signIn: {
      text: "Already have an account?",
      label: "Sign in",
      href: "#sign-in",
    },
  },
}
