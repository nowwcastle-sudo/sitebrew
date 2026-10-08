import * as React from "react"
import { cn } from "cn"
import { uiLabels, type UiLocale } from "@/registry/factory/r/r5-celadon/ui/locale-labels"
import { SiteShellNavList, SiteShellStrip } from "@/registry/factory/r/r5-celadon/ui/site-shell-nav"
import { type ArchetypeId, type Business, type Cta } from "@/registry/factory/content/content-core"
import { normalizePhone } from "@/registry/factory/lib/phone"

// 빈 h1 을 만들 수 없게(리뷰 M-12): undefined·null·true 는 타입에서 막고, 빈 글자·빈 목록은 그리지 않는다(개발에서는 경고 한 줄).
type PageTitle = Exclude<React.ReactNode, null | undefined | boolean> | false
const isEmptyTitle = (v: React.ReactNode): boolean =>
  v == null || typeof v === "boolean" || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.every(isEmptyTitle))

type SiteShellProps = {
  /** 원형 id — 루트에 data-archetype 으로 단다. dashboard 이면 정밀 포인터에서 조밀 표·아이콘 버튼의 24px 히트 예외가 켜진다. */
  archetype: ArchetypeId
  /** 홈으로 가는 로고 링크(이미지 alt = 회사명·기관명). H1 이 아니다. */
  logo: React.ReactNode
  /**
   * 페이지의 h1 — main 맨 앞에 하나만 그린다(DESIGN §12 「H1 하나」). false 면 셸이 h1 을 그리지 않는다 — 그때는 children(히어로 블록)이 h1 을
   * 하나 가진다. 값이 있으면 children 안에는 h1 을 두지 않는다. 빠뜨리면 h1 이 조용히 사라지므로 필수이고, 끄는 것은 false 로만 한다.
   */
  pageTitle: PageTitle
  /** main 의 콘텐츠 폭 한계 — content(기본, 75rem = 1200px)·wide(90rem = 1440px)·full(한계 없음, 전폭 히어로). DESIGN 「페이지 최대 폭 1200~1440px」. */
  width?: "content" | "wide" | "full"
  /** 주 메뉴 — 콘텐츠 객체의 Cta 목록. */
  nav?: Cta[]
  /** 지금 페이지 주소 — 같은 href 의 메뉴에 aria-current="page". */
  currentHref?: string
  navLabel?: string
  /** 부품이 스스로 그리는 접근 이름·기본 안내 글의 로캘(ko 기본 — locale-labels). navLabel·bannerLabel·skipLabel 을 주면 그 값이 앞선다. */
  locale?: UiLocale
  /** 유틸리티 링크(글자 크기·언어·로그인 등). DOM·탭 순서에서 로고 다음, 주 메뉴 앞(KRDS 헤더 순서). */
  utility?: React.ReactNode
  /** 검색. 유틸리티 다음, 주 메뉴 앞(KRDS 헤더 순서). */
  search?: React.ReactNode
  /** 헤더 오른쪽 행동(예약·가입 버튼) — 주 메뉴 다음. */
  actions?: React.ReactNode
  /** 건너뛰기 링크 바로 다음, 헤더 위 띠(공공기관 공식 배너 등). 이름 붙은 region 으로 감싸고 고정 헤더에 넣지 않는다. */
  banner?: React.ReactNode
  bannerLabel?: string
  /** 푸터 사업자 정보 칸(상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처 + 공정위 조회·약관·개인정보 링크). */
  business?: Business
  /** 푸터 링크 등 사업자 정보 위에 둘 내용. */
  footer?: React.ReactNode
  /**
   * 헤더 고정 여부. 모든 폭에서 헤더가 위에 붙는다(375px 에서도 — ux-gate 「고정 내비」, P3-2 D4). 768px 이상의 고정 방식(스티키 바·떠 있는 섬)과
   * 높이는 레시피의 헤더 축 값이 정하고, 768px 미만은 한 줄 스티키 바다. 이 값은 끄는 스위치다.
   * 켜져 있으면 data-sticky-nav 가 붙어 factory-base 의 scroll-padding-top(5rem)이 건너뛰기 목적지·포커스를 헤더 아래로 내린다.
   */
  sticky?: boolean
  skipLabel?: string
  mainId?: string
  className?: string
  children?: React.ReactNode
}

