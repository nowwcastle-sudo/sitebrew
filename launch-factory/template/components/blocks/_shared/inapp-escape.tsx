"use client"

import * as React from "react"

import { ExternalLink } from "@/components/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { CopyButton, type CopyButtonCopy } from "../_shared/copy-button"

// 인앱 브라우저 탈출(P3-2 Task 7a, 대장 A61 — 공유 조각 block-shared-inapp-escape): 카카오톡·네이버·인스타그램·페이스북 앱 안 브라우저에서 연 페이지는
// 구글 로그인이 막히고(구글 OAuth 정책 「Use secure browsers」 — 개발자가 제어하는 임베디드 사용자 에이전트로 인증 요청을 보내면 안 된다, developers.google.com/identity/protocols/oauth2/policies)
// PG 결제·본인인증도 막히는 곳이 많다. 그런 브라우저로 보이면 로그인·결제 버튼 앞에 「기본 브라우저로 열어 주세요」 안내와 이동 수단을 둔다.
//   · 카카오톡: 다른 브라우저로 여는 링크(iOS `kakaotalk://web/openExternal?url=` · 안드로이드 `intent://`). 이 주소 형식은 카카오 개발자 문서에서 확인하지 못했다 — 동작하지 않아도
//     아래 안내와 링크 복사가 늘 같이 있으니 막다른 길은 아니다(실기기 확인은 대장 A130).
//   · 그 밖의 앱: 강제로 열 방법이 없다 — 「⋯ 메뉴 → 다른 브라우저로 열기」 안내와 주소 복사.
// 서버 렌더에서는 그리지 않는다(UA 는 브라우저에서만 안다) — 일반 브라우저에서는 어디에도 나타나지 않는다. 문구는 모두 copy 칸.
export type InAppKind = "kakao" | "naver" | "instagram" | "facebook" | "line"

/** UA 글로 앱 안 브라우저를 가려낸다. 일반 브라우저(사파리·크롬)는 null */
export function detectInApp(ua: string): InAppKind | null {
  if (/KAKAOTALK/i.test(ua)) return "kakao"
  if (/NAVER\(inapp/i.test(ua)) return "naver"
  if (/Instagram/i.test(ua)) return "instagram"
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook"
  if (/\bLine\//i.test(ua)) return "line"
  return null
}

/** 카카오톡 인앱에서 기본 브라우저로 여는 주소: iOS 는 openExternal 스킴, 안드로이드는 intent:// (https 만) */
export function kakaoOpenHref(url: string, ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
  const m = url.match(/^(https?):\/\/(.+)$/)
  if (!m) return url
  return `intent://${m[2]}#Intent;scheme=${m[1]};S.browser_fallback_url=${encodeURIComponent(url)};end`
}

export type InAppEscapeCopy = {
  // 「이 화면에서는 로그인·결제가 안 될 수 있어요」
  title: string
  // 카카오톡이 아닌 앱: 「오른쪽 위 ⋯ 메뉴에서 다른 브라우저로 열어 주세요」
  guide: string
  // 카카오톡: 「기본 브라우저로 열기」 버튼 글
  open: string
  copy: CopyButtonCopy
}

const subscribeNone = () => () => {}

export function InAppEscape({ copy, className }: { copy: InAppEscapeCopy; className?: string }) {
  // UA·주소는 브라우저에서만 안다 — 서버 렌더는 빈 글(그리지 않음), 붙은 뒤 한 번 읽는다(외부 저장소 읽기라 효과 안 setState 가 없다)
  const ua = React.useSyncExternalStore(subscribeNone, () => navigator.userAgent, () => "")
  const url = React.useSyncExternalStore(subscribeNone, () => window.location.href, () => "")
  const app = detectInApp(ua)
  if (!app) return null
  const href = app === "kakao" ? kakaoOpenHref(url, ua) : null
  return (
    <div role="note" data-inapp={app} className={cn("flex w-full flex-col gap-3 border-s-2 border-foreground bg-muted p-4 text-muted-foreground", className)}>
      <p className="text-base leading-[1.4] text-foreground font-heading">{copy.title}</p>
      <p className="text-base leading-[1.6]">{copy.guide}</p>
      <div className="flex flex-wrap items-center gap-3">
        {href ? (
          <Button variant="outline" size="lg" nativeButton={false} render={<a href={href} />}>
            <ExternalLink aria-hidden="true" />
            {copy.open}
          </Button>
        ) : null}
        <CopyButton text={url} copy={copy.copy} size="lg" />
      </div>
    </div>
  )
}
