import * as React from "react"

import type { Cta } from "@/registry/factory/content/content-core"
import { AlertCircle } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/registry/factory/ui/empty"

// 목록 상태 칸(P3-2 공유 조각 block-shared-list-status): 읽기 데이터 블록의 빈 상태(안내 + 행동 하나)와 오류 상태(메시지 + [다시 시도]).
// 오류는 role="alert"(읽기 도구가 바로 읽는다), 빈 상태는 role="status". 다시 시도는 retry 가 있을 때만 그린다(누를 것이 없으면 버튼도 없다).
export function ListEmpty({ title, body, action, className }: { title: string; body?: string; action?: Cta; className?: string }) {
  return (
    <Empty role="status" className={cn("cn-block-status", className)}>
      <EmptyHeader>
        <EmptyTitle className="cn-block-status-title">{title}</EmptyTitle>
        {body ? <EmptyDescription className="cn-block-status-body">{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<a href={action.href} />}>
            {action.label}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export function ListError({ title, message, retryLabel, retry, className }: { title: string; message: string; retryLabel: string; retry?: () => void; className?: string }) {
  return (
    <Empty role="alert" className={cn("cn-block-status", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="cn-block-status-title">{title}</EmptyTitle>
        <EmptyDescription className="cn-block-status-body">{message}</EmptyDescription>
      </EmptyHeader>
      {retry ? (
        <EmptyContent>
          <Button type="button" onClick={() => retry()} data-retry>
            {retryLabel}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
