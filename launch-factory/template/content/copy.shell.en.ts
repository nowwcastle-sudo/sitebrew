// 영어 예시 문구 3부 — 제품 쉘(위 띠·바닥글)·오류 화면·쿠키 환경설정 대화상자(LFADA · web-factory v0.0.10 P3-6 WFBLK-B). 제품이 콘텐츠로 바꾼다.
// copy.en.ts(가입·결제 블록)·copy.ux.en.ts(문의·가격 변경 동의·오류 글·머리말)와 나눈 까닭: 이 파일은 모든 쪽에 보이는 틀(머리·바닥)과 그 틀이 쪽을 잃었을 때의 화면 글이다.
// 사업자 정보 값은 여기에 없다 — 바닥글 블록이 읽는 값은 제품 설정(LF_BUSINESS_* 환경 변수, @launch-factory/env businessInfo)이고, 빈 칸은 그리지 않는다. 라벨(상호·대표자 …)만 이 파일에 있다.
import type { FooterProductLegalCopy } from "@/components/blocks/footer/product-legal"
import type { NavAccountBarCopy } from "@/components/blocks/nav/account-bar"
import type { StateScreenErrorRetryCopy } from "@/components/blocks/state-screen/error-retry"
import type { StateScreenLoadingCopy } from "@/components/blocks/state-screen/loading"
import type { StateScreenNotFoundCopy } from "@/components/blocks/state-screen/not-found"
import type { ConsentPrefsCopy } from "@/components/blocks/_shared/consent-prefs"
// 값 import 는 상대 경로(.ts) — node 시험이 별칭(@/)을 못 푼다(lib/auth-next.ts 와 같다). 형식 import 는 지워지므로 별칭을 써도 된다
import { PRODUCT_NAME } from "./copy.en.ts"
// 지워진 기능(시안을 얹을 때 고르지 않은 것)의 쪽으로 가는 링크는 enabled 로 거른다 — 템플릿 그대로면 전부 남는다
import { go, hasUrl, linksOn } from "../lib/launch/enabled.ts"

/** 쪽을 열었을 때 로그인한 사람의 계정 메뉴에 들어가는 링크 — 계정 화면의 구획과 결제 관리 */
const ACCOUNT_LINKS = linksOn([
  { label: "Account", href: "/account" },
  { label: "Billing", href: "/account/billing" },
])

/** 위 띠(N10) — 로그아웃은 [Sign in]·[Create an account], 로그인은 계정 메뉴(Account · Billing · Sign out). 로그인한 사람에게 Sign in 이 남지 않는다 */
export const navCopy: NavAccountBarCopy = {
  brand: PRODUCT_NAME,
  navLabel: "Main",
  links: linksOn([{ label: "Pricing", href: "/pricing" }]),
  signedOut: { signIn: { label: "Sign in", href: "/sign-in" }, signUp: { label: "Create an account", href: "/sign-up" } },
  signedIn: { menuLabel: "Account", links: ACCOUNT_LINKS, signedInAs: "Signed in as {who}", signOutLabel: "Sign out" },
}

/**
 * 바닥글(K03·K04). 링크는 있는 것만 그린다 — 문의·약관·개인정보·환불은 모든 제품 쪽에 닿는 길이다(K05·K10).
 * 「쿠키 설정」은 쿠키 띠(consent/bottom-banner)가 같은 쪽에 있으면 그것이 항목별 대화상자를 연다. JS 가 없거나 띠가 없으면 href 가 동작한다 — 처리방침의 쿠키 항목(4번)이 있는 쪽이다.
 */
export const footerCopy: FooterProductLegalCopy = {
  brand: PRODUCT_NAME,
  navLabel: "Help and legal",
  links: {
    terms: { label: "Terms", href: "/terms" },
    privacy: { label: "Privacy", href: "/privacy" },
    ...(hasUrl("/refund") ? { refund: { label: "Refunds", href: "/refund" } } : {}),
    ...(hasUrl("/contact") ? { contact: { label: "Contact us", href: "/contact" } } : {}),
  },
  cookieSettings: { label: "Cookie settings", href: "/privacy" },
  businessTitle: "Business information",
  businessLabels: {
    name: "Business name",
    owner: "Representative",
    address: "Address",
    phone: "Phone",
    email: "Email",
    registrationNo: "Business registration no.",
    mailOrderNo: "Mail-order business report no.",
    hostingProvider: "Hosting provider",
  },
  copyright: `© ${PRODUCT_NAME}`,
}

/** 건너뛰기 링크 글(J01) */
export const skipLabel = "Skip to main content"

