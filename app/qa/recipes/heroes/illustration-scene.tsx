// 검수대 틀(FV1 레인 DRAFTS): 히어로 블록 hero/illustration-scene(r13 A)을 레시피 사본(.tmp/blocks/r13-folio)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 그림(검수대 미디어 — 블록 검수대와 같은 칸) · 선택지의 면·기법 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroIllustrationScene } from "@/.tmp/blocks/r13-folio/hero/illustration-scene"
import { galleryMedia } from "@/app/qa/blocks/media"
import { fixture } from "@/registry/factory/blocks/hero/illustration-scene.fixture"

import { MediaCredit } from "./media"
import { HeroFrame, NextHint } from "./parts"
import { QuickHeader } from "./quick-header"
import type { HeroProps } from "./types"

export default function IllustrationScene({ r, o }: HeroProps) {
  const header = <QuickHeader r={r} brand="기록 문서첩(예시)" items={["문서", "연혁", "자료실"]} cta="문서 찾기" />
  return (
    <HeroFrame>
      <HeroIllustrationScene {...fixture} {...galleryMedia("block-hero-illustration-scene")} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["motkit", "reel-1"], ["motkit", "punch"]]} />
      <NextHint
        label="문서 안내"
        title="글이 먼저, 그림은 한 장"
        body="문서는 쪽마다 제목과 날짜를 먼저 적고, 그림은 첫 장에만 한 장 둡니다. 같은 자리에서 같은 순서로 읽히도록 목차와 본문의 위계를 늘 같게 지킵니다(예시)."
        cols={[{ k: "문서", v: "열두 편" }, { k: "연혁", v: "2019년부터" }, { k: "갱신", v: "분기마다" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
