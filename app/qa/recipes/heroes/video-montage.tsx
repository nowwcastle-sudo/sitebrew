// 검수대 틀(FV1 레인 R16-HERO): 히어로 블록 hero/video-montage(r16 A)를 레시피 사본(.tmp/blocks/r16-tonal)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 컷(검수대 미디어 motkit 영상 한 컷 + 사진 셋) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroVideoMontage } from "@/.tmp/blocks/r16-tonal/hero/video-montage"
import { galleryMedia } from "@/app/qa/blocks/media"
import { fixture } from "@/registry/factory/blocks/hero/video-montage.fixture"

import { MediaCredit } from "./media"
import { HeroFrame, NextHint } from "./parts"
import { QuickHeader } from "./quick-header"
import type { HeroProps } from "./types"

export default function VideoMontage({ r, o }: HeroProps) {
  const header = <QuickHeader r={r} brand="단색 노트(예시)" items={["기능", "요금", "소개"]} cta="체험 시작" />
  return (
    <HeroFrame>
      <HeroVideoMontage {...fixture} {...galleryMedia("block-hero-video-montage")} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["motkit", "reel-montage"], ["motkit", "kinetic-video"], ["motkit", "reel-0"], ["motkit", "reel-1"], ["motkit", "reel-2"]]} />
      <NextHint
        label="한 화면으로"
        title="화면 하나로 모든 것을 봅니다"
        body="장부와 정산, 세금 신고 준비를 한 화면에서 이어서 봅니다. 색은 한 가지로 줄이고 명도만 단계로 나눠 위계를 만듭니다(예시)."
        cols={[{ k: "화면", v: "하나" }, { k: "색", v: "한 가지" }, { k: "단계", v: "여섯" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
