import * as React from "react"

import type { AnalyticsPort, IsoDate } from "@/registry/factory/contract/ports"
import { ExternalLink, Mail, Phone } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { normalizePhone } from "@/registry/factory/lib/phone"

import { formatFrom } from "../_shared/billing-format"
import { breakable } from "../_shared/break-text"

// 상품 문의(P3-2 Task 7b-commerce, 대장 A62 — 공유 조각 block-shared-qna-kit). qna 세 변형이 같이 쓴다.
// 서버 없이(register A62): 목록은 판매자가 미리 써 둔 「자주 받는 문의」(질문 + 판매자 답변 + 답한 날)이고, 「문의하기」는 카카오톡 채널·전화·메일 링크(또는 ask-form 의 문의 폼 포트 —
// D97 수신 경로). 구매자끼리 올리는 비밀글 게시판은 v0.2 다. 그래서 질문은 사업자가 쓴 글이고, 사람이 남긴 글(입력)은 어디에도 그리지 않는다.
//   · 목록은 서버가 그린 첫 HTML 글자(X2) — 답변이 접힌 곳 뒤에 숨지 않는다(접힘 없음). 질문은 h3, 답변 앞에 「판매자 답변」 + 답한 날(time).
//   · 검색·종류 거르기는 클라이언트에서 목록을 줄일 뿐이다(계측·서버 없음, 검색어는 어디에도 보내지 않는다).
export type QnaItem = {
  id: string
  question: string
  answer: string
  // 판매자가 답한 날
  answeredAt: IsoDate
  // 문의 종류(배송·사이즈·세탁 …) — 종류 거르기가 쓴다
  category?: string
}
export type QnaContact = { kakaoUrl?: string; phone?: string; email?: string }
export type QnaEntryCopy = {
  // 「판매자 답변」
  answerLabel: string
  // 「{date} 답변」
  answeredOn: string
}
export type QnaContactCopy = {
  title: string
  kakao: string
  phone: string
  email: string
  // 「평일 오전 10시~오후 6시」 같은 응대 시간 한 줄
  note?: string
}

/** 검색어·종류로 목록을 줄인다. 검색어는 공백을 접어 대소문자 없이 질문·답변에서 찾고, 종류가 있으면 그 종류만. 원래 차례를 지킨다. */
export function qnaMatches(items: QnaItem[], query: string, category?: string): QnaItem[] {
  const q = query.replace(/\s+/g, " ").trim().toLowerCase()
  return items.filter((it) => (!category || it.category === category) && (!q || `${it.question} ${it.answer}`.replace(/\s+/g, " ").toLowerCase().includes(q)))
}

/** 목록에 나온 문의 종류(처음 나온 차례, 중복 없음) */
export function qnaCategories(items: QnaItem[]): string[] {
  return [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))]
}

/**
 * 「더 보기」로 목록을 늘린다(한 번에 page 건). 눌렀을 때 새로 나온 첫 문의(article, tabIndex -1)로 포커스를 옮긴다 —
 * 마지막 조각을 보이면 버튼이 사라지므로 포커스가 body 로 빠지지 않게 한다(키보드·스크린 리더 사용자가 자리를 잃지 않는다).
 */
export function useReveal(page: number) {
  const [shown, setShown] = React.useState(page)
  const listRef = React.useRef<HTMLOListElement>(null)
  const focusAt = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (focusAt.current === null) return
    listRef.current?.querySelectorAll<HTMLElement>("[data-qna-item]")[focusAt.current]?.focus()
    focusAt.current = null
  }, [shown])
  return {
    shown,
    listRef,
    reset: () => setShown(page),
    more: (visibleCount: number) => {
      focusAt.current = visibleCount
      setShown((n) => n + page)
    },
  }
}

/** 문의 한 건 — 질문(h3) · 판매자 답변 · 답한 날 */
export function QnaEntry({ item, copy, locale, timeZone, className }: { item: QnaItem; copy: QnaEntryCopy; locale?: string; timeZone?: string; className?: string }) {
  return (
    <article tabIndex={-1} data-qna-item={item.id} data-category={item.category} className={cn("cn-block-qa-item", className)}>
      <h3 className="cn-block-qa-question font-heading-ko">{item.question}</h3>
      <div data-seller-reply="" className="cn-block-qa-reply">
        <p className="cn-block-qa-reply-label">
          {copy.answerLabel}
          <span aria-hidden="true"> · </span>
          <time data-numeric dateTime={item.answeredAt} className="cn-block-qa-date">
            {copy.answeredOn.replace("{date}", formatFrom(item.answeredAt, locale, timeZone))}
          </time>
        </p>
        <p className="cn-block-qa-answer">{item.answer}</p>
      </div>
    </article>
  )
}

/** 문의 채널 링크 줄 — 카카오톡 채널(https 만)·전화(tel:)·메일(mailto:). 값이 있는 것만. 서버·폼 없이 사람이 직접 묻는 길. */
export function QnaContactLinks({ contact, copy, track, section, className }: { contact: QnaContact; copy: QnaContactCopy; track?: AnalyticsPort["track"]; section: string; className?: string }) {
  const tel = contact.phone ? normalizePhone(contact.phone) : null
  const kakao = contact.kakaoUrl && /^https:\/\//.test(contact.kakaoUrl) ? contact.kakaoUrl : null
  const items = [
    kakao ? { key: "kakao", href: kakao, label: copy.kakao, icon: <ExternalLink aria-hidden="true" className="cn-block-qa-link-icon" />, external: true } : null,
    tel ? { key: "phone", href: `tel:${tel}`, label: copy.phone, sub: contact.phone, icon: <Phone aria-hidden="true" className="cn-block-qa-link-icon" />, external: false } : null,
    contact.email ? { key: "email", href: `mailto:${contact.email}`, label: copy.email, sub: contact.email, icon: <Mail aria-hidden="true" className="cn-block-qa-link-icon" />, external: false } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  if (!items.length) return null
  return (
    <div data-qna-contact="" className={cn("cn-block-qa-contact", className)}>
      <p className="cn-block-qa-contact-title font-heading-ko">{copy.title}</p>
      <ul className="cn-block-qa-links">
        {items.map((x) => (
          <li key={x.key}>
            <a
              href={x.href}
              data-contact={x.key}
              {...(x.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => track?.("cta_click", { id: `qna-${x.key}`, label: x.label, section })}
              className="cn-block-qa-link"
            >
              {x.icon}
              <span>{x.label}</span>
              {x.sub ? (
                <span data-numeric="" className="cn-block-qa-link-sub">
                  {breakable(x.sub)}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
      {copy.note ? <p className="cn-block-qa-contact-note">{copy.note}</p> : null}
    </div>
  )
}
