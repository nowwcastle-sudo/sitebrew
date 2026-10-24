"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { countUp, rise } from "@/registry/factory/motion/gsap-techniques"
import { useGsapScene } from "@/registry/factory/motion/use-gsap-scene"
import { Card } from "@/registry/factory/ui/card"

import { BlockHeading } from "../_shared/block-heading"

// 기능 — 크기가 다른 칸 3~4개(벤토). 첫 칸이 가장 크고(대표 기능 + 큰 수치), 나머지는 작은 칸·넓은 칸으로 크기 위계를 만든다.
// 칸마다 위쪽 색 면(data-face="block-1…4")에 수치·기능 이름(큰 글자)을 두고, 설명 본문은 그 아래 카드 면에 둔다. 색 블록 레시피(K8)는 색 면이
// 그 블록 색과 짝 글자색을 받는다(면 스코프가 --background·--foreground 를 바꾼다). 블록 색 짝은 큰 글자 기준(4.5:1)만 보장하는 레시피가 있어
// (r3 블록 2·4 = 5.2~6.8) 본문(7:1)은 색 면에 올리지 않는다. 블록 색이 없는 레시피는 색 면을 --muted 로 그린다 — 같은 위계, 색만 조용하다.
export type FeaturesBentoGridCopy = {
  title: string
  lead?: string
  cells: { title: string; body: string; stat?: { value: string; label: string } }[]
}
export type FeaturesBentoGridProps = BlockBase<FeaturesBentoGridCopy>

// 칸 수 → 칸마다의 크기(넓은 화면 6열 격자). L: 4×2 · S: 2×1 · W: 가로 한 줄 전체.
const SIZES: Record<number, string[]> = { 1: ["W"], 2: ["L", "S"], 3: ["L", "S", "S"], 4: ["L", "S", "S", "W"] }

export function FeaturesBentoGrid({ copy, id = "features", className }: FeaturesBentoGridProps) {
  const ref = React.useRef<HTMLElement>(null)
  useGsapScene(ref, (s) => {
    rise(s, s.q("[data-enter]"), { stagger: 0.08 })
    countUp(s, s.q("[data-count-up]"), { at: 0.1 })
  })
  const cells = copy.cells.slice(0, 4)
  const sizes = SIZES[cells.length] ?? SIZES[4]
  const cid = (i: number) => `${id}-cell-${i + 1}`
  return (
    <section ref={ref} id={id} data-block="features-bento-grid" aria-labelledby={`${id}-title`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
      <BlockHeading id={`${id}-title`} title={copy.title} lead={copy.lead} />
      <ul className="grid gap-4 md:auto-rows-[minmax(12rem,auto)] md:grid-cols-6">
        {cells.map((c, i) => (
          <li key={i} data-enter data-size={sizes[i]} className="flex min-w-0 md:col-span-3 md:data-[size=L]:col-span-4 md:data-[size=L]:row-span-2 md:data-[size=S]:col-span-2 md:data-[size=W]:col-span-6">
            <Card role="group" aria-labelledby={cid(i)} className="w-full gap-0 py-0 text-base">
              <div
                data-face={`block-${i + 1}`}
                style={{ "--bento-face": `var(--block-${i + 1}, var(--muted))` } as React.CSSProperties}
                className="flex min-h-40 flex-1 flex-col justify-end gap-3 bg-(--bento-face) p-[calc(var(--card-spacing)*1.5)] text-foreground"
              >
                {c.stat ? (
                  <p className="flex flex-col gap-1 pb-2">
                    <span data-numeric data-count-up className="text-[3.815rem] leading-none md:text-[4.768rem] font-heading">
                      {c.stat.value}
                    </span>
                    <span className="text-[1.5rem] leading-[1.3]">{c.stat.label}</span>
                  </p>
                ) : null}
                <h3 id={cid(i)} className="text-[1.563rem] leading-[1.3] md:in-data-[size=L]:text-[2.441rem] md:in-data-[size=L]:leading-[1.15] font-heading">
                  {c.title}
                </h3>
              </div>
              <p className="max-w-prose p-[calc(var(--card-spacing)*1.5)] text-base leading-[1.7]">{c.body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
