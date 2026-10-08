// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/baseline-split(r1 B)을 레시피 사본(.tmp/blocks/r1-measure — 그 레시피 컴파일 부품)으로 그린다.
// 틀이 맡는 것: 머리(보드에서 고른 모양 그대로 — 블록 뿌리 안 header 칸에 넣어 첫 화면과 한 장면을 나눈다) · 실사 사진(public/media) ·
// 선택지(A/B)의 기법·모션·다크 구역 속성 · 사진 출처 · 다음 칸 머리(NextHint). 문구는 블록 예시 콘텐츠(fixture)다.
import { HeroBaselineSplit } from "@/.tmp/blocks/r1-measure/hero/baseline-split"
import { fixture } from "@/registry/factory/blocks/hero/baseline-split.fixture"

import { MEDIA, MediaCredit } from "./media"
import { HeroFrame, DarkZone, NavLinks, NextHint } from "./parts"
import type { HeroProps } from "./types"

export default function BaselineSplit({ r, o, zone }: HeroProps) {
  const { Button } = r.ui.button
  const header = (
    <DarkZone zone={zone} as="header" className="sticky top-0 z-30 border-b">
      <div className="flex h-16 items-center gap-6 px-6 md:px-10">
        <p className="font-heading text-[1.25rem] tracking-[0.04em]">측선 공업(예시)</p>
        <nav aria-label="주 메뉴" className="ms-auto hidden md:block">
          <NavLinks items={["강판 규격", "이음 시험", "교정 기록", "납품 일정", "상담"]} className="text-sm" linkClass="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground" />
        </nav>
        <Button size="sm" variant="outline" className="ms-auto md:ms-0">
          찾기
        </Button>
      </div>
    </DarkZone>
  )
  return (
    <HeroFrame>
      <HeroBaselineSplit {...fixture} header={header} media={MEDIA.r1Field} techniques={[...o.dyn]} darkScope={zone} />
      <MediaCredit items={[["r1-measure", "field"]]} />
      <NextHint
        label="설비와 시험"
        title="같은 기준선, 세 개의 시험대"
        body="인장·굽힘·피로 시험을 한 건물에서 합니다. 시험대마다 교정일과 담당자를 적어 두어, 성적서의 숫자가 어느 기계에서 나왔는지 바로 찾을 수 있습니다(예시)."
        cols={[{ k: "시험대", v: "3기" }, { k: "교정 주기", v: "90일" }, { k: "성적서", v: "출고 전날" }]}
        className="bg-background"
      />
    </HeroFrame>
  )
}
