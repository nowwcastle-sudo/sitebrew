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
      <section id={id} data-block="state-screen-loading" aria-busy="true" aria-labelledby={`${id}-label`} className={cn("cn-block-section", className)}>
        <div className="cn-block-sload">
          <p id={`${id}-label`} role="status" className="sr-only">
            {copy.label}
          </p>
          <div aria-hidden="true" className="cn-block-sload-head">
            <Skeleton className="cn-block-sload-title" />
            <Skeleton className="cn-block-sload-line" />
            <Skeleton className="cn-block-sload-line cn-block-sload-line-short" />
          </div>
          <div aria-hidden="true" className="cn-block-sload-cards">
            <Skeleton className="cn-block-sload-card" />
            <Skeleton className="cn-block-sload-card" />
          </div>
          {slow && copy.slow ? (
            <div role="status" data-slow="" className="cn-block-sload-slow">
              <p className="cn-block-sload-slow-title font-heading">{copy.slow.title}</p>
              <p>{copy.slow.body}</p>
              <a href={copy.slow.reload.href} className="cn-block-serror-help-link">
                {copy.slow.reload.label}
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
