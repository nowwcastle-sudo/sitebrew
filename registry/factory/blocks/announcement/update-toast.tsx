"use client"

import * as React from "react"

import type { BlockBase } from "@/registry/factory/contract/block-contract"
import type { AnalyticsPort } from "@/registry/factory/contract/ports"
import { cn } from "@/registry/factory/lib/utils"

import { ChoiceButton, ChoiceRow } from "../_shared/choice-pair"
import { useDismissMemory } from "../_shared/dismiss-memory"
import { ScrollText, useFloatingSpace } from "../_shared/floating-kit"

// 새 판 알림 토스트(PWA·앱형 사이트). 서비스 워커가 새 판을 받아 기다리고 있을 때(available) 화면 아래에 작게 뜬다: 「새 판이 나왔어요」 + [지금 새로 고침][나중에].
// 두 선택지는 대등하다(choice-pair, L3) — 새로 고침은 입력하던 것을 잃을 수 있으니 「나중에」가 같은 무게로 있다. 「나중에」는 이 방문 동안 기억한다(version 마다 — 새 판이 또 나오면 다시 뜬다).
// 높이는 화면의 35%(35dvh)를 넘지 않는다 — 글이 길면 글 칸만 스크롤 칸(ScrollText)이 되고 두 단추 줄은 늘 보인다(marketing first-screen-modal 문턱).
// 알림은 role="status"(읽기 도구가 정중하게 읽는다)이고 초점을 빼앗지 않는다. 닫으면 DOM 에서 지운다(숨김 처리만 하지 않는다). 하단 탭·쿠키 띠 위로 올라앉는다(--bottom-bar-height·--wf-float-bar)
// 아래에 앉아 가리는 높이만큼 scroll-padding-bottom 을 준다(WCAG 2.4.11). 서비스 워커 연결은 조립하는 쪽 몫이다: available 은 대기 중인 워커가 있을 때 true, onUpdate 가 건너뛰기 신호를 보내고
// 새로 고친다(없으면 쪽을 다시 읽는다). 계측(선택): cta_click.
export type AnnouncementUpdateToastCopy = {
  title: string
  body?: string
  update: string
  later: string
}
export type AnnouncementUpdateToastProps = BlockBase<AnnouncementUpdateToastCopy> & {
  // 새 판이 기다리는가(서비스 워커 waiting). 갤러리 예시는 켜 둔다
  available?: boolean
  // 판 이름 — 「나중에」를 이 이름으로 기억한다(새 판이 나오면 이름이 바뀌어 다시 뜬다)
  version?: string
  onUpdate?: () => void
  track?: AnalyticsPort["track"]
}

export function AnnouncementUpdateToast({ copy, available = true, version = "latest", onUpdate, track, id = "update-toast", className }: AnnouncementUpdateToastProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { dismissed, set } = useDismissMemory(`wf-update-later:${version}`, "session")
  const [later, setLater] = React.useState(false)
  const shown = available && !later && dismissed !== true
  useFloatingSpace(ref, { active: shown })
  if (!shown) return null
  return (
    <div ref={ref} id={id} role="status" data-block="announcement-update-toast" data-version={version} className={cn("cn-block-ut-toast", className)}>
      <ScrollText labelledBy={`${id}-title`} className="cn-block-ut-text">
        <p id={`${id}-title`} className="cn-block-ut-title font-heading-ko">
          {copy.title}
        </p>
        {copy.body ? <p className="cn-block-ut-body">{copy.body}</p> : null}
      </ScrollText>
      <ChoiceRow label={copy.title} className="cn-block-ut-actions">
        <ChoiceButton
          choice="decline"
          type="button"
          onClick={() => {
            track?.("cta_click", { id: "update-toast-later", label: copy.later, section: id })
            setLater(true)
            set(true)
          }}
        >
          {copy.later}
        </ChoiceButton>
        <ChoiceButton
          choice="primary"
          type="button"
          onClick={() => {
            track?.("cta_click", { id: "update-toast-update", label: copy.update, section: id })
            if (onUpdate) onUpdate()
            else window.location.reload()
          }}
        >
          {copy.update}
        </ChoiceButton>
      </ChoiceRow>
    </div>
  )
}
