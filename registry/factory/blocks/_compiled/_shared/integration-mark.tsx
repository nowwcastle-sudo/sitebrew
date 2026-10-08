import * as React from "react"

import type { ImageSlot } from "@/registry/factory/contract/block-contract"
import { cn } from "@/registry/factory/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/registry/factory/ui/avatar"

// 연동 표지(P3-2 공유 조각 block-shared-integration-mark): 연동 제품의 로고 그림, 없으면 이름 앞 두 글자(공백 뺌)를 Avatar(레시피 모양)로.
// 이름은 곁에 글자로 따로 보이므로 표지는 장식이다(aria-hidden) — 같은 이름을 두 번 읽지 않는다.
export type IntegrationItem = {
  name: string
  url: string
  kind: "native" | "api" | "webhook"
  note?: string
  logo?: ImageSlot
}

export const monogram = (name: string) => [...name.replace(/\s+/g, "")].slice(0, 2).join("")

export function IntegrationMark({ item, size = "default", className }: { item: Pick<IntegrationItem, "name" | "logo">; size?: "default" | "sm" | "lg"; className?: string }) {
  return (
    <Avatar
      /* icon-label: Avatar 크기(default·sm·lg)다 — 아이콘 버튼이 아니고, 표지는 장식(aria-hidden)이라 이름은 곁 글자가 맡는다 */
      size={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {item.logo ? <AvatarImage src={item.logo.src} alt="" /> : null}
      <AvatarFallback className="text-sm leading-none whitespace-nowrap text-foreground">{monogram(item.name)}</AvatarFallback>
    </Avatar>
  )
}
