// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/cropped-title-list(r2 A)를 레시피 사본(.tmp/blocks/r2-signal)으로 그린다.
// 틀이 맡는 것: 머리(오른쪽 3/4 면 · 대괄호 메뉴 — 블록 뿌리 안 header 칸, 블록 장면이 머리 면 쓸기·체크·버튼도 등장시킨다) · 선택지의 면·기법 ·
// 다음 칸 머리(면 위). 문구는 블록 예시 콘텐츠. 머리의 대괄호 칸 모양은 heroes.css(틀 몫).
import { HeroCroppedTitleList } from "@/.tmp/blocks/r2-signal/hero/cropped-title-list"
import { fixture } from "@/registry/factory/blocks/hero/cropped-title-list.fixture"

import { FACE_CLASS, Face, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

const MENU = ["작업", "사람", "소식", "문의"]

export default function CroppedTitleList({ r, o }: HeroProps) {
  const { Button } = r.ui.button
  const k = faceAt(o, 0)
  const header = (
    <header className="sticky top-0 z-30 grid grid-cols-4 bg-background">
      <p className="font-heading flex h-16 items-center px-4 text-[1.25rem] md:px-6">신호 연구소</p>
      <Face k={k} fallback="bg-primary text-primary-foreground" enter className="head-face col-span-3 flex h-16 items-center gap-2 px-3 md:px-6">
        <nav aria-label="주 메뉴" className="min-w-0 overflow-x-auto">
          <ul className="flex">
            {MENU.map((t, i) => (
              <li key={t}>
                <a href="#top" aria-current={i === 3 ? "page" : undefined} className={cx("bracket inline-flex min-h-11 items-center gap-2 px-2 whitespace-nowrap md:px-3", RING)}>
                  <span aria-hidden="true" className="box" />
                  {t}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span data-enter className="head-cta ms-auto hidden sm:inline-flex">
          <Button size="sm">의뢰하기</Button>
        </span>
      </Face>
    </header>
  )
  return (
    <HeroFrame>
      <HeroCroppedTitleList {...fixture} header={header} faces={o.faces} techniques={[...o.dyn]} />
      <Face k={k} as="div" fallback="border-t">
        {/* 다음 칸 머리도 면 색을 스스로 칠한다 — 투명하면 합성 층에서 글자가 회색조 안티앨리어싱으로 바뀐다(승격 전후 픽셀 대조에서 실측). */}
        <NextHint
          className={k ? FACE_CLASS[k] : "bg-background"}
          label="하는 일"
          title="흑과 백, 그리고 한 가지 색"
          body="간판·포스터·화면에 같은 목소리를 씁니다. 두 색으로 시작해 필요한 곳에만 색을 더하고, 글자는 멀리서 먼저 읽히도록 크게 둡니다(예시)."
          cols={[{ k: "간판", v: "42곳" }, { k: "포스터", v: "180장" }, { k: "화면", v: "12개" }]}
        />
      </Face>
    </HeroFrame>
  )
}
