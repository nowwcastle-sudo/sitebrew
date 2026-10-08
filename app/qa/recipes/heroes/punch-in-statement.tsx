// 검수대 틀(FV1 레인 DRAFTS): 히어로 블록 hero/punch-in-statement(r14 A)를 레시피 사본(.tmp/blocks/r14-concrete)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 확대 컷 그림(검수대 미디어) · 선택지의 면·기법 · 출처 · 다음 칸 머리. 제목·안내 글은 사진 위가 아니라 바탕 위다. 문구는 블록 예시 콘텐츠.
import { HeroPunchInStatement } from "@/.tmp/blocks/r14-concrete/hero/punch-in-statement"
import { galleryMedia } from "@/app/qa/blocks/media"
import { fixture } from "@/registry/factory/blocks/hero/punch-in-statement.fixture"

import { MediaCredit } from "./media"
import { HeroFrame, NextHint } from "./parts"
import { QuickHeader } from "./quick-header"
import type { HeroProps } from "./types"

export default function PunchInStatement({ r, o }: HeroProps) {
  const header = <QuickHeader r={r} brand="정산기(예시)" items={["기능", "요금", "변경 내역"]} cta="무료로 시작" />
  return (
    <HeroFrame>
      <HeroPunchInStatement {...fixture} {...galleryMedia("block-hero-punch-in-statement")} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["motkit", "punch"]]} />
      <NextHint
        label="하는 일"
        title="표 파일 하나로 시작합니다"
        body="카드 매출과 배달 정산, 현금 영수증을 한 장부에서 맞춥니다. 표 파일을 한 번 올리면 다음 달부터는 따로 손댈 일이 거의 없습니다(예시)."
        cols={[{ k: "올리기", v: "표 파일 하나" }, { k: "맞추기", v: "자동" }, { k: "내보내기", v: "한 번에" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
