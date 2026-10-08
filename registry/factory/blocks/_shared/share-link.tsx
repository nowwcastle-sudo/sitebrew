"use client"

import * as React from "react"

import { Check, Copy } from "@/registry/factory/icons"
import { cn } from "@/registry/factory/lib/utils"
import { Button } from "@/registry/factory/ui/button"

import { copyText } from "../_shared/copy-button"
import { blockLabels } from "../_shared/block-labels"

// 공유·초대 링크(P3-2 레인 D2 공유 조각 block-shared-share-link — referral 세 변형이 같이 쓴다). 마케팅 규칙 V2(문구를 채운 원클릭 공유) · DESIGN §17.
//   · 링크 복사: 클립보드 API 가 막히면(권한·http·인앱 브라우저) 링크 칸을 골라(select) 두고 「직접 복사해 주세요」라고 알린다 — 조용히 실패하지 않는다.
//   · 카카오톡 공유: §17 — 제목·설명·절대 경로 이미지(가로 2:1~1.91:1, 폭 800px 이상)를 채운 템플릿을 먼저 준비한다. 템플릿에 문제가 있으면
//     kakaoTemplateIssues 가 알리고 블록은 카카오 버튼을 그리지 않는다. SDK(window.Kakao.Share)는 소비자가 싣는다 — 없으면 링크를 복사하고 그렇다고 알린다.
//   · 플랫폼 색·반경은 쓰지 않는다(레시피 버튼 모양 — 로그인 버튼 규격은 auth 블록에만).

export type KakaoShareTemplate = {
  title: string
  description: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  // 공유 글을 누르면 갈 주소(절대 경로)
  link: string
  buttonTitle: string
}

/** §17 카카오톡 공유 템플릿 검사 — 문제 목록(빈 배열이면 통과) */
export function kakaoTemplateIssues(t: KakaoShareTemplate, locale?: string): string[] {
  const L = blockLabels(locale)
  const out: string[] = []
  if (!t.title.trim()) out.push(L.shareTitle)
  if (!t.description.trim()) out.push(L.shareDescription)
  if (!/^https:\/\//.test(t.imageUrl)) out.push(L.shareImageHttps)
  if (!/^https:\/\//.test(t.link)) out.push(L.shareLinkHttps)
  if (t.imageWidth < 800) out.push(L.shareImageWidth)
  const r = t.imageWidth / Math.max(1, t.imageHeight)
  if (r < 1.91 - 0.005 || r > 2 + 0.005) out.push(L.shareImageRatio)
  return out
}

type KakaoWin = Window & { Kakao?: { isInitialized?: () => boolean; Share?: { sendDefault: (o: unknown) => void } } }
/** 카카오톡 공유 창을 연다. SDK 가 없거나 초기화 전이면 false(부르는 쪽이 링크 복사로 넘긴다) */
export function shareToKakao(t: KakaoShareTemplate): boolean {
  const k = (window as KakaoWin).Kakao
  if (!k?.Share || (k.isInitialized && !k.isInitialized())) return false
  k.Share.sendDefault({
    objectType: "feed",
    content: { title: t.title, description: t.description, imageUrl: t.imageUrl, imageWidth: t.imageWidth, imageHeight: t.imageHeight, link: { mobileWebUrl: t.link, webUrl: t.link } },
    buttons: [{ title: t.buttonTitle, link: { mobileWebUrl: t.link, webUrl: t.link } }],
  })
  return true
}

/** 문자 앱 열기 주소 — 채운 글(body)을 싣는다 */
export const smsHref = (body: string) => `sms:?&body=${encodeURIComponent(body)}`

// 클립보드 복사는 copy-button 조각 하나가 맡는다(대장 A45) — referral 블록들의 import 는 그대로 이 파일에서 받는다
export { copyText }

export type LinkCopyCopy = { label: string; copy: string; copied: string; manual: string }
/**
 * 링크 한 줄(읽기 전용 칸) + [링크 복사]. 결과는 칸 아래 알림 자리(role=status)에. 막히면 칸을 골라 두고 「직접 복사해 주세요」.
 * onCopied: 복사가 끝나면(계측 referral_share channel link 등)
 */
export function LinkCopy({ id, url, copy, onCopied, className }: { id: string; url: string; copy: LinkCopyCopy; onCopied?: () => void; className?: string }) {
  const [status, setStatus] = React.useState<"idle" | "copied" | "manual">("idle")
  const inputId = `${id}-link`
  const run = async () => {
    const ok = await copyText(url)
    if (ok) {
      setStatus("copied")
      onCopied?.()
      return
    }
    setStatus("manual")
    const el = document.getElementById(inputId)
    if (el instanceof HTMLInputElement) {
      el.focus()
      el.select()
    }
  }
  return (
    <div className={cn("cn-block-share-copy", className)}>
      <label htmlFor={inputId} className="cn-block-share-copy-label">
        {copy.label}
      </label>
      <div className="cn-block-share-copy-row">
        <input id={inputId} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="cn-block-share-copy-input" data-numeric="" />
        <Button type="button" variant="outline" size="lg" onClick={run} data-copy-link="" className="cn-block-share-copy-button">
          {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copy.copy}
        </Button>
      </div>
      <p role="status" data-copy-status={status} className="cn-block-share-copy-status">
        {status === "copied" ? copy.copied : status === "manual" ? copy.manual : ""}
      </p>
    </div>
  )
}
