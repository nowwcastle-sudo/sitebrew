import { mockAnalytics, mockAuth, type TrackedEvent } from "@/registry/factory/contract/adapter-mock"

import { SUBMIT_NOTICES } from "../auth/sign-in.fixture"
import type { ConfirmationSignupCompleteCopy, ConfirmationSignupCompleteProps } from "./signup-complete"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 관리 서비스 「예약노트(예시)」 가입 직후 — 14일 체험으로 열린 기능 안내.
// 기본(fx=default·max)은 이메일 확인이 먼저다(A01) — 맨 위가 「메일함을 열어 확인해 주세요」, 가입 완료·열린 기능은 「기다리는 동안」 아래. 최소(fx=min)는 확인 구획 없는 옛 모양이다.
// 갤러리 포트: &auth=signed-out(로그인 안 한 채 — 다음 행동이 「로그인」, A08). fixturePorts 는 verified=1(이미 확인함 — 로그인 안 한 채면 「확인이 끝났어요 — 로그인해 주세요」)도 읽지만
// 갤러리는 PORT_QUERY_KEYS(states.ts)에 없는 쿼리를 넘기지 않아 그 상태는 서버 렌더 시험(auth-blocks-p36.test.mjs)이 본다.
const COPY: ConfirmationSignupCompleteCopy = {
  title: "가입을 마쳤어요",
  body: "14일 동안 프로 요금제의 모든 기능을 무료로 써 볼 수 있어요. 카드는 받지 않았어요.",
  unlockedTitle: "지금 바로 쓸 수 있는 것",
  unlocked: ["예약 페이지 1개와 예약 링크", "방문 전날 안내 문자 월 300건", "직원 3명까지 같은 예약표 보기"],
  nextTitle: "다음에 일어날 일",
  next: [{ title: "체험 끝 안내", when: "10월 12일, 끝나기 3일 전에 알려 드려요" }],
  confirm: {
    title: "메일함을 열어 이메일을 확인해 주세요",
    body: "{email} 주소로 확인 메일을 보냈어요. 메일의 링크를 눌러야 가입이 끝나요.",
    spam: "메일이 안 보이면 스팸함이나 프로모션함을 먼저 살펴보세요. 그래도 없으면 아래에서 다시 보낼 수 있어요.",
    meanwhile: "기다리는 동안",
    resend: { label: "인증 메일 다시 보내기", pending: "보내는 중", wait: "{seconds}초 뒤에 다시 보낼 수 있어요", sent: "확인 메일을 다시 보냈어요. 몇 분 안에 도착해요.", errorTitle: "메일을 보내지 못했어요 — 잠시 뒤 다시 눌러 주세요" },
    wrongAddress: { text: "주소가 잘못됐나요?", label: "이메일 바꾸기", href: "#settings-credentials" },
  },
  notices: SUBMIT_NOTICES,
  signIn: { title: "이메일 확인이 끝났어요 — 로그인해 주세요", body: "확인을 마쳤어요. 로그인하면 14일 체험을 바로 쓸 수 있어요(예시).", primary: { label: "로그인하기", href: "#sign-in" } },
  help: { text: "시작이 막히면", link: { label: "시작 안내 보기", href: "#help-start" } },
  primary: { label: "예약 페이지 만들기", href: "#create-page" },
  print: "인쇄·PDF로 저장",
}

export const fixture: ConfirmationSignupCompleteProps = { copy: COPY, email: "kim@example.com", resendVerification: async () => ({ ok: true, data: { sent: true } }), resendAfter: 60 }

