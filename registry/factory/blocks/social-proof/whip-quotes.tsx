"use client"

import * as React from "react"
import { gsap } from "gsap"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { ChevronLeft, ChevronRight } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { lowerThird, namedEase, playOnView, whipIn, whipPan } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene, type Scene } from "@/registry/factory/motion/use-gsap-scene"
import { Button } from "@/registry/factory/ui/button"

import { BlockHeading } from "../_shared/block-heading"

// 사회적 증거 — 휩 팬 후기 한 장씩(P3-5 MOTKIT). 큰 후기 한 장(인용문 + 구체 결과 한 줄 + 이름표 띠 — 이름·직함·소속, saas testimonials 와 같은 칸)과
// 이전·다음 단추·후기 점(바로 가기). 스스로 넘어가지 않는다(사람이 누를 때만 — 자동 회전 없음, 정지 단추가 필요 없다).
// 모션(MOTKIT — 동작 줄이기·M0 은 바로 바뀐다): 구획이 화면에 들어올 때 제목·판이 옆에서 휙 들어오며 흐림이 걷히고(휩 등장) 이름표 막대가 펼쳐진다.
// 넘길 때마다 지금 판은 반대쪽으로 휙 빠지고 새 판이 가로로만 흐린(SVG feGaussianBlur stdDeviation "x 0") 채 들어와 착지한다(휩 팬 240~400ms, M3 550ms) —
// 그 뒤 새 이름표의 이름·역할이 칸 안에서 올라온다. 바뀐 후기 순서는 읽기 도구에 한 줄로 알린다(aria-live polite).
export type SocialProofWhipQuotesCopy = {
  title: string
  lead?: string
  quotes: { quote: string; name: string; title: string; company: string; result?: string }[]
  prevLabel: string
  nextLabel: string
  // 「{current}번째 후기, 모두 {total}개」 — 바뀔 때 읽는다. {current}·{total} 은 블록이 채운다.
  positionLabel: string
}
export type SocialProofWhipQuotesProps = BlockBase<SocialProofWhipQuotesCopy>

type View = { idx: number; leaving: number | null; dir: 1 | -1 }

export function SocialProofWhipQuotes({ copy, id = "social-proof", className }: SocialProofWhipQuotesProps) {
  const ref = React.useRef<HTMLElement>(null)
  const scene = React.useRef<Scene | null>(null)
  const blur = React.useRef<SVGFEGaussianBlurElement>(null)
  const fid = `wq${React.useId().replace(/[^A-Za-z0-9_-]/g, "")}-whip` // CSS url(#…) 에 쓰는 id — React 판마다 다른 기호(: « »)를 지운다
  const n = copy.quotes.length
  const [view, setView] = React.useState<View>({ idx: 0, leaving: null, dir: 1 })
  useGsapScene(ref, (s) => {
    scene.current = s
    s.onCleanup(() => { scene.current = null })
    playOnView(s)
    whipIn(s, [s.root.querySelector(".wq-head"), s.root.querySelector(".wq-stage")], { at: 0 })
    lowerThird(s, s.root.querySelector(".wq-panel[data-on] [data-lt]"), { at: 0.35, loop: false })
  })
  const go = (to: number, dir: 1 | -1) => setView((v) => (v.leaving !== null || to === v.idx ? v : { idx: (to + n) % n, leaving: v.idx, dir }))
  // 넘김: 두 판이 함께 그려진 뒤(레이아웃 효과) 휩 팬. 장면이 없으면(동작 줄이기·M0) 곧바로 끝낸다.
  React.useLayoutEffect(() => {
    if (view.leaving === null) return
    const root = ref.current
    const s = scene.current
    const done = () => setView((v) => ({ ...v, leaving: null }))
    const out = root?.querySelector<HTMLElement>(`[data-wq="${view.leaving}"]`) ?? null
    const into = root?.querySelector<HTMLElement>(`[data-wq="${view.idx}"]`)
    const stage = root?.querySelector<HTMLElement>(".wq-stage")
    if (!s || !into || !stage) return done()
    stage.style.filter = `url(#${fid})`
    whipPan(s, out, into, {
      dir: view.dir, blurFilter: blur.current,
      onDone: () => {
        stage.style.removeProperty("filter")
        done()
      },
    })
    // 새 이름표의 이름·역할이 칸 안에서 올라온다(판이 거의 닿았을 때).
    const t = into.querySelectorAll(".lt-text")
    if (t.length) s.add(() => gsap.from(t, { yPercent: 110, duration: s.t.enter, delay: 0.22, ease: namedEase("out-lower"), stagger: 0.1, clearProps: "transform" }))
  }, [view, fid])
  const position = copy.positionLabel.replace("{current}", String(view.idx + 1)).replace("{total}", String(n))
  return (
    <section ref={ref} id={id} data-block="social-proof-whip-quotes" aria-labelledby={`${id}-title`} className={cn("cn-block-section cn-block-whip-quotes", className)}>
      <svg aria-hidden="true" focusable="false" className="cn-block-whip-quotes-defs">
        <filter id={fid} x="-20%" y="0" width="140%" height="100%">
          <feGaussianBlur ref={blur} stdDeviation="0 0" />
        </filter>
      </svg>
      <div data-enter="" className="wq-head">
        <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      </div>
      <div data-enter="" className="cn-block-whip-quotes-stage wq-stage">
        {copy.quotes.map((q, i) =>
          i === view.idx || i === view.leaving ? (
            <figure key={i} data-wq={i} data-on={i === view.idx ? "" : undefined} aria-hidden={i === view.idx ? undefined : true} className="cn-block-whip-quotes-panel wq-panel">
              <blockquote className="cn-block-whip-quotes-quote font-heading">
                <p>{q.quote}</p>
              </blockquote>
              {q.result ? <p className="cn-block-whip-quotes-result">{q.result}</p> : null}
              <figcaption data-lt="" className="cn-block-whip-quotes-who">
                <span data-lt-item="" className="cn-block-lower-third-item">
                  <span aria-hidden="true" className="cn-block-lower-third-bar lt-bar" />
                  <span className="cn-block-lower-third-mask lt-mask">
                    <span className="cn-block-lower-third-name lt-text">{q.name}</span>
                  </span>
                  <span className="cn-block-lower-third-mask lt-mask">
                    <span className="cn-block-lower-third-role lt-text">
                      {q.title} · {q.company}
                    </span>
                  </span>
                </span>
              </figcaption>
            </figure>
          ) : null,
        )}
      </div>
      {n > 1 ? (
        <div className="cn-block-whip-quotes-controls">
          <Button variant="outline" size="icon-lg" aria-label={copy.prevLabel} onClick={() => go(view.idx - 1, -1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <ol className="cn-block-whip-quotes-dots">
            {copy.quotes.map((q, i) => (
              <li key={i}>
                <button type="button" aria-label={q.name} aria-current={i === view.idx ? "true" : undefined} onClick={() => go(i, i > view.idx ? 1 : -1)} className="cn-block-whip-quotes-dot">
                  <span aria-hidden="true" className="cn-block-whip-quotes-dot-mark" />
                </button>
              </li>
            ))}
          </ol>
          <Button variant="outline" size="icon-lg" aria-label={copy.nextLabel} onClick={() => go(view.idx + 1, 1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
          <p aria-live="polite" className="sr-only">
            {position}
          </p>
        </div>
      ) : null}
    </section>
  )
}