// 가로로 스크롤하는 주 메뉴(768px 이상)에서 포커스된 링크를 다 보이게 한다. Chrome 은 일부만 보이는 요소에 포커스가 가면 스크롤하지 않는다
// (Task 11 리뷰 I2 실측 — 22px 가 잘린 채 남았다). 그 일만 클라이언트 조각 SiteShellNavList(site-shell-nav.tsx)가 맡고,
// SiteShell 자체는 서버 컴포넌트다(T11-N1).

// 헤더의 위치·배경·현재 위치 밑줄은 부품이 CSS 변수의 기본값으로 쓰고, 헤더 축 값의 훅이 변수를 정해 바꾼다
// (컴파일러는 훅 토큰을 문자열 앞에 넣으므로 같은 속성의 클래스로는 부품 기본값을 덮을 수 없다 — cn 은 뒤가 이긴다).
//   --site-shell-position(기본 sticky) · --site-shell-inner-position(기본 static, H2 섬은 fixed) · --site-shell-bg(기본 --background)
//   · --site-shell-current-line(현재 위치 밑줄, 기본 underline). 모든 폭에서 붙는다 — 값 훅은 768px 이상에서만 위치 변수를 바꾼다(P3-2 D4).
// WCAG 2.5.8 44px 히트 영역 식(부품 규칙 — 모양과 무관).
// main 콘텐츠 폭(P3-2 D1) — 레시피 모양이 아니라 배치 규칙이라 훅이 아니라 부품에 둔다(훅에 두면 규칙 불변 검사가 막는다).
const WIDTH = "[--site-shell-width:75rem] data-[width=wide]:[--site-shell-width:90rem] data-[width=full]:[--site-shell-width:none]"
const HIT = "relative after:absolute after:inset-y-[min(0px,calc((100%-44px)/2))] after:inset-x-[min(0px,calc((100%-44px)/2))]"

/**
 * 한국 사업자 정보(전자상거래법 제10조 표시 사항). 값이 있는 항목만 dl 로 그린다. 전화는 tel: 링크,
 * 통신판매업신고번호 옆에 공정위 「사업자정보 확인」 링크, 끝에 이용약관·개인정보 처리방침 링크(있을 때).
 */
function SiteShellBusinessInfo({ business, locale, className }: { business: Business; locale?: UiLocale; className?: string }) {
  const L = uiLabels(locale)
  const link = (href: string, label: React.ReactNode) => (
    <a href={href} className={cn("underline underline-offset-4", HIT)}>
      {label}
    </a>
  )
  const rows: [string, React.ReactNode][] = [
    [L.bizName, business.legalName && business.legalName !== business.name ? `${business.name}(${business.legalName})` : business.name],
    [L.bizRepresentative, business.representative],
    [L.bizRegNo, business.bizRegNo],
    [
      L.bizMailOrderNo,
      business.mailOrderNo ? (
        <>
          {business.mailOrderNo}
          {business.ftcLookupUrl ? <> {link(business.ftcLookupUrl, L.bizLookup)}</> : null}
        </>
      ) : null,
    ],
    [L.bizAddress, business.address],
    [
      L.bizContact,
      <>
        {link(`tel:${normalizePhone(business.phone) ?? business.phone}`, business.phone)}
        {business.email ? <> · {link(`mailto:${business.email}`, business.email)}</> : null}
      </>,
    ],
  ]
  return (
    <>
      <dl data-slot="site-shell-business" className={cn("pt-4 gap-x-6 gap-y-6 flex flex-wrap", className)}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="gap-x-2 flex">
              <dt className="font-medium text-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {business.termsUrl || business.privacyUrl ? (
        <p data-slot="site-shell-policy" className="pt-6 gap-x-6 gap-y-6 flex flex-wrap">
          {business.termsUrl ? link(business.termsUrl, L.terms) : null}
          {business.privacyUrl ? <strong className="text-foreground">{link(business.privacyUrl, L.privacy)}</strong> : null}
        </p>
      ) : null}
    </>
  )
}

