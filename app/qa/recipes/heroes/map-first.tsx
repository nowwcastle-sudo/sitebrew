// 검수대 틀(FV1 레인 DRAFTS): 히어로 블록 hero/map-first(r12 A)를 레시피 사본(.tmp/blocks/r12-spectrum)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 선택지의 면·기법 · 다음 칸 머리. 지도 그림은 예시에 없어 블록이 도식 격자를 깐다. 문구는 블록 예시 콘텐츠.
import { HeroMapFirst } from "@/.tmp/blocks/r12-spectrum/hero/map-first"
import { fixture } from "@/registry/factory/blocks/hero/map-first.fixture"

import { HeroFrame, NextHint } from "./parts"
import { QuickHeader } from "./quick-header"
import type { HeroProps } from "./types"

export default function MapFirst({ r, o }: HeroProps) {
  const header = <QuickHeader r={r} brand="지표 지도(예시)" items={["지역별", "기관별", "내려받기"]} cta="지점 찾기" />
  return (
    <HeroFrame>
      <HeroMapFirst {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="지표 읽는 법"
        title="색 하나가 지표 하나입니다"
        body="지도 위 표지의 색은 지표 계열을 가리키고, 오른쪽 카드는 고른 지점의 수치를 같은 색으로 적습니다. 값은 모두 예시이며 기준 날짜를 카드 아래에 함께 적습니다(예시)."
        cols={[{ k: "계열", v: "다섯" }, { k: "지점", v: "셋" }, { k: "갱신", v: "매주 월요일" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
