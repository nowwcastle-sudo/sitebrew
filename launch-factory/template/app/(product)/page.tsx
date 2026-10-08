import Link from "next/link"
import { plans, session, subscription } from "@/app/actions/product"
import { PRODUCT_NAME } from "@/content/copy.en"
import { homeCopy } from "@/content/copy.shell.en"
import { homeStatus } from "@/lib/home-status"
import { DISPLAY_LOCALE, displayTimeZone } from "@/lib/locale"

// 시작 쪽(v0 Task 10) — 제품마다 찍어낸 판매 페이지가 이 자리를 바꾼다. 지금은 템플릿이 갖춘 제품 화면으로 가는 길만 둔다.
// 제품 화면 공통 틀(app/(product)/layout.tsx) 안에 둔다(UXOK): 위 띠가 로그인 상태를 보이고, 소셜 가입·로그인과 확인 메일 링크가 돌아오는 자리라 「됐어요」 안내가 여기 뜬다.
// 링크는 로그인 상태를 따른다 — 로그인한 사람에게 Sign in·Create an account 를 보이지 않는다(대표 실측 10-03: 로그인해도 가운데에 Sign in 이 남아 헷갈림).
// H05: 로그인한 사람에게는 환영 + 구독 상태 한 줄 + 다음 행동 하나(lib/home-status.ts)가 먼저 나온다. 「Upgrade」는 고정 링크가 아니라 상태가 정한다(무료·끝남일 때만 그 행동으로) — 유료 사용자에게 보이지 않는다.
type NavLink = { href: string; label: string }
const SIGNED_OUT: NavLink[] = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/sign-up", label: "Create an account" },
  { href: "/pricing", label: "Pricing" },
]
const SIGNED_IN: NavLink[] = [
  { href: "/account", label: "Account" },
  { href: "/account/billing", label: "Billing" },
  { href: "/pricing", label: "Pricing" },
]

export default async function HomePage() {
  const s = await session().catch(() => null)
  const user = s?.ok && s.data ? s.data : null
  if (!user) return <Home links={SIGNED_OUT} />
  const [sub, offered] = await Promise.all([subscription().catch(() => null), plans().catch(() => null)])
  const current = sub?.ok && sub.data ? sub.data : null
  const planName = offered?.ok ? offered.data.find((p) => p.id === current?.planId)?.name : undefined
  const zone = displayTimeZone(user.timeZone)
  const status = homeStatus(current, planName, (iso) => new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: zone, dateStyle: "long" }).format(new Date(iso)))
  return <Home links={SIGNED_IN.filter((l) => l.href !== status.action?.href)} welcome={user.name ? homeCopy.welcome.replace("{name}", user.name) : homeCopy.welcomeBare} status={status} />
}

function Home({ links, welcome, status }: { links: NavLink[]; welcome?: string; status?: ReturnType<typeof homeStatus> }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
      <h1 className="font-heading text-2xl">{PRODUCT_NAME}</h1>
      {welcome ? <p className="text-base leading-[1.7]">{welcome}</p> : null}
      {status?.text ? (
        <section aria-label="Your plan" data-home-status="" className="flex flex-col items-start gap-3">
          <p className="text-base leading-[1.7]">{status.text}</p>
          {status.action ? (
            <Link href={status.action.href} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-hidden">
              {status.action.label}
            </Link>
          ) : null}
        </section>
      ) : null}
      <nav aria-label="Product pages">
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="underline underline-offset-4">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
