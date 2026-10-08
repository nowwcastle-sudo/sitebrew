import type { NavAccountBarProps } from "./account-bar"

// 예시 콘텐츠(갤러리·검사용 — 설치하지 않는다). 가상 예약 앱 「Example Product」. 갤러리 포트: ?auth=signed-out(기본)|signed-in — 인증 포트 목과 같은 쿼리로 세션 prop 을 정한다.
const COPY = {
  brand: "Example Product",
  navLabel: "Main menu",
  links: [
    { label: "Pricing", href: "#pricing" },
    { label: "Docs", href: "#docs" },
    { label: "Contact", href: "#contact" },
  ],
  signedOut: { signIn: { label: "Sign in", href: "#sign-in" }, signUp: { label: "Sign up", href: "#sign-up" } },
  signedIn: {
    menuLabel: "Account",
    links: [
      { label: "Account settings", href: "#account" },
      { label: "Billing", href: "#billing" },
    ],
    signedInAs: "Signed in as {who}",
    signOutLabel: "Sign out",
  },
}

export const fixture: NavAccountBarProps = { locale: "en", copy: COPY, session: { status: "signed-out" }, currentHref: "#pricing", signOutAction: "#sign-out" }

// 최대: 로그인 상태 + 긴 이름·긴 링크.
export const fixtureMax: NavAccountBarProps = {
  locale: "en",
  copy: {
    ...COPY,
    brand: "Example Product — long product name for the header (example)",
    links: [
      { label: "Pricing and plans", href: "#pricing" },
      { label: "Documentation", href: "#docs" },
      { label: "Changelog", href: "#changelog" },
      { label: "Customer stories", href: "#stories" },
      { label: "Contact support", href: "#contact" },
      { label: "Status", href: "#status" },
    ],
  },
  session: { status: "signed-in", name: "Example Person With A Rather Long Display Name", email: "example.person@example.com" },
  currentHref: "#docs",
  signOutAction: "#sign-out",
}

// 최소: 로그아웃 상태 · 링크 하나.
export const fixtureMin: NavAccountBarProps = { locale: "en", copy: { ...COPY, links: [COPY.links[0]] }, session: { status: "signed-out" } }

// 갤러리 포트: ?auth=signed-in 이면 로그인 상태(이름·메일은 가짜 값).
export const fixturePorts = (q: URLSearchParams): Partial<NavAccountBarProps> =>
  q.get("auth") === "signed-in" ? { session: { status: "signed-in", name: "Example Person", email: "person@example.com" }, signOutAction: "#sign-out" } : {}
