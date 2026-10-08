// 검수대 틀(P3-2 Task 3): 히어로 블록 hero/framed-card-outline-title(r9 A)을 레시피 사본(.tmp/blocks/r9-clay)으로 그린다.
// 틀이 맡는 것: 머리(카드와 같은 면을 스스로 칠하는 둥근 머리 — 블록 뿌리 안 header 칸, 카드가 머리 아래로 5rem 올라와 겹친다) · 그림(public/media) ·
// 선택지의 면·기법 · 출처 · 다음 칸 머리(블록 뿌리의 여백 액자와 같은 좌우 여백). 문구는 블록 예시 콘텐츠.
import * as React from "react"

import { HeroFramedCardOutlineTitle } from "@/.tmp/blocks/r9-clay/hero/framed-card-outline-title"
import { fixture } from "@/registry/factory/blocks/hero/framed-card-outline-title.fixture"

import { MEDIA, MediaCredit } from "./media"
import { FACE_CLASS, HeroFrame, NextHint, RING, cx, faceAt } from "./parts"
import type { HeroProps } from "./types"

export default function FramedCardOutlineTitle({ r, o }: HeroProps) {
  const { ToggleGroup, ToggleGroupItem } = r.ui["toggle-group"]
  const { Menu, X } = r.glyphs
  const [lang, setLang] = React.useState<string[]>(["ko"])
  const [menu, setMenu] = React.useState(false)
  const k = faceAt(o, 0)
  // 머리는 칸과 같은 면을 스스로 칠한다(위 모서리만 둥글게 — 카드와 같은 토큰 반경 3xl) — 스크롤해도 면 글자가 제 면 위에 있다.
  const header = (
    <header data-sticky-nav {...(k ? { "data-face": k } : {})} className={cx("sticky top-2 z-30 flex h-20 items-center gap-3 rounded-t-3xl px-4 md:top-5 md:px-10", k ? FACE_CLASS[k] : "bg-muted")} onKeyDown={(e) => { if (e.key === "Escape") setMenu(false) }}>
      <button type="button" aria-label="메뉴" aria-expanded={menu} aria-controls="fco-menu" onClick={() => setMenu((v) => !v)} className={cx("inline-flex size-11 items-center justify-center", RING)}>
        {menu ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
      </button>
      <nav id="fco-menu" aria-label="주 메뉴" hidden={!menu} data-face-reset className="absolute start-4 top-full z-40 mt-2 w-64 rounded-[16px] border bg-background p-2 text-foreground md:start-10">
        <ul>
          {["오늘 빚은 떡", "빚는 과정", "단체 주문", "찾아오는 길"].map((t) => (
            <li key={t}>
              <a href="#top" className={cx("flex min-h-11 items-center rounded-[10px] px-3 font-bold hover:bg-muted", RING)}>
                {t}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <a href="#top" className={cx("font-heading inline-flex min-h-11 items-center text-[1.6rem] leading-none", RING)}>
        말랑 떡방
      </a>
      <ToggleGroup value={lang} onValueChange={(v) => { if ((v as string[]).length) setLang(v as string[]) }} aria-label="언어" className="ms-auto rounded-full border border-foreground p-0.5">
        {[["ko", "KO"], ["en", "EN"], ["ja", "JA"]].map(([v, t]) => (
          <ToggleGroupItem key={v} value={v} aria-label={`언어 ${t}`} className="min-w-11 rounded-full px-3 text-sm font-bold tracking-[0.08em] text-foreground aria-pressed:bg-background">
            {t}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </header>
  )
  return (
    <HeroFrame>
      <HeroFramedCardOutlineTitle {...fixture} header={header} media={MEDIA.r9Still} faces={o.faces} techniques={[...o.dyn]} />
      <MediaCredit items={[["r9-clay", "still"]]} />
      <div className="px-2 md:px-5">
        <NextHint
          label="빚는 시간"
          title="세 가지 속, 하루 두 번 빚습니다"
          body="아침 여덟 시와 오후 두 시에 빚고, 그날 빚은 것만 팝니다. 반죽을 두 번 쳐서 반나절이 지나도 쉽게 굳지 않습니다(예시)."
          cols={[{ k: "빚는 시간", v: "08:00 · 14:00" }, { k: "이달의 속", v: "유자 앙금" }, { k: "포장", v: "여섯 알 한 상자" }]}
          className="bg-background"
        />
      </div>
    </HeroFrame>
  )
}
