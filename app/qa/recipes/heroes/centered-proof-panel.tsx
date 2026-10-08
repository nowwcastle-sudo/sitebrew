// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/centered-proof-panel(r4 B)을 레시피 사본(.tmp/blocks/r4-evidence)으로 그린다.
// 틀이 맡는 것: 머리(공지 띠 + 짙은 머리 — 블록 뿌리 안 header 칸) · 선택지의 면·기법·다크 구역 속성 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroCenteredProofPanel } from "@/.tmp/blocks/r4-evidence/hero/centered-proof-panel"
import { fixture } from "@/registry/factory/blocks/hero/centered-proof-panel.fixture"

import { DarkZone, Face, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function CenteredProofPanel({ r, o, zone }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <div data-sticky-nav className="sticky top-0 z-30">
      <Face k={k} fallback="bg-muted" className="flex min-h-9 items-center justify-center px-4 text-sm">
        <p>예시 — 근거 보고서 3판이 나왔습니다</p>
      </Face>
      <DarkZone zone={zone} as="header">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-8">
          <p className="font-heading text-[1.3rem]">근거함</p>
          <nav aria-label="주 메뉴" className="hidden rounded-full border px-2 md:block">
            <ul className="flex text-sm">
              {["근거 찾기", "보관 방식", "도입 기관", "요금"].map((t, i) => (
                <li key={t}>
                  <a href="#top" aria-current={i === 0 ? "page" : undefined} className={cx("inline-flex min-h-11 items-center px-4 text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground", RING)}>
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Button size="sm" className="justify-self-end rounded-full">
            내 문서로 해 보기
          </Button>
        </div>
      </DarkZone>
    </div>
  )
  return (
    <HeroFrame>
      <HeroCenteredProofPanel {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} darkScope={zone} />
      <NextHint
        label="보안"
        title="문서는 우리 쪽으로 오지 않습니다"
        body="검색은 고객의 저장소 안에서 돌고, 우리는 답과 근거 위치만 받습니다. 권한이 없는 문서는 근거로도 쓰지 않아, 답을 보는 사람마다 볼 수 있는 근거가 다릅니다(예시)."
        cols={[{ k: "저장 위치", v: "고객 저장소" }, { k: "권한", v: "문서 단위" }, { k: "기록", v: "90일 보관" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