export const fixtureMax: ConfirmationSignupCompleteProps = {
  ...fixture,
  copy: {
    ...COPY,
    title: "가입을 마쳤어요 — 14일 동안 프로 요금제를 무료로 써 보세요",
    body: "14일 동안 프로 요금제의 모든 기능을 무료로 써 볼 수 있어요. 카드는 받지 않았고, 체험이 끝나도 저절로 결제되지 않아요. 계속 쓰려면 그때 요금제를 고르면 돼요(예시).",
    unlocked: [...COPY.unlocked, "예약금 받기(결제 연결은 설정에서)", "손님 메모와 방문 기록 무제한 보관"],
    confirm: { ...COPY.confirm!, body: "{email} 주소로 확인 메일을 보냈어요. 메일의 링크를 눌러야 가입이 끝나고, 링크는 24시간 동안만 쓸 수 있어요. 다른 사람의 주소로 가입됐다면 이 메일은 무시해도 돼요(예시).", spam: "메일이 안 보이면 스팸함이나 프로모션함, 회사 메일이라면 보안 격리함까지 먼저 살펴보세요. 그래도 없으면 아래에서 다시 보낼 수 있어요. 다시 보내면 앞에 보낸 메일의 링크는 쓸 수 없어요(예시)." },
    next: [...COPY.next, { title: "첫 주 사용 요약", when: "10월 8일 아침, 받은 예약과 노쇼 수를 정리해 보내요" }],
  },
}

// 최소: 확인 구획 없는 옛 모양(copy.confirm 없음 — 이메일 확인이 따로 필요 없는 가입, 또는 확인을 다른 화면이 안내할 때)
export const fixtureMin: ConfirmationSignupCompleteProps = { copy: { ...COPY, confirm: undefined, signIn: undefined, unlocked: [], next: [COPY.next[0]] } }

export const fixturePorts = (q: URLSearchParams, g: { fx: string; onTrack: (e: TrackedEvent) => void }): Partial<ConfirmationSignupCompleteProps> => {
  const a = mockAnalytics(q, { onTrack: g.onTrack })
  if (g.fx === "min") return { track: a.track }
  const auth = mockAuth(q.has("auth") ? q : new URLSearchParams([...q, ["auth", "signed-in"]]))
  // 결과 상태(&submit=)를 잴 때는 대기 시간 없이 시작한다(verify-email 과 같다)
  const hold = q.has("submit") ? { resendAfter: 0 } : {}
  return { track: a.track, signedIn: q.get("auth") !== "signed-out", emailVerified: q.get("verified") === "1", resendVerification: auth.sendVerificationEmail, ...hold }
}

// 영어 장면(FV1 FOLLOW) — 영어 사이트의 06 이 이 예시를 쓴다(gen-pages fixtureOf(b, { locale: "en" })). 큰 제품 화면은 한글 잎이 수십 개라 번역표·화면 문구 칸으로 닫히지 않았다. 한국어 예시와 짜임이 같고 글만 영어다 — 사업 이름·업종 낱말 없이 쓴다.
export const fixtureEn: ConfirmationSignupCompleteProps = {
  ...fixture,
  copy: {
    title: "You're all set",
    body: "You can try every Pro feature free for 14 days. We didn't ask for a card.",
    unlockedTitle: "What you can use right now",
    unlocked: ["1 project and a share link", "300 reminder messages a month", "Up to 3 teammates in the same workspace"],
    nextTitle: "What happens next",
    next: [
      {
        title: "Trial ending notice",
        when: "We'll let you know on Oct 12, three days before it ends",
      },
    ],
    confirm: {
      title: "Open your inbox and confirm your email",
      body: "We sent a confirmation email to {email}. Click the link in it to finish signing up.",
      spam: "If you don't see it, check your spam or promotions folder first. If it's still missing, you can resend it below.",
      meanwhile: "While you wait",
      resend: {
        label: "Resend verification email",
        pending: "Sending",
        wait: "You can send again in {seconds} seconds",
        sent: "We sent the confirmation email again. It should arrive within a few minutes.",
        errorTitle: "We couldn't send the email. Please try again in a moment.",
      },
      wrongAddress: {
        text: "Wrong address?",
        label: "Change email",
        href: "#settings-credentials",
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
    signIn: {
      title: "Email confirmed. Please sign in.",
      body: "You're confirmed. Sign in to start your 14-day trial right away (example).",
      primary: {
        label: "Sign in",
        href: "#sign-in",
      },
    },
    help: {
      text: "If you get stuck",
      link: {
        label: "See the getting-started guide",
        href: "#help-start",
      },
    },
    primary: {
      label: "Create your first project",
      href: "#create-page",
    },
    print: "Print or save as PDF",
  },
}
