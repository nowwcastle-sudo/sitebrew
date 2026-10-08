// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/inline-chip-title(r2 B)을 레시피 사본(.tmp/blocks/r2-signal)으로 그린다.
// 틀이 맡는 것: 머리(알약 내비 — 블록 뿌리 안 header 칸) · 칩 사진(public/media) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroInlineChipTitle } from "@/.tmp/blocks/r2-signal/hero/inline-chip-title"
import { fixture } from "@/registry/factory/blocks/hero/inline-chip-title.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, NavLinks, NextHint } from "./parts"
import type { HeroProps } from "./types"

export default function InlineChipTitle({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <header className="sticky top-0 z-30 flex justify-center px-4 py-3">
      <nav aria-label="주 메뉴" className="pill flex items-center gap-1 rounded-full border bg-background py-1 ps-5 pe-1">
        <p className="me-3 font-bold">신호 연구소</p>
        <NavLinks items={["작업", "사람", "소식"]} className="hidden text-sm sm:flex" linkClass="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground" />
        <Button size="sm" className="ms-2 rounded-full">
          의뢰
        </Button>
      </nav>
    </header>
  )
  return (
    <HeroFrame>
      <HeroInlineChipTitle {...fixture} header={header} media={MEDIA.r2Chip} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r2-signal", "chip"]]} />
      <NextHint
        label="하는 일"
        title="크게 말하고, 작게 다듬습니다"
        body="포스터 한 장, 간판 하나, 화면 한 칸을 같은 목소리로 맞춥니다. 첫 만남에서 한 줄 메시지를 정하고, 그 줄이 모든 크기에서 읽히는지 거리마다 확인합니다(예시)."
        cols={[{ k: "포스터", v: "180장" }, { k: "간판", v: "42곳" }, { k: "화면", v: "12개" }]}
        className="bg-background [background-image:repeating-linear-gradient(0deg,color-mix(in_oklch,var(--foreground)_5%,transparent)_0_1px,transparent_1px_4px)]"
      />
    </HeroFrame>
  )
}
