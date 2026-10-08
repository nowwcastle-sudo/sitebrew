"use client"

// 대표 장면(Task 8 — 레시피 보드): /qa/recipes?r=<id>&scene=<장면>[&alt=B|<축+축>][&theme=light|dark].
// 카탈로그(factory/scripts/recipe.mjs SCENES)의 장면을 레시피 컴파일 부품(r/<id>/ui)만으로 조합한다 — 블록이 아니다(블록은 P3-2).
// 면 색(K6·K7 field-*, K8 block-*)은 bg-field-*·bg-block-* 에 data-face 를 함께 달아 면 스코프 토큰(recipe.mjs faceRules)을 받는다.
// 면 안 글자는 제목·짧은 이름표·버튼만 둔다 — 20자 넘는 본문은 바탕 위에 두어 본문 7:1(ux-gate)을 지킨다(면 글자 목표 7은 레시피에 따라 경고).
// 역동 기법은 그 선택지(A 또는 B)의 dynamics 에 있는 것만 클래스로 켠다(scenes.css). 문구는 한국어·가상 이름 + 「예시」.
import * as React from "react"

import type { Recipe } from "./specimen"
// B안 축 목록은 생성물 하나(gen-recipes-gallery.mjs altAxesModule ← recipe.mjs ALT_AXES)에서 온다(Task 10c fix 1 — 리뷰 M4).
import { ALT_AXES } from "@/.tmp/recipes/gallery"
// 히어로 카탈로그(Task 10d) — 생성물(gen-recipes-gallery.mjs heroesModule ← recipe.mjs HEROES): id → app/qa/recipes/heroes/<id>.tsx.
import { heroes } from "@/.tmp/recipes/heroes"
import { Face as FaceBase } from "./heroes/parts"

// 장면이 받는 선택지: faces = 이 선택지에서 칠할 면(없으면 골격 — 바탕 위에 선으로 나눈다), dyn = 이 선택지의 역동 기법.
export type Option = { faces: string[]; dyn: Set<string>; motion: string }
type SceneProps = { r: Recipe; o: Option; picks?: string[] }

// 면 구획: 면이 있으면 bg + data-face, 없으면 골격 대체(선 구획). 면 → 클래스 대응과 렌더는 heroes/parts.tsx 하나에서 온다 — 장면은 기본값만 다르다.
function Face({ fallback = "border", as = "section", ...p }: React.ComponentProps<typeof FaceBase>) {
  return <FaceBase fallback={fallback} as={as} {...p} />
}
const faceAt = (o: Option, i: number) => (o.faces.length ? o.faces[i % o.faces.length] : undefined)
const cx = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ")

