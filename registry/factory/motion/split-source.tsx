import * as React from "react"

// split-text 의 원천(motion-gsap): 읽기 도구용 sr-only 원문 하나 + 보이는 사본(aria-hidden, data-wf-split). splitReveal 이 사본만 쪼갠다 —
// 원문은 쪼개지지 않아 읽기 도구가 글자 조각을 하나씩 읽지 않는다. 동작 줄이기·M0 에서는 사본이 그대로 최종 모양이다.
// 보이는 사본은 "keep" 등장 대상이다(P3-4 perf, 대장 C173) — 히어로 제목은 LCP 후보라 첫 칠부터 보여야 한다. 숨기는 data-enter 였을 때는 motion-boot 가 장면(JS)이 시작하기 전까지 제목을 가려 LCP 가 하이드레이션 뒤로 밀렸다.
// 서버 HTML 로 이미 칠해진 구획은 등장을 끝 상태로 둔다(use-gsap-scene settleKept) — 클라이언트에서 처음 붙는 구획은 그대로 글자 조각이 올라온다.
// label: 원문(보이는 사본에 강조 span·줄바꿈이 있어도 읽기 도구에는 한 문장). 서버 컴포넌트에서도 쓴다(상태 없음).
export function SplitSource({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" data-wf-split="" data-enter="keep" className={className}>
        {children}
      </span>
    </>
  )
}
