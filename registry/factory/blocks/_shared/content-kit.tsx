import * as React from "react"

import { Image as ImageIcon } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"

import { formatPrice } from "../_shared/price-tag"

// 본문 섹션 공유 조각(대장 C70 — block-shared-content-kit). 원형의 noBlock.mode content·part 섹션을 그리는 렌더러(blocks/content/*)가 같이 쓴다:
// 섹션 머리(h2 — h1 은 히어로·SiteShell 몫), 값 서식(날짜·연도·금액·일수·쪽수 — 숫자는 data-numeric), 콘텐츠 이미지 칸(src 가 없으면 「실제 사진 필요」 틀).
// 값은 모두 콘텐츠($ref)에서 오고, 여기 있는 글자는 UI 이름표(copy)뿐이다. 등장(data-enter)은 머리·작은 줄(목록 줄·값 줄·링크 칸)에만 단다 —
// 문단·카드·사진처럼 LCP 후보가 될 큰 덩어리는 숨기지 않는다. 쪽의 첫 섹션이면 first — 등장 대상이 첫 칠부터 보이고(data-enter="keep") 첫 사진을 바로 받는다.
// 찍어낸 사이트에서는 06 의 첫 화면 구획(data-wf-first, PERF2)도 같은 일을 한다(겹쳐도 해가 없다 — 이 렌더러를 06 밖에서 써도 같게).

export type ContentFormat = "text" | "date" | "year" | "money" | "days" | "pages"
/** 화면 값 하나 — 숫자·날짜는 서식과 함께 받는다(콘텐츠의 날 값). */
export type ContentValue = { value: string | number | (string | number)[] | null | undefined; format?: ContentFormat; currency?: string }
/** 콘텐츠 스키마의 이미지 칸(content-core ImageSlot)과 같은 모양 + 상세 조각(width·height). src 가 없으면 빈 틀. */
export type ContentImage = { id?: string; aspect?: string; source?: string; alt?: string; src?: string; width?: number; height?: number }
/** 렌더러 공통 이름표 — 단위 문장의 {n} 은 숫자 자리. */
export type ContentUnits = { days?: string; pages?: string; photoNeeded: string; imagePending: string; external?: string }
export type ContentCopy = { title: string; hideTitle?: boolean; lead?: string; units: ContentUnits }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC: ReadonlySet<ContentFormat> = new Set(["date", "year", "money", "days", "pages"])
const intlLocale = (locale?: string) => (locale === "en" ? "en-US" : "ko-KR")

/** 값 → 화면 글자. 빈 값은 null(그 줄을 그리지 않는다). */
export function formatValue(v: ContentValue, units: ContentUnits, locale?: "ko" | "en"): string | null {
  const one = (x: string | number): string => {
    if (typeof x === "number") {
      switch (v.format) {
        case "money":
          return formatPrice(x, v.currency ?? "KRW", { locale: intlLocale(locale) })
        case "days":
          return (units.days ?? "{n}").replace("{n}", String(x))
        case "pages":
          return (units.pages ?? "{n}").replace("{n}", String(x))
        case "year":
          return String(x)
        default:
          return x.toLocaleString(intlLocale(locale))
      }
    }
    if (v.format === "date" && ISO_DATE.test(x)) return new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${x}T00:00:00Z`))
    return x
  }
  const raw = v.value
  if (raw === null || raw === undefined || raw === "") return null
  if (Array.isArray(raw)) return raw.length ? raw.map(one).join(" · ") : null
  return one(raw)
}

/** 값 한 칸 — 숫자 서식이면 data-numeric, 날짜면 <time>. */
export function ContentValueText({ v, units, locale, className }: { v: ContentValue; units: ContentUnits; locale?: "ko" | "en"; className?: string }) {
  const text = formatValue(v, units, locale)
  if (text === null) return null
  if (v.format === "date" && typeof v.value === "string" && ISO_DATE.test(v.value))
    return (
      <time dateTime={v.value} data-numeric className={className}>
        {text}
      </time>
    )
  const numeric = typeof v.value === "number" || NUMERIC.has(v.format ?? "text")
  return numeric ? (
    <span data-numeric className={className}>
      {text}
    </span>
  ) : (
    <span className={className}>{text}</span>
  )
}

/** 섹션 머리: h2 + 선택 머리말. hideTitle 이면 h2 를 읽기 도구에만 남긴다(쪽 제목과 겹치는 첫 요약 등). */
export function ContentHead({ id, copy, enter, locale }: { id: string; copy: ContentCopy; enter: string; locale?: "ko" | "en" }) {
  if (copy.hideTitle && !copy.lead)
    return (
      <h2 id={id} className="sr-only">
        {copy.title}
      </h2>
    )
  return (
    <div className="cn-block-content-head">
      <h2 id={id} data-enter={enter} className={copy.hideTitle ? "sr-only" : cn("cn-block-content-title", headingFont(locale))}>
        {copy.title}
      </h2>
      {copy.lead ? (
        <p data-enter={enter} className="cn-block-content-lead">
          {copy.lead}
        </p>
      ) : null}
    </div>
  )
}

/** 제목 서체: 한국어 제목은 font-heading-ko(라틴 제목 서체의 넓은 공백이 한글 낱말 사이에 끼지 않게 — docs/agents/agent-guide.md 블록 층), 영어는 font-heading. */
export const headingFont = (locale?: "ko" | "en") => (locale === "en" ? "font-heading" : "font-heading-ko")

/** 첫 섹션의 등장 대상은 숨기지 않는다(첫 칠부터 보인다). 나머지는 장면이 올린다. */
export const enterOf = (first?: boolean) => (first ? "keep" : "")

const ratio = (img: ContentImage) => {
  if (img.width && img.height) return `${img.width} / ${img.height}`
  const m = img.aspect?.match(/^(\d+)[:x](\d+)(?:-(\d+))?/)
  if (!m) return "4 / 3"
  return m[3] ? `${m[1]} / ${Math.round((Number(m[2]) + Number(m[3])) / 2)}` : `${m[1]} / ${m[2]}`
}

/** 콘텐츠 이미지 칸. src 가 없으면 비율을 지킨 빈 틀 — 실사 필수 칸은 「실제 사진 필요」, 그 밖은 「이미지 준비 중」. 깨진 그림이나 스톡으로 대신하지 않는다. */
export function ContentFigure({ img, units, className, eager = false }: { img: ContentImage; units: ContentUnits; className?: string; eager?: boolean }) {
  const label = img.source === "real-required" ? units.photoNeeded : units.imagePending
  return (
    <span data-slot="content-figure" style={{ aspectRatio: ratio(img) }} className={cn("cn-block-content-figure", className)}>
      {img.src ? (
        <img src={img.src} alt={img.alt ?? ""} width={img.width} height={img.height} loading={eager ? "eager" : "lazy"} decoding="async" className="cn-block-content-figure-img" />
      ) : (
        <span role="img" aria-label={img.alt ? `${img.alt} — ${label}` : label} data-photo-needed={img.source === "real-required" ? "" : undefined} className="cn-block-content-figure-empty">
          <ImageIcon aria-hidden="true" className="cn-block-content-figure-icon" />
          <span aria-hidden="true">{label}</span>
        </span>
      )}
    </span>
  )
}

/** 글 덩어리 하나 → 문단들(빈 줄·줄바꿈에서 나눈다). */
export const paragraphsOf = (texts: (string | null | undefined)[]) =>
  texts.flatMap((t) => (typeof t === "string" ? t.split(/\n+/).map((x) => x.trim()).filter(Boolean) : []))
