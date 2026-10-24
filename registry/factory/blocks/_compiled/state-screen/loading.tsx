import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Skeleton } from "@/registry/factory/ui/skeleton"

// 상태 화면 — 앱 전체 읽는 중(P3-6 H01·H09 — Next 의 loading.tsx 에 그대로 끼운다). 제목 줄·본문 줄·카드 둘의 뼈대 + 읽는 도구에 읽히는 「불러오는 중」 한 줄(role=status,
// 뿌리 aria-busy). 서버 컴포넌트·스타일 속성 없음 — 엄격 CSP 에 걸리지 않고 자바스크립트가 없어도 그려진다. 뼈대의 깜빡임은 동작 줄이기에서 멈춘다(부품 skeleton).
//   · slow — 오래 걸릴 때(Next 에는 시간 신호가 없다 — 소비자가 15초 타이머를 둘 때) 「응답이 늦어요」 안내와 [다시 불러오기] 링크를 더한다(H09). 안 주면 없다.
//   · header — 머리·내비 자리. 로딩 화면에서도 머리가 사라지면 쪽이 깜빡인다.
export type StateScreenLoadingCopy = {
  /** 읽는 도구가 읽는 글 — 화면에는 보이지 않는다 */
  label: string
  /** 느릴 때 보이는 안내(slow 일 때만) */
  slow?: { title: string; body: string; reload: { label: string; href: string } }
}
export type StateScreenLoadingProps = BlockBase<StateScreenLoadingCopy> & {
  header?: React.ReactNode
  slow?: boolean
}

export function StateScreenLoading({ copy, header, slow = false, id = "loading", className }: StateScreenLoadingProps) {
  return (
    <>
      {header}
      <section id={id} data-block="state-screen-loading" aria-busy="true" aria-labelledby={`${id}-label`} className={cn("mx-auto flex w-full max-w-6xl flex-col gap-[var(--wf-section-gap,calc(var(--spacing)*10))] px-4 py-[var(--wf-section-py,calc(var(--spacing)*16))] md:gap-[var(--wf-section-gap-md,calc(var(--spacing)*12))] md:px-8 md:py-[var(--wf-section-py-md,calc(var(--spacing)*24))] in-data-[archetype=dashboard]:gap-6 in-data-[archetype=dashboard]:py-6 md:in-data-[archetype=dashboard]:gap-6 md:in-data-[archetype=dashboard]:py-8", className)}>
        <div className="flex max-w-3xl flex-col gap-8">
          <p id={`${id}-label`} role="status" className="sr-only">
            {copy.label}
          </p>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-full max-w-prose" />
            <Skeleton className="h-5 max-w-prose w-1/2" />
          </div>
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          {slow && copy.slow ? (
            <div role="status" data-slow="" className="flex flex-col items-start gap-1 border px-5 py-4 text-base leading-[1.6]">
              <p className="text-[1.125rem] leading-[1.4] font-heading">{copy.slow.title}</p>
              <p>{copy.slow.body}</p>
              <a href={copy.slow.reload.href} className="relative inline-flex min-h-11 items-center gap-2 text-base underline underline-offset-4">
                {copy.slow.reload.label}
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
