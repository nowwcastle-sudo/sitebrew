// 검수대 틀(FV1 레인 DRAFTS): 히어로 블록 hero/ken-burns-stills(r15 A)를 레시피 사본(.tmp/blocks/r15-atelier)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 사진 넷(검수대 미디어 motkit/reel-0~3) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroKenBurnsStills } from "@/.tmp/blocks/r15-atelier/hero/ken-burns-stills"
import { galleryMedia } from "@/app/qa/blocks/media"
import { fixture } from "@/registry/factory/blocks/hero/ken-burns-stills.fixture"

import { MediaCredit } from "./media"
import { HeroFrame, NextHint } from "./parts"
import { QuickHeader } from "./quick-header"
import type { HeroProps } from "./types"

export default function KenBurnsStills({ r, o }: HeroProps) {
  const header = <QuickHeader r={r} brand="아틀리에 지면(예시)" items={["작업", "공방", "소식"]} cta="방문 예약" />
  return (
    <HeroFrame>
      <HeroKenBurnsStills {...fixture} {...galleryMedia("block-hero-ken-burns-stills")} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["motkit", "reel-0"], ["motkit", "reel-1"], ["motkit", "reel-2"], ["motkit", "reel-3"]]} />
      <NextHint
        label="공방 이야기"
        title="한 계절에 한 가지만 만듭니다"
        body="공방은 계절마다 한 가지 물건만 만들고, 만든 순서대로 번호를 붙여 보관합니다. 방문은 하루 두 팀까지 받습니다(예시)."
        cols={[{ k: "계절", v: "넷" }, { k: "방문", v: "하루 두 팀" }, { k: "번호", v: "순서대로" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
