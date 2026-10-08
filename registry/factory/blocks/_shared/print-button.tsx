"use client"

import * as React from "react"

import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

// 「인쇄·PDF 저장」(P3-2 Task 7a, 대장 A104): 예약 확인·주문 확인·가입 완료는 사람이 종이나 PDF 로 남긴다(GOV.UK 확인 페이지 「save a transaction record」).
// window.print() 만 부른다 — PDF 저장은 브라우저 인쇄 창의 「PDF로 저장」이다. 버튼 자신은 인쇄물에 나오지 않는다(data-print="hide").
export function PrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button type="button" variant="outline" size="lg" /* icon-label: 글자(label)가 늘 보인다 */ data-print="hide" onClick={() => window.print()} className={cn("cn-block-print", className)}>
      {label}
    </Button>
  )
}
