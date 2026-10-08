// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/step-band-orbit(r1 A)을 레시피 사본(.tmp/blocks/r1-measure)으로 그린다.
// 틀이 맡는 것: 머리(블록 뿌리 안 header 칸) · 선택지의 기법 · 다음 칸 머리. 문구는 블록 예시 콘텐츠.
import { HeroStepBandOrbit } from "@/.tmp/blocks/r1-measure/hero/step-band-orbit"
import { fixture } from "@/registry/factory/blocks/hero/step-band-orbit.fixture"

import { HeroFrame, NavLinks, NextHint } from "./parts"
import type { HeroProps } from "./types"

export default function StepBandOrbit({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="flex h-16 items-center gap-6 px-6 md:px-10">
        <p className="font-heading text-sm tracking-[0.12em] uppercase">측선 연구소(예시)</p>
        <nav aria-label="주 메뉴" className="ms-auto hidden md:block">
          <NavLinks items={["데이터셋", "계측", "문서", "가격"]} className="text-sm" linkClass="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground" />
        </nav>
        <Button size="sm" variant="outline" className="ms-auto md:ms-0">
          로그인
        </Button>
      </div>
    </header>
  )
  return (
    <HeroFrame>
      <HeroStepBandOrbit {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <NextHint
        label="측정 흐름"
        title="잰 값은 도면 한 장에 모입니다"
        body="기준점 측정, 궤도 맞춤, 오차 보고가 한 흐름입니다. 단계마다 누가 언제 무엇을 바꿨는지 기록이 남아, 다음 측정에서 같은 실수를 되풀이하지 않습니다(예시)."
        cols={[{ k: "기준점", v: "12곳" }, { k: "평균 오차", v: "3cm" }, { k: "보고 주기", v: "매주 월요일" }]}
        className="border-t bg-background"
      />
    </HeroFrame>
  )
}