/**
 * 「본문으로 건너뛰기」 링크(J01) — 쪽의 첫 Tab 이 닿는 첫 요소여야 하므로 문서에서 가장 먼저 둔다. 보이는 때는 포커스를 받았을 때뿐이다. 목적지는 mainId(기본 main)의 `<main id tabIndex={-1}>` —
 * SiteShell 은 둘 다 직접 그린다. SiteShell 을 쓰지 않는 제품 레이아웃(자기 헤더를 가진 앱 쪽)은 `<body>` 맨 앞에 이 링크를, 본문에 `<main id="main" tabIndex={-1}>` 를 둔다. 서버 부품이다.
 */
function SiteShellSkipLink({ mainId = "main", label, locale }: { mainId?: string; label?: string; locale?: UiLocale }) {
  return (
    <a
      href={`#${mainId}`}
      data-slot="site-shell-skip-link"
      className="rounded-[12px] px-4 py-3 text-base font-medium bg-primary text-primary-foreground fixed top-2 start-2 z-50 -translate-y-[200%] focus:translate-y-0"
    >
      {label ?? uiLabels(locale).siteSkip}
    </a>
  )
}

/**
 * 페이지 뼈대: 건너뛰기 링크 → (띠 region) → header(로고 → 유틸리티 → 검색 → 주 메뉴 → 행동) → main#main(h1 하나 — pageTitle={false} 면 children 이 가진다) → footer(사업자 정보).
 * 랜드마크는 header·nav·main·footer 하나씩이다. 서버 컴포넌트다 — 서버 페이지·레이아웃에서 그대로 쓴다.
 * 헤더는 모든 폭에서 한 줄 고정 높이이고 넘치는 메뉴는 가로로 스크롤한다(포커스하면 저절로 보인다) — 그래서 고정 헤더의 높이가 내용과
 * 상관없이 정해지고 scroll-padding 과 맞는다. 375px 에서 로고·유틸리티·검색·행동은 줄지 않으니 그 합이 폭을 넘지 않게 짧게 둔다.
 */
