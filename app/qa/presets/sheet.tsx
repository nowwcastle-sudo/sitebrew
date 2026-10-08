"use client"

// /qa/presets — 스타일 프리셋(references/styles/presets.json, P3-2 Task 16a) 접촉 시트. 프리셋마다 base.css + 그 프리셋의 축 값 9개로 컴파일한 부품
// (.tmp/presets/<프리셋>/ui — factory/scripts/gen-presets-gallery.mjs, npm run qa:presets, prebuild·predev 에서 자동)을 대표 초안 색([data-preset])으로 그린다.
// ?p=<프리셋 id> 면 그 프리셋 한 칸만(page.tsx 가 읽어 넘긴다). 헤더(H)·제목(D)·질감(X) 위 카드(C·S)·버튼(B)·입력(I)·배지(R)가 한 칸에 모인다. 이름·숫자는 모두 예시다.
import { presets } from "@/.tmp/presets/gallery"

type Preset = (typeof presets)[number]

function Tile({ p }: { p: Preset }) {
  const { Button } = p.ui.button
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } = p.ui.card
  const { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } = p.ui["navigation-menu"]
  const { Input } = p.ui.input
  const { Badge } = p.ui.badge
  const { DisplayTitle } = p.ui.display
  const { Texture } = p.ui.texture
  const here = "/qa/presets"
  return (
    <article
      data-preset={p.id}
      data-qa="preset-tile"
      aria-label={`${p.id} ${p.name}`}
      className="flex min-w-0 flex-col gap-4 overflow-hidden border bg-background p-4 text-foreground"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{p.name}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {p.axes} · {p.motion} · {p.logic} · 새로움 {p.novelty}
        </p>
      </header>
      <div className="overflow-x-auto p-1">
        <NavigationMenu aria-label={`${p.id} 주 메뉴`}>
          <span className="px-2 text-base font-bold whitespace-nowrap">달빛상회(예시)</span>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink active href={here}>
                소개
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href={here}>메뉴</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <DisplayTitle as="p">새벽 우유</DisplayTitle>
      <Texture className="p-3">
        <Card>
          <CardHeader>
            <CardTitle>이번 주 배송</CardTitle>
            <CardDescription>화·목 오전 7시 전(예시)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">흰 우유 2병, 요구르트 4개(예시).</p>
          </CardContent>
          <CardFooter>
            <Badge>확정</Badge>
          </CardFooter>
        </Card>
      </Texture>
      <div className="flex flex-wrap items-center gap-3">
        <Button>구독 시작하기</Button>
        <Button variant="outline">둘러보기</Button>
      </div>
      <Input aria-label={`${p.id} 이메일`} placeholder="이메일(예시)" />
      <p className="text-sm text-muted-foreground">팔레트 {p.palette}</p>
    </article>
  )
}

export function PresetSheet({ only }: { only?: string }) {
  const list = only ? presets.filter((p) => p.id === only) : presets
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
      <h1 className="font-heading text-3xl font-bold">스타일 프리셋 접촉 시트</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        프리셋 {presets.length}개(스타일 사전 {presets.filter((p) => p.source.startsWith("catalog:")).length} · 라이브러리 레시피{" "}
        {presets.filter((p) => p.source.startsWith("recipe:")).length}). 칸마다 그 프리셋의 축 값으로 컴파일한 부품을 대표 초안 색으로 그렸다. 서체는 검수대 기본이다.
      </p>
      <div data-qa="preset-grid" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((p) => (
          <Tile key={p.id} p={p} />
        ))}
      </div>
    </main>
  )
}
