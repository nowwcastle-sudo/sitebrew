import type { Metadata } from "next"

import { SiteShell } from "@/components/ui/site-shell"
import { locale, shellProps } from "@/lib/site"
import { NOT_FOUND_COPY } from "@/lib/system-copy"

// 없는 주소(Next 16 not-found 규약) — 사이트 셸(머리·주 메뉴) 안에서 안내하고 홈으로 이어 준다. 상태는 404 이고 noindex 는 Next 가 붙인다.
const t = NOT_FOUND_COPY[locale === "en" ? "en" : "ko"]

export const metadata: Metadata = { title: t.title }

export default function NotFound() {
  const { action, ...shell } = shellProps("/404")
  return (
    <SiteShell {...shell} pageTitle={t.title} actions={action ? <a href={action.href}>{action.label}</a> : undefined}>
      <div className="flex flex-col items-start gap-4 px-4 py-8 md:px-8">
        <p>{t.body}</p>
        <a href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
          {t.home}
        </a>
      </div>
    </SiteShell>
  )
}