// 글자 분할 등장(split-text): 글자마다 span(aria-hidden), 읽기는 sr-only 원문으로 한 번.
function Split({ text, on }: { text: string; on: boolean }) {
  if (!on) return <>{text}</>
  // 낱말 단위로 줄을 바꾸고(낱말 span 은 inline-block), 글자마다 지연을 준다 — 줄 첫머리에 공백 글자가 남지 않는다.
  let i = 0
  return (
    <span>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((w, wi) => (
        <React.Fragment key={wi}>
          {wi > 0 && " "}
          <span aria-hidden="true" className="wf-split inline-block">
            {[...w].map((c) => (
              <span key={i} style={{ ["--i" as string]: i++ } as React.CSSProperties}>
                {c}
              </span>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

// 오버사이즈 타입 크롭(oversize-crop)·블렌드(blend): 장식 글자 — 감싼 div 가 자른다.
function Crop({ word, o, className = "" }: { word: string; o: Option; className?: string }) {
  if (!o.dyn.has("oversize-crop") && !o.dyn.has("blend")) return null
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div className={cx("wf-crop font-heading absolute -right-[0.08em] -bottom-[0.12em] opacity-90", o.dyn.has("blend") ? "wf-blend" : "opacity-15")}>{word}</div>
    </div>
  )
}

const HERO: Record<string, { tag: string; title: string; sub: string; cta: string; alt: string; word: string }> = {
  local: { tag: "솔밭 식당(예시)", title: "숲길 끝, 저녁 여섯 시에 문을 엽니다", sub: "하루 열두 자리만 받습니다. 제철 나물과 장작 구이를 한 상에 차립니다. 예약은 전날 저녁 여덟 시까지 받습니다.", cta: "자리 예약", alt: "오늘 차림 보기", word: "저녁" },
  commerce: { tag: "장터 목판(예시)", title: "손으로 찍은 달력, 이번 장에 마흔 부", sub: "배나무 판에 두 도수로 찍었습니다. 종이는 닥나무 한지이고, 한 장씩 결이 다릅니다. 장이 서는 토요일에만 보냅니다.", cta: "장바구니 담기", alt: "찍는 과정 보기", word: "木版" },
  brand: { tag: "신호 연구소(예시)", title: "한 줄로 말하고, 크게 보입니다", sub: "간판·포스터·화면에 같은 목소리를 씁니다. 흑과 백 두 색으로 시작해 필요한 곳에만 색을 더합니다.", cta: "작업 의뢰", alt: "지난 작업", word: "SIGNAL" },
  portfolio: { tag: "고요 도예(예시)", title: "비색 한 점, 여백 한 칸", sub: "굽 높이와 유약 두께를 바꿔 가며 서른 번 구웠습니다. 전시는 가을 한 달 동안 작업실에서 엽니다.", cta: "전시 예약", alt: "작업 노트", word: "靑" },
  detail: { tag: "고요 도예(예시)", title: "비색 한 점, 여백 한 칸", sub: "굽 높이와 유약 두께를 바꿔 가며 서른 번 구웠습니다. 한 달에 여섯 점만 내놓습니다.", cta: "구매하기", alt: "작업 노트", word: "靑" },
}

function HeroDisplay({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const c = HERO[r.archetypes[0]] ?? HERO.brand
  const k = faceAt(o, 0)
  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Face k={k} fallback="border-b lg:border-b-0 lg:border-e" label="첫 화면" className={cx("relative isolate flex min-h-[26rem] flex-col justify-end gap-6 overflow-hidden px-6 py-12 md:px-12 md:py-16", o.dyn.has("clip-reveal") && "wf-clip", o.dyn.has("grain") && "wf-grain")}>
        <Crop word={c.word} o={o} />
        <p className="text-sm font-bold tracking-[0.02em]">{c.tag}</p>
        <h1 className={cx("font-heading max-w-[14ch] text-[clamp(2.441rem,5.6vw,4.768rem)] leading-[1.08] tracking-[-0.02em] text-balance", o.dyn.has("variable-axis") && "wf-wght")}>
          <Split text={c.title} on={o.dyn.has("split-text")} />
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">{c.cta}</Button>
          <Button size="lg" variant="outline">
            {c.alt}
          </Button>
        </div>
      </Face>
      <div className="flex flex-col justify-end gap-5 px-6 py-10 md:px-10">
        <p className="max-w-[36ch] leading-[1.75]">{c.sub}</p>
        <dl className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <dt className="text-sm text-muted-foreground">문 여는 날</dt>
            <dd className="font-heading text-[1.563rem] tabular-nums">화–일</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">하루 자리</dt>
            <dd className="font-heading text-[1.563rem] tabular-nums">12석</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

// 대시보드형 장면의 상단 바 — 면이 있으면 면(K6 × dashboard: 면을 한두 곳으로).
function TopBar({ r, o, title }: SceneProps & { title: string }) {
  const { Button } = r.ui.button
  const { IconButton } = r.ui["icon-button"]
  const { Search } = r.glyphs
  return (
    <Face k={faceAt(o, 0)} as="header" fallback="border-b" label="상단 바" className={cx("flex flex-wrap items-center gap-3 px-4 py-3 md:px-6", o.dyn.has("clip-reveal") && "wf-clip")}>
      <p className="font-heading text-[1.25rem] leading-[1.3]">{title}</p>
      <span className="text-sm text-muted-foreground">오늘 09:00 기준</span>
      <div className="ms-auto flex items-center gap-2">
        <IconButton icon={Search} label="찾기" variant="ghost" />
        <Button size="sm" variant="outline">
          내보내기
        </Button>
      </div>
    </Face>
  )
}

const num = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 })
const STRIP = [
  { label: "이번 주 처리", value: 1284, unit: "건" },
  { label: "평균 응답", value: 2.4, unit: "초" },
  { label: "실패율", value: 0.8, unit: "%" },
  { label: "다음 주 예측", value: 1410, unit: "건" },
]
const WEEKS = [
  { w: "8/31", v: 920 },
  { w: "9/7", v: 1040 },
  { w: "9/14", v: 1110 },
  { w: "9/21", v: 1284 },
  { w: "9/28", v: 1410, f: true },
  { w: "10/5", v: 1480, f: true },
]

function DataStrip({ r, o }: SceneProps) {
  const max = 1600
  return (
    <div className="flex flex-col">
      <TopBar r={r} o={o} title="처리량 계기판(예시)" />
      <dl className="grid grid-cols-2 border-b md:grid-cols-4">
        {STRIP.map((k, i) => (
          <div key={k.label} className={cx("flex flex-col gap-1 px-4 py-5 md:px-6", i % 2 === 1 && "border-s", i >= 2 && "border-t md:border-t-0", i === 2 && "md:border-s")}>
            <dt className="text-sm text-muted-foreground">{k.label}</dt>
            <dd className="font-heading tabular-nums">
              <span className="text-[2.441rem] leading-none font-light">{num.format(k.value)}</span>
              <span className="ms-1 text-[1.1rem] text-muted-foreground">{k.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-8 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <figure className="flex min-w-0 flex-col gap-3">
          <div className="flex h-56 items-end gap-3" role="img" aria-label="주별 처리량 막대. 마지막 두 주는 예측(빗금)">
            {WEEKS.map((b) => (
              <div key={b.w} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-sm tabular-nums">{num.format(b.v)}</span>
                <div className={cx("w-full border", b.f ? "wf-hatch text-primary" : "bg-primary")} style={{ height: `${(b.v / max) * 160}px` }} />
                <span className="text-sm tabular-nums text-muted-foreground">{b.w}</span>
              </div>
            ))}
          </div>
          <figcaption className="text-sm leading-[1.7] text-muted-foreground">주별 처리 건수(예시). 칠한 막대는 실제, 빗금 막대는 예측입니다.</figcaption>
        </figure>
        <figure className="flex min-w-0 flex-col gap-3">
          <svg viewBox="0 0 240 90" className={cx("h-24 w-full text-primary", o.dyn.has("svg-draw") && "wf-draw")} role="img" aria-label="응답 시간 추이 선">
            <polyline pathLength={1} fill="none" stroke="currentColor" strokeWidth="2" points="0,70 30,62 60,66 90,40 120,48 150,30 180,36 210,22 240,26" />
          </svg>
          <figcaption className="text-sm leading-[1.7] text-muted-foreground">평균 응답 시간은 지난 8주 동안 3.1초에서 2.4초로 줄었습니다.</figcaption>
        </figure>
      </div>
    </div>
  )
}

const LEDGER = [
  { claim: "합류점 탁도 기준 초과", source: "현장 측정지 9/26", conf: "높음", at: "09:12" },
  { claim: "지류 흙탕물 유입", source: "상류 영상 판독", conf: "중간", at: "08:40" },
  { claim: "센서 오염 가능성", source: "교정 기록 비교", conf: "낮음", at: "08:05" },
  { claim: "하류 수온 정상 범위", source: "자동 측정 96회", conf: "높음", at: "07:30" },
]
const CONF: Record<string, string> = { 높음: "bg-success text-success-foreground", 중간: "bg-warning text-warning-foreground", 낮음: "border-foreground bg-background text-foreground" }

function Ledger({ r, o }: SceneProps) {
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } = r.ui.table
  const { Badge } = r.ui.badge
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } = r.ui.card
  const { Button } = r.ui.button
  return (
    <div className="flex flex-col">
      <TopBar r={r} o={o} title="근거 장부(예시)" />
      <div className="grid gap-8 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto p-1">
          <Table>
            <TableCaption>판단마다 근거와 신뢰도를 적습니다(예시). 신뢰도는 글자로도 적어 색만으로 전하지 않습니다.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>판단</TableHead>
                <TableHead>근거</TableHead>
                <TableHead>신뢰도</TableHead>
                <TableHead className="text-right">기록 시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEDGER.map((l) => (
                <TableRow key={l.claim}>
                  <TableCell>{l.claim}</TableCell>
                  <TableCell>{l.source}</TableCell>
                  <TableCell>
                    <Badge className={l.conf === "낮음" ? CONF[l.conf] : `border-transparent ${CONF[l.conf]}`}>{l.conf}</Badge>
                  </TableCell>
                  <TableCell data-numeric className="text-right">
                    {l.at}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>오늘의 결론</CardTitle>
            <CardDescription>근거 4건 가운데 높음 2건(예시)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-[1.7]">합류점 탁도는 비 때문에 올랐고, 센서 오염 가능성은 낮습니다. 내일 오전에 다시 잽니다.</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">결론 확정</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

const MENU = [
  { name: "들기름 막국수", price: 9000 },
  { name: "장작 삼겹 한 판", price: 18000 },
  { name: "솔잎 두부 구이", price: 12000 },
  { name: "제철 나물 비빔", price: 10000 },
  { name: "송화 식혜", price: 4000 },
]
const won = new Intl.NumberFormat("ko-KR")

function MenuBoard({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const { Input } = r.ui.input
  const { Label } = r.ui.label
  const k = faceAt(o, 0)
  return (
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Face k={k} fallback="border-b lg:border-b-0 lg:border-e" label="오늘의 차림" className={cx("relative isolate flex flex-col gap-6 overflow-hidden px-6 py-10 md:px-12 md:py-14", o.dyn.has("clip-reveal") && "wf-clip", o.dyn.has("grain") && "wf-grain")}>
        <Crop word="차림" o={o} />
        <h2 className={cx("font-heading text-[clamp(2.441rem,4.4vw,3.815rem)] leading-[1.1]", o.dyn.has("variable-axis") && "wf-wght")}>
          <Split text="오늘의 차림(예시)" on={o.dyn.has("split-text")} />
        </h2>
        <ul className="flex max-w-[34rem] flex-col">
          {MENU.map((m) => (
            <li key={m.name} className="flex items-baseline gap-3 border-b border-current/30 py-3 text-[1.25rem]">
              <span>{m.name}</span>
              <span aria-hidden="true" className="flex-1 border-b border-dotted border-current/40" />
              <span className="tabular-nums">{won.format(m.price)}원</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">자리 예약</Button>
          <Button size="lg" variant="outline">
            포장 주문
          </Button>
        </div>
      </Face>
      <div className="flex flex-col gap-6 px-6 py-10 md:px-10">
        <p className="max-w-[36ch] leading-[1.75]">재료가 떨어지면 차림에서 지웁니다. 막국수 면은 매일 아침 열두 그릇만 뽑습니다.</p>
        <dl className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <dt className="text-sm text-muted-foreground">점심</dt>
            <dd className="tabular-nums">11:30–14:30</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">저녁</dt>
            <dd className="tabular-nums">17:30–21:00</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${r.id}-menu-phone`}>예약 연락처</Label>
          <Input id={`${r.id}-menu-phone`} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" />
        </div>
      </div>
    </div>
  )
}

const NOTICES = [
  { cat: "공지", title: "10월 주민센터 운영 시간 변경 안내", dept: "민원행정과", date: "2026. 9. 25." },
  { cat: "민원", title: "전입 신고 온라인 접수 방법", dept: "주민등록팀", date: "2026. 9. 22." },
  { cat: "공지", title: "추석 연휴 쓰레기 배출일 조정", dept: "환경관리과", date: "2026. 9. 18." },
  { cat: "민원", title: "여권 발급 소요 기간 안내", dept: "여권민원팀", date: "2026. 9. 11." },
]

function NoticeList({ r, o }: SceneProps) {
  const { Input } = r.ui.input
  const { Button } = r.ui.button
  const { Label } = r.ui.label
  const { Badge } = r.ui.badge
  const { Tabs, TabsList, TabsTrigger } = r.ui.tabs
  const [tab, setTab] = React.useState<string>("all")
  const pick = (v: string) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => void }
    if (o.dyn.has("view-transition") && d.startViewTransition) d.startViewTransition(() => setTab(v))
    else setTab(v)
  }
  const rows = NOTICES.filter((n) => tab === "all" || n.cat === tab)
  return (
    <div className="flex flex-col">
      <Face k={faceAt(o, 0)} as="header" fallback="border-b" label="민원 안내 머리" className={cx("flex min-h-[18rem] flex-col justify-end gap-5 px-4 py-10 md:px-10 md:py-14", o.dyn.has("clip-reveal") && "wf-clip")}>
        <p className="text-sm font-bold">누리구청(예시)</p>
        <h1 className="font-heading text-[clamp(1.953rem,3.4vw,3.052rem)] leading-[1.15]">공지와 민원 안내</h1>
        <form className="flex max-w-2xl flex-col gap-2" onSubmit={(e) => e.preventDefault()} role="search">
          <Label htmlFor={`${r.id}-notice-q`}>찾을 말</Label>
          <div className="flex gap-2">
            <Input id={`${r.id}-notice-q`} placeholder="예: 전입 신고" />
            <Button type="submit">검색</Button>
          </div>
        </form>
      </Face>
      <div className="flex flex-col gap-4 px-4 py-8 md:px-10">
        <Tabs value={tab} onValueChange={(v) => pick(String(v))}>
          <TabsList aria-label="분류">
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="공지">공지</TabsTrigger>
            <TabsTrigger value="민원">민원</TabsTrigger>
          </TabsList>
        </Tabs>
        <ul className="flex flex-col border-t" aria-label="공지 목록">
          {rows.map((n) => (
            <li key={n.title} className="grid gap-1 border-b py-4 md:grid-cols-[5rem_minmax(0,1fr)_9rem_8rem] md:items-center md:gap-4">
              <span>
                <Badge variant="outline">{n.cat}</Badge>
              </span>
              <a href={`#${r.id}`} className="inline-flex min-h-11 items-center text-[1.1rem] underline-offset-4 hover:underline">
                {n.title}
              </a>
              <span className="text-sm text-muted-foreground">{n.dept}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{n.date}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function DocPage({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const TOC = ["시작하기 전에", "설치", "첫 문서 만들기", "함께 쓰기"]
  return (
    <div className="flex flex-col">
      <Face k={faceAt(o, 0)} as="header" fallback="border-b" label="문서 머리" className={cx("relative isolate flex min-h-[18rem] flex-col justify-end gap-4 overflow-hidden px-4 py-10 md:px-10 md:py-14", o.dyn.has("clip-reveal") && "wf-clip")}>
        <Crop word="DOC" o={o} />
        <p className="text-sm font-bold">작업대 안내서(예시) · 3판</p>
        <h1 className={cx("font-heading max-w-[20ch] text-[clamp(1.953rem,3.8vw,3.052rem)] leading-[1.15] text-balance", o.dyn.has("variable-axis") && "wf-wght")}>
          <Split text="첫 문서를 10분 안에 만드는 법" on={o.dyn.has("split-text")} />
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button>따라 하기</Button>
          <Button variant="outline">PDF로 받기</Button>
        </div>
      </Face>
      <div className="grid gap-10 px-4 py-10 md:grid-cols-[12rem_minmax(0,1fr)] md:px-10">
        <nav aria-label="이 문서의 차례" className="md:sticky md:top-20 md:self-start">
          <p className="mb-2 text-sm font-bold">차례</p>
          <ol className="flex flex-col">
            {TOC.map((t, i) => (
              <li key={t}>
                <a href={`#${r.id}`} aria-current={i === 1 ? "true" : undefined} className={cx("inline-flex min-h-11 items-center border-s-2 ps-3", i === 1 ? "border-primary font-bold" : "border-transparent text-muted-foreground")}>
                  {t}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="flex max-w-[68ch] flex-col gap-5">
          <h2 className="font-heading text-[1.563rem] leading-[1.3]">설치</h2>
          <p className="leading-[1.8]">작업대는 브라우저에서 바로 열립니다. 팀 주소를 받았다면 로그인만 하면 되고, 처음 쓰는 팀이라면 관리자에게 초대를 요청합니다.</p>
          <div className={cx("flex flex-col gap-3", o.dyn.has("sticky-stack") && "[&>*]:sticky [&>*]:top-20")}>
            {["1. 팀 주소 열기", "2. 초대 메일의 링크 누르기", "3. 첫 문서 이름 정하기"].map((s, i) => (
              <p key={s} className="border bg-background px-4 py-3" style={o.dyn.has("sticky-stack") ? { top: `${5 + i * 0.75}rem` } : undefined}>
                {s}
              </p>
            ))}
          </div>
          <p className="leading-[1.8]">문서는 자동으로 저장됩니다. 저장 버튼을 찾지 않아도 되고, 이전 판은 오른쪽 기록에서 언제든 되돌릴 수 있습니다.</p>
          <pre className="overflow-x-auto border p-4 text-sm">
            <code className="font-mono">npx 작업대 init --팀 누리</code>
          </pre>
        </article>
      </div>
    </div>
  )
}

function Vessel({ o }: { o: Option }) {
  return (
    <svg viewBox="0 0 200 240" className={cx("h-full max-h-[22rem] w-auto", o.dyn.has("svg-draw") && "wf-draw")} aria-hidden="true">
      <path pathLength={1} d="M70 20 h60 v18 c0 10 -10 16 -10 28 c0 22 44 40 44 92 c0 40 -30 62 -54 62 h-20 c-24 0 -54 -22 -54 -62 c0 -52 44 -70 44 -92 c0 -12 -10 -18 -10 -28 z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path pathLength={1} d="M52 150 c30 12 66 12 96 0" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function ProductHero({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const { ToggleGroup, ToggleGroupItem } = r.ui["toggle-group"]
  const { Badge } = r.ui.badge
  const [size, setSize] = React.useState<string[]>(["m"])
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 py-8 md:py-12">
      <Face k={faceAt(o, 0)} fallback="border" label="제품 그림" className={cx("relative isolate flex h-[22rem] items-center justify-center overflow-hidden md:h-[30rem]", o.dyn.has("clip-reveal") && "wf-clip", o.dyn.has("grain") && "wf-grain", o.dyn.has("tilt-3d") && "wf-tilt")}>
        <Vessel o={o} />
        <p className="absolute start-4 bottom-4 text-sm">제품 그림 자리(예시)</p>
      </Face>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">한 달 여섯 점</Badge>
          <Badge variant="outline">무료 배송</Badge>
        </div>
        <h1 className={cx("font-heading text-[clamp(1.953rem,4vw,3.052rem)] leading-[1.15]", o.dyn.has("variable-axis") && "wf-wght")}>
          <Split text="비색 매병, 굽 낮은 판(예시)" on={o.dyn.has("split-text")} />
        </h1>
        <p className="font-heading text-[1.953rem] tabular-nums">
          186,000<span className="ms-1 text-[1.1rem] text-muted-foreground">원</span>
        </p>
        <p className="max-w-[60ch] leading-[1.8]">유약을 세 번 입혀 비색이 깊습니다. 한 점씩 손으로 빚어 높이가 조금씩 다르고, 상자에 굽는 날짜를 적어 보냅니다.</p>
        <div className="flex flex-col gap-2">
          <p id={`${r.id}-size`} className="text-sm font-bold">
            크기
          </p>
          <ToggleGroup value={size} onValueChange={(v) => setSize(v as string[])} aria-labelledby={`${r.id}-size`}>
            <ToggleGroupItem value="s">작은 것</ToggleGroupItem>
            <ToggleGroupItem value="m">보통</ToggleGroupItem>
            <ToggleGroupItem value="l">큰 것</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">구매하기</Button>
          <Button size="lg" variant="outline">
            장바구니 담기
          </Button>
        </div>
      </div>
    </div>
  )
}

function AppShell({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const { Card, CardHeader, CardTitle, CardDescription } = r.ui.card
  const { Home, Search, Heart, User } = r.glyphs
  const [tab, setTab] = React.useState("home")
  const pick = (v: string) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => void }
    if (o.dyn.has("view-transition") && d.startViewTransition) d.startViewTransition(() => setTab(v))
    else setTab(v)
  }
  const TABS = [
    { id: "home", label: "홈", icon: Home },
    { id: "search", label: "찾기", icon: Search },
    { id: "saved", label: "저장", icon: Heart },
    { id: "me", label: "내 정보", icon: User },
  ]
  const items = ["말랑 머그 굽는 날", "주말 공방 두 자리", "유약 색 고르기"]
  return (
    <Face k={faceAt(o, 2)} fallback="" className="flex justify-center md:px-8 md:py-10">
      <div data-face-reset className="flex w-full max-w-[420px] flex-col border bg-background text-foreground">
        <Face k={faceAt(o, 0)} as="header" fallback="border-b" label="앱 머리" className="flex items-center gap-3 px-4 py-3">
          <p className="font-heading text-[1.25rem]">말랑 공방(예시)</p>
          <Button size="sm" variant="outline" className="ms-auto">
            알림
          </Button>
        </Face>
        <div className="flex flex-col gap-4 p-4">
          <Face k={faceAt(o, 1)} fallback="border" label="이번 주 소식" className={cx("flex min-h-[15rem] flex-col justify-end gap-3 p-5", o.dyn.has("clip-reveal") && "wf-clip")}>
            <p className="text-sm font-bold">이번 주</p>
            <h1 className="font-heading text-[1.953rem] leading-[1.15]">
              <Split text="토요일 가마 엽니다" on={o.dyn.has("split-text")} />
            </h1>
            <Button className="self-start">자리 잡기</Button>
          </Face>
          <p className="leading-[1.7]">가마는 오전 열 시에 불을 넣고 오후 네 시에 꺼냅니다(예시).</p>
          <div className={cx("flex flex-col gap-3", o.dyn.has("sticky-stack") && "[&>*]:sticky [&>*]:top-16")}>
            {items.map((t, i) => (
              <Card key={t} className={o.dyn.has("tilt-3d") ? "wf-tilt" : undefined}>
                <CardHeader>
                  <CardTitle>{t}</CardTitle>
                  <CardDescription>{["9월 30일", "두 자리 남음", "여섯 가지"][i]}(예시)</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
        <nav aria-label="앱 탭" className="mt-auto grid grid-cols-4 border-t">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => pick(t.id)} className={cx("flex min-h-14 flex-col items-center justify-center gap-1 text-sm", tab === t.id ? "font-bold text-foreground" : "text-muted-foreground")}>
              <t.icon aria-hidden="true" size={20} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </Face>
  )
}

function Bento({ r, o }: SceneProps) {
  const { Button } = r.ui.button
  const { Checkbox } = r.ui.checkbox
  const { Label } = r.ui.label
  const { Input } = r.ui.input
  // 칸마다 면 하나(K8은 네 칸, K6·K7은 면 수만큼 돌려 쓴다 — 면이 하나면 큰 칸만 칠하고 나머지는 선).
  const cell = (i: number) => (o.faces.length > i ? o.faces[i] : undefined)
  return (
    <div className="grid gap-3 p-4 md:grid-cols-3 md:p-6">
      <Face k={cell(0)} label="큰 칸" className={cx("relative isolate flex min-h-[20rem] flex-col justify-end gap-5 overflow-hidden p-6 md:col-span-2 md:row-span-2 md:min-h-[30rem] md:p-10", o.dyn.has("clip-reveal") && "wf-clip", o.dyn.has("grain") && "wf-grain")}>
        <Crop word="47" o={o} />
        <p className="text-sm font-bold">이번 달(예시)</p>
        <h2 className={cx("font-heading max-w-[14ch] text-[clamp(2.441rem,4.6vw,3.815rem)] leading-[1.08]", o.dyn.has("variable-axis") && "wf-wght")}>
          <Split text="새 작업 마흔일곱 점" on={o.dyn.has("split-text")} />
        </h2>
        <Button size="lg" className="self-start">
          전부 보기
        </Button>
      </Face>
      <Face k={cell(1)} label="숫자 칸" className={cx("flex flex-col gap-2 p-6", o.dyn.has("tilt-3d") && "wf-tilt")}>
        <p className="text-sm">다시 찾은 손님</p>
        <p className="font-heading text-[3.052rem] leading-none tabular-nums">62%</p>
      </Face>
      <Face k={cell(2)} label="알림 칸" className="flex flex-col justify-between gap-4 p-6">
        <p className="font-heading text-[1.563rem] leading-[1.2]">새 작업 알림</p>
        <div className="flex items-center gap-2">
          <Checkbox id={`${r.id}-bento-notify`} defaultChecked />
          <Label htmlFor={`${r.id}-bento-notify`}>문자로 받기</Label>
        </div>
      </Face>
      <Face k={cell(3)} label="구독 칸" className="flex flex-col gap-3 p-6 md:col-span-3 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor={`${r.id}-bento-mail`}>소식 받을 메일</Label>
          <Input id={`${r.id}-bento-mail`} type="email" autoComplete="email" placeholder="name@example.com" />
        </div>
        <Button>구독</Button>
      </Face>
      <p className="max-w-[60ch] leading-[1.75] md:col-span-3">칸 크기가 곧 순서입니다. 큰 칸에 이번 달 소식을, 작은 칸에 숫자와 알림 설정을 둡니다(예시).</p>
    </div>
  )
}

function Missing({ id }: { id: string }) {
  return (
    <p data-scene-missing role="note" className="border border-destructive p-4">
      장면 {id} 은 아직 그리지 않았습니다 — 상업 무료·라이선스 사진 자산이 필요합니다(P3-2).
    </p>
  )
}

// 첫 화면 히어로(Task 10d): A는 머리 hero, hero 축을 고르면(alt=B 또는 picks 에 hero) alternates.hero 구성을 그린다.
function HeroScene({ r, o, picks = [] }: SceneProps) {
  const id = picks.includes("hero") ? r.alt?.hero : r.hero
  const Hero = id ? heroes[id] : undefined
  // 칸(article)과 같은 레시피 속성 — 히어로의 DarkZone 이 안쪽 구역에 다시 단다(아래 Scene 의 article 속성과 같은 규칙).
  const zone = {
    "data-recipe": r.id,
    "data-alt-color": picks.includes("colorLogic") ? "" : undefined,
    "data-alt-motion": picks.includes("motion") ? "" : undefined,
    "data-alt-fonts": picks.includes("fonts") ? "" : undefined,
  }
  return Hero ? <Hero r={r} o={o} zone={zone} /> : <Missing id={`hero(${id ?? "머리에 hero 없음"})`} />
}

export const SCENES: Record<string, (p: SceneProps) => React.ReactElement> = {
  hero: HeroScene,
  "hero-display": HeroDisplay,
  "data-strip": DataStrip,
  ledger: Ledger,
  "menu-board": MenuBoard,
  "notice-list": NoticeList,
  "doc-page": DocPage,
  "product-hero": ProductHero,
  "app-shell": AppShell,
  bento: Bento,
}

// alt: null = A, "B" = B 전체, 그 밖에는 축 목록("colorLogic+motion"). 칸에 data-alt-color·data-alt-motion·data-alt-fonts 를 달아 B 색·모션·제목 서체 변수를 받는다.
export function parseAlt(r: Recipe, alt: string | null): string[] {
  if (!alt || !r.alt) return []
  const all = ALT_AXES.filter((k) => r.alt?.[k] != null)
  if (alt === "B") return [...all]
  return alt.split(/[+, ]/).filter((k) => (all as readonly string[]).includes(k))
}

export function Scene({ r, scene, picks, dark, fontClass }: { r: Recipe; scene: string; picks: string[]; dark: boolean; fontClass: string }) {
  const color = picks.includes("colorLogic")
  const o: Option = {
    faces: (color ? r.alt?.faces : r.faces) ?? [],
    dyn: new Set<string>((picks.includes("dynamics") ? r.alt?.dynamics : r.dynamics) ?? []),
    // 모션 강도(Task 11): B 가 motion 을 바꾸면 그 값 — 히어로 안무(motion-gsap)가 거리·연쇄·유휴 반복을 정한다.
    motion: (picks.includes("motion") && r.alt?.motion) || r.motion,
  }
  const Render = SCENES[scene]
  return (
    <div className={dark ? "dark" : undefined}>
      <article
        id={r.id}
        data-recipe={r.id}
        data-scene={scene}
        data-option={picks.length ? picks.join("+") : "A"}
        data-alt-color={color ? "" : undefined}
        data-alt-motion={picks.includes("motion") ? "" : undefined}
        data-alt-fonts={picks.includes("fonts") ? "" : undefined}
        aria-label={`${r.name} 대표 장면 ${scene}`}
        className={`font-sans ${fontClass}`}
      >
        {Render ? <Render r={r} o={o} picks={picks} /> : <Missing id={scene} />}
      </article>
    </div>
  )
}
