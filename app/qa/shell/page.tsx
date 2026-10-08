// /qa/shell — SiteShell 고정 헤더 검수대(Task 11 리뷰 I1·I2). ?h=H1|H2|H3|H4 로 헤더 축 값을 고른다(없으면 base). ?sticky=0 이면 sticky={false}(흐르는 헤더 — 블러가 없어야 한다, Task 6 리뷰 M1).
// factory/qa/shell-focus.mjs 가 768·1024px 에서 아래쪽 링크까지 Tab 으로 가며 헤더 바닥 ≤ 포커스 위쪽을 잰다. 이름·숫자는 모두 예시다.
import * as G from "@/.tmp/axes/gallery"
import { SiteShell as BaseShell } from "@/registry/factory/ui/site-shell"

const NAV = [
  { label: "메뉴", href: "/qa/shell#menu" },
  { label: "오시는 길", href: "/qa/shell#directions" },
  { label: "영업시간", href: "/qa/shell#hours" },
  { label: "예약 안내", href: "/qa/shell#booking" },
  { label: "단체 주문", href: "/qa/shell#group" },
  { label: "자주 묻는 질문", href: "/qa/shell#faq" },
]
const BIZ = {
  name: "달빛베이커리(예시)",
  representative: "김예시",
  bizRegNo: "123-45-67890",
  mailOrderNo: "제2026-서울마포-0000호(예시)",
  address: "서울특별시 마포구 예시로 12, 1층",
  phone: "02-1234-5678",
  // 사업자 정보 링크 줄 간격(P3-2 D5)을 hit-area 로 재려고 링크 칸을 모두 채운다.
  email: "hello@example.com",
  ftcLookupUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890",
  termsUrl: "/qa/shell#terms",
  privacyUrl: "/qa/shell#privacy",
}

// ?wide=1 — 공개(public) 원형처럼 긴 로고 + 유틸리티 + 검색 + 행동 둘이 함께 있는 헤더(대장 A131). 375px 에서도 한 줄이고 넘치지 않는지 shell-focus 가 잰다.
// ?bar=1 — 화면 아래 고정 바 56px + scroll-padding-bottom(하단 고정 요소, 대장 A107). &pad=0 이면 여백을 뺀다(음성 대조 — 포커스가 바에 가려져야 한다).
export default async function QaShellPage({ searchParams }: { searchParams: Promise<{ h?: string; sticky?: string; wide?: string; bar?: string; pad?: string }> }) {
  const { h, sticky, wide, bar, pad } = await searchParams
  const isWide = wide === "1"
  const v = G.header.find((x) => x.id === h)
  const Shell = v ? v.ui["site-shell"].SiteShell : BaseShell
  return (
    <Shell
      archetype="local"
      sticky={sticky !== "0"}
      logo={<a href="/qa/shell">{isWide ? "달빛베이커리 합정점 · 수제 빵과 케이크 전문점(예시)" : "달빛베이커리(예시)"}</a>}
      pageTitle={`셸 고정 헤더 검수 — ${v ? v.id : "base"}`}
      nav={NAV}
      currentHref="/qa/shell#menu"
      utility={isWide ? <><a href="/qa/shell#size">글자 크기</a><a href="/qa/shell#lang">English</a><a href="/qa/shell#login">로그인</a></> : undefined}
      search={isWide ? <a href="/qa/shell#search">검색</a> : undefined}
      actions={isWide ? <><a href="tel:0212345678">전화 예약</a><a href="/qa/shell#booking">온라인 예약</a></> : <a href="tel:0212345678">전화 예약</a>}
      business={BIZ}
    >
      <div data-qa="shell-body">
        {Array.from({ length: 12 }, (_, i) => (
          <section key={i} id={`s${i}`} style={{ minHeight: 420 }}>
            <p>구역 {i + 1}(예시)</p>
            <a data-qa="shell-link" href={`/qa/shell#s${i}`}>
              구역 {i + 1} 링크(예시)
            </a>
          </section>
        ))}
      </div>
      {bar === "1" ? (
        <>
          <style>{pad === "0" ? "" : "html{scroll-padding-bottom:56px}"}</style>
          <div data-qa="shell-bar" style={{ position: "fixed", insetInline: 0, bottom: 0, height: 56, background: "var(--muted)", borderTop: "1px solid var(--border)", zIndex: 30 }}>
            <span>하단 고정 바(예시)</span>
          </div>
        </>
      ) : null}
    </Shell>
  )
}