/** 쪽 안에서 난 오류(app/error.tsx)와 루트가 무너졌을 때(app/global-error.tsx). 오류 번호는 서버 로그와 맞는 digest 다 — 문의할 때 알려 주게 한다 */
export const errorScreenCopy: { error: StateScreenErrorRetryCopy; fatal: StateScreenErrorRetryCopy } = {
  error: {
    title: "Something went wrong",
    body: "This is on our side, not yours. What you typed on other pages is not affected.",
    retryLabel: "Try again",
    retryingLabel: "Trying again",
    home: { label: "Back to the start page", href: "/" },
    ...(hasUrl("/contact") ? { support: { label: "Contact us", href: "/contact" } } : {}),
    requestIdLabel: "Error number:",
  },
  fatal: {
    title: "Something went wrong",
    body: "The page could not load. This is on our side, not yours.",
    retryLabel: "Reload the page",
    retryingLabel: "Reloading",
    home: { label: "Back to the start page", href: "/" },
    ...(hasUrl("/contact") ? { support: { label: "Contact us", href: "/contact" } } : {}),
    requestIdLabel: "Error number:",
  },
}

/** 없는 주소(app/not-found.tsx) — 처음으로 하나뿐이면 막다른 길이라(H02) 갈 만한 곳 링크를 둔다 */
export const notFoundCopy: StateScreenNotFoundCopy = {
  title: "Page not found",
  body: "The page you are looking for does not exist or has moved.",
  home: { label: "Back to the start page", href: "/" },
  linksTitle: "Places you may want to go",
  links: linksOn([
    { label: "Pricing", href: "/pricing" },
    { label: "Sign in", href: "/sign-in" },
    { label: "Your account", href: "/account" },
  ]),
  ...(hasUrl("/contact") ? { support: { label: "Still stuck? Contact us", href: "/contact" } } : {}),
}

/** 쪽을 불러오는 동안(app/loading.tsx) — 읽는 도구가 읽는 글(화면에는 뼈대만 보인다) */
export const loadingCopy: StateScreenLoadingCopy = { label: "Loading" }

/** 쿠키 환경설정 대화상자(K04) — 쿠키 띠의 「항목별로 고르기」와 바닥글의 「쿠키 설정」이 같은 대화상자를 연다. 분석은 PostHog(동의 전에는 켜지지 않는다) */
export const consentPreferencesCopy: ConsentPrefsCopy = {
  dialog: {
    title: "Cookie settings",
    description: "Choose which optional cookies we may use. You can change this at any time, and you can still use everything if you decline.",
  },
  necessary: {
    label: "Necessary",
    body: "Keeps you signed in, protects the site, and remembers this choice. The site cannot work without them.",
    always: "Always on",
  },
  categories: {
    analytics: { label: "Analytics", body: "Shows us which pages people use, so we can improve the site. Nothing is recorded until you turn this on." },
    marketing: { label: "Marketing", body: "Lets us record which link or campaign brought you here. Off unless you turn it on." },
  },
  marker: "(optional)",
  save: "Save my choices",
  decline: "Reject all",
  accept: "Accept all",
}

/**
 * 로그인 뒤 시작 쪽(H05) — 구독 상태 한 줄과 다음 행동 하나(lib/home-status.ts 가 상태마다 고른다).
 * {plan} = 요금제 이름(모르면 「current」), {date} = 날짜(쓰는 쪽이 사용자 시간대로 적는다). 날짜를 모르면 그 칸이 없는 말(…NoDate)을 쓴다 — 빈칸을 채워 말하지 않는다.
 */
export const homeCopy = {
  welcome: "Welcome back, {name}",
  welcomeBare: "Welcome back",
  free: "You're on the free plan.",
  expired: "Your last subscription has ended, so you're on the free plan.",
  active: "Your {plan} plan renews on {date}.",
  activeNoDate: "Your {plan} plan is active.",
  trial: "Your {plan} trial ends on {date}.",
  trialNoDate: "Your {plan} trial is running.",
  pastDue: "Your last payment didn't go through.",
  canceled: "Your {plan} plan ends on {date}.",
  canceledNoDate: "Your {plan} plan is set to end.",
  paused: "Your subscription is paused until {date}.",
  pausedNoDate: "Your subscription is paused.",
  actions: {
    upgrade: { label: "Upgrade to a paid plan", href: go("/upgrade", "/account") },
    fixPayment: { label: "Update your payment method", href: go("/account/billing", "/account") },
    keep: { label: "Keep your plan", href: go("/account/billing", "/account") },
    manage: { label: "Manage billing", href: go("/account/billing", "/account") },
  },
}