function SiteShell({
  archetype,
  logo,
  pageTitle,
  width = "content",
  nav,
  currentHref,
  navLabel,
  locale,
  utility,
  search,
  actions,
  banner,
  bannerLabel,
  business,
  footer,
  sticky = true,
  skipLabel,
  mainId = "main",
  className,
  children,
}: SiteShellProps) {
  if (pageTitle !== false && isEmptyTitle(pageTitle) && process.env.NODE_ENV !== "production")
    console.warn("[SiteShell] pageTitle 이 비었다 — h1 을 그리지 않는다. 페이지 제목을 넣거나, 히어로 블록이 h1 을 가지면 pageTitle={false} 로 끈다.")
  const FooterTag = footer ? "div" : "footer"
  const utilityEl = utility ? (
    <div data-slot="site-shell-utility" className="gap-x-3 gap-y-1 text-sm flex shrink-0 flex-wrap items-center">
      {utility}
    </div>
  ) : null
  const searchEl = search ? (
    <div data-slot="site-shell-search" className="shrink-0">
      {search}
    </div>
  ) : null
  const navEl = nav?.length ? (
    <nav aria-label={navLabel ?? uiLabels(locale).siteNav} data-slot="site-shell-nav" className="h-full min-w-0 flex-1 max-md:flex-none">
      <SiteShellNavList className="gap-0.5 md:py-1 flex h-full flex-nowrap items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((item) => (
          <li key={item.href} className="shrink-0">
            <a
              href={item.href}
              aria-current={currentHref === item.href ? "page" : undefined}
              className={cn("min-h-10 rounded-full px-4 text-sm font-medium aria-[current=page]:bg-muted aria-[current=page]:font-semibold [--site-shell-current-line:none] inline-flex items-center whitespace-nowrap hover:bg-muted focus-visible:-outline-offset-2 aria-[current=page]:underline-offset-4 aria-[current=page]:[text-decoration-line:var(--site-shell-current-line,underline)]", HIT)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </SiteShellNavList>
    </nav>
  ) : null
  const actionsEl = actions ? (
    <div data-slot="site-shell-actions" className="gap-2 ms-auto flex shrink-0 flex-wrap items-center">
      {actions}
    </div>
  ) : null
  return (
    <div data-slot="site-shell" data-archetype={archetype} className={cn("flex min-h-dvh flex-col bg-background text-foreground", className)}>
      <SiteShellSkipLink mainId={mainId} label={skipLabel} locale={locale} />
      {banner ? (
        <div role="region" aria-label={bannerLabel ?? uiLabels(locale).siteBanner} data-slot="site-shell-banner">
          {banner}
        </div>
      ) : null}
      <header
        data-slot="site-shell-header"
        data-sticky-nav={sticky ? "" : undefined}
        className={cn("border-b md:h-[4.5rem] md:border-b-0 md:[--site-shell-bg:transparent] md:[--site-shell-position:static] top-0 z-40 bg-[var(--site-shell-bg,var(--background))] [position:var(--site-shell-position,sticky)]", !sticky && "static!")}
      >
        <div
          data-slot="site-shell-header-inner"
          className={cn("min-h-14 gap-x-2 px-4 py-2 md:[--site-shell-inner-position:fixed] md:min-h-0 md:inset-x-0 md:top-6 md:z-40 md:mx-auto md:h-12 md:w-max md:max-w-[calc(100%-3rem)] md:rounded-full md:bg-background md:px-2 md:py-0 md:ring-1 md:ring-foreground/10 md:in-data-sticky-nav:bg-background/75 md:in-data-sticky-nav:backdrop-blur-md md:in-data-sticky-nav:contrast-more:bg-background md:in-data-sticky-nav:contrast-more:backdrop-blur-none md:in-data-sticky-nav:[@media(prefers-reduced-transparency:reduce)]:bg-background md:in-data-sticky-nav:[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none flex flex-nowrap items-center max-md:relative md:[position:var(--site-shell-inner-position,static)]", !sticky && "static!")}
        >
          {/* 375px: 긴 로고 글자는 말줄임(…)으로 줄이고 폭의 절반을 넘지 않는다 — 나머지 칸이 0 이 되지 않게 */}
          <div data-slot="site-shell-logo" className="shrink-0 max-md:min-w-0 max-md:max-w-1/2 max-md:shrink max-md:[&>a]:block max-md:[&>a]:truncate">
            {logo}
          </div>
          {/* 768px 미만: 유틸리티·검색·주 메뉴·행동은 한 줄로 가로 스크롤하는 띠 안에 든다(메뉴로 옮김 — 헤더는 한 줄 그대로, 탭 순서 그대로). 768px 이상은 display: contents 라 예전 배치 그대로다. */}
          <SiteShellStrip className="max-md:gap-x-2 contents max-md:flex max-md:h-full max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden" menuLabel={uiLabels(locale).siteMenu} utility={utilityEl} search={searchEl} nav={navEl} actions={actionsEl} />
        </div>
      </header>
      <main id={mainId} tabIndex={-1} data-slot="site-shell-main" data-width={width} className={cn("mx-auto w-full max-w-(--site-shell-width) flex-1 outline-none", WIDTH)}>
        {pageTitle === false || isEmptyTitle(pageTitle) ? null : <h1 className="px-4 pt-8 text-3xl font-semibold md:px-6">{pageTitle}</h1>}
        {children}
      </main>
      {/* 푸터 랜드마크(contentinfo)는 하나다 — footer 에 푸터 블록(자기 <footer> 를 가진다)을 주면 바깥은 div 로 두어 <footer> 가 겹쳐 들어가지 않게 하고(axe landmark-contentinfo-is-top-level·landmark-no-duplicate-contentinfo), 사업자 정보만 있으면 이 칸이 <footer> 다. */}
      <FooterTag data-slot="site-shell-footer" className="border-t px-4 py-10 text-sm md:px-6 text-muted-foreground">
        {footer}
        {business ? <SiteShellBusinessInfo business={business} locale={locale} /> : null}
      </FooterTag>
    </div>
  )
}

export { SiteShell, SiteShellBusinessInfo, SiteShellSkipLink, type SiteShellProps }
