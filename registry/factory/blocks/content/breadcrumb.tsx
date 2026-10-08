"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/registry/factory/ui/breadcrumb"

// 현재 위치 경로(대장 C70 — 원형 noBlock part breadcrumb: 공공 서브 쪽). 레시피 breadcrumb 부품을 그대로 쓰고, 경로는 사이트맵의 쪽(홈 → 이 쪽)이다.
// 머리(h2)가 없는 띠다 — 이름은 nav 의 aria-label(copy.label). 마지막 칸은 지금 쪽(aria-current).
export type ContentBreadcrumbCopy = { label: string }
export type ContentBreadcrumbProps = BlockBase<ContentBreadcrumbCopy> & { trail: { label: string; href?: string }[]; first?: boolean }

export function ContentBreadcrumb({ copy, trail, id = "breadcrumb", className }: ContentBreadcrumbProps) {
  return (
    <div id={id} data-block="content-breadcrumb" className={cn("cn-block-content-crumbs", className)}>
      <Breadcrumb aria-label={copy.label}>
        <BreadcrumbList>
          {trail.map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>{t.href && i < trail.length - 1 ? <BreadcrumbLink href={t.href}>{t.label}</BreadcrumbLink> : <BreadcrumbPage>{t.label}</BreadcrumbPage>}</BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
