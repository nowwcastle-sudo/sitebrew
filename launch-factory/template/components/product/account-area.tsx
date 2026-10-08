import { ConsentHistory, DeleteSection, NotificationsSection, ProfileSection, SectionLink, SecuritySection } from "@/components/product/account-blocks"
import { accountNav, accountPageCopy, consentHistoryCopy } from "@/content/copy.account.en"
import { productMode } from "@/lib/ports"

// 계정 화면의 구획 틀(LFACCT · factory-rules.md §23 U7): 다섯 구획(프로필 · 보안 · 결제 · 알림 · 내 데이터)과 맨 아래 위험 구획(탈퇴). 서버 기능이 있는 계정 행동은 모두 이 쪽에서 닿는다.
// 서버 컴포넌트다. 구획의 순서·제목·바로가기를 정하고, 블록은 클라이언트 잎(account-blocks.tsx)이 서버 액션에 잇는다.
// 앱이 목(키 없음)으로 켜졌는지는 이 파일 한 곳만 안다 — 쪽(app/(product)/account/page.tsx)과 블록은 모른다(template.test.mjs 「블록 쪽 코드는 모드를 모른다」).
// 이유: 계정 서버 액션(auth.ts·account.ts·consents.ts)은 Better Auth 세션을 읽는데, 목 로그인은 목 인증 포트의 메모리 세션이라 둘이 만나지 못한다 — mock 일 때만 목 입구(account-mock.ts)로 간다.
// 로그인하지 않았다면 각 블록이 「로그인이 필요해요」와 로그인 링크를 보인다(블록의 빈 값 상태).
export function AccountArea() {
  const mode = productMode()
  const c = accountPageCopy
  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="font-heading text-3xl">{c.title}</h1>
        <p>{c.lead}</p>
        <nav aria-label={accountNav.label}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {accountNav.items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="underline underline-offset-4">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section id="profile" aria-labelledby="account-profile-title" className="scroll-mt-24">
        <ProfileSection mode={mode} />
      </section>

      <section id="security" aria-labelledby="credentials-title" className="scroll-mt-24 border-t pt-12">
        <SecuritySection mode={mode} />
      </section>

      <section id="billing" aria-labelledby="billing-title" className="scroll-mt-24 space-y-4 border-t pt-12">
        <h2 id="billing-title" className="font-heading text-2xl">
          {c.billing.title}
        </h2>
        <p>{c.billing.body}</p>
        <SectionLink href={c.billing.href}>{c.billing.cta}</SectionLink>
      </section>

      <section id="notifications" aria-labelledby="notification-settings-title" className="scroll-mt-24 border-t pt-12">
        <NotificationsSection mode={mode} />
      </section>

      <section id="my-data" aria-labelledby="my-data-title" className="scroll-mt-24 space-y-6 border-t pt-12">
        <div className="space-y-3">
          <h2 id="my-data-title" className="font-heading text-2xl">
            {c.myData.title}
          </h2>
          <p>{c.myData.body}</p>
          <SectionLink href={c.myData.href}>{c.myData.cta}</SectionLink>
        </div>
        <div className="space-y-3">
          <h3 className="font-heading text-lg">{consentHistoryCopy.title}</h3>
          <p>{consentHistoryCopy.lead}</p>
          <ConsentHistory mode={mode} />
        </div>
      </section>

      <section id="delete-account" aria-labelledby="delete-account-block-title" className="scroll-mt-24 border-t border-destructive/40 pt-12">
        <DeleteSection mode={mode} />
      </section>
    </div>
  )
}
