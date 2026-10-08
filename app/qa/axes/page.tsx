"use client"

// /qa/axes — 스타일 축 9개(버튼·입력·카드·표·헤더·반경·그림자·디스플레이 규모·질감)의 값과 색 논리 K9 예시를 나란히 펼친 검수대.
// 값마다 base.css 위에 그 값 CSS 하나만 얹어 컴파일한 부품이다(.tmp/axes/<값>/ui — factory/scripts/gen-axes-gallery.mjs,
// npm run qa:axes, prebuild·predev 에서 자동). 동작 검사 표식(confirm-open·toast-trigger·filter)은 반경 R0 칸에 있다. 숫자는 모두 예시값이다.
import * as React from "react"
import { ArrowRightIcon, PlusIcon, SearchIcon } from "lucide-react"

import * as G from "@/.tmp/axes/gallery"
// 질감 대비 실측(factory/qa/texture-contrast.mjs)의 레시피 3벌 칸이 쓰는 색 변수 — [data-recipe] 로 가둔다(gen-recipes-gallery.mjs 생성물).
import "@/.tmp/recipes/recipes.css"

const AXIS_TITLE: Record<string, string> = {
  button: "버튼 형태",
  input: "입력 채움",
  surface: "카드 · 표면",
  table: "표 밀도",
  header: "헤더 · 내비",
  radius: "반경(나머지 부품)",
  shadow: "그림자",
  display: "디스플레이 규모",
  texture: "질감",
  color: "색 논리",
}

const won = new Intl.NumberFormat("ko-KR")
const ROWS = [
  { item: "흰 우유 1L", qty: 24, price: 2980 },
  { item: "저지방 우유 1L", qty: 12, price: 3120 },
  { item: "초코 우유 200mL", qty: 40, price: 1150 },
  { item: "딸기 우유 200mL", qty: 30, price: 1150 },
  { item: "요구르트 150mL", qty: 60, price: 890 },
]

function Axis({ axis, children }: { axis: string; children: React.ReactNode }) {
  return (
    <section id={`axis-${axis}`} aria-labelledby={`axis-${axis}-title`} className="scroll-mt-16 border-t py-10">
      <h2 id={`axis-${axis}-title`} className="mb-6 font-heading text-2xl font-semibold">
        {AXIS_TITLE[axis]}
      </h2>
      {children}
    </section>
  )
}

// with: 그 값만으로는 명세대로 보이지 않아 밑에 깐 호환 짝 값(gen-axes-gallery.mjs COMPANIONS). 칸 제목에 드러낸다.
function Value({ id, note, children, tray, with: withIds = [] }: { id: string; note: string; children: React.ReactNode; tray?: boolean; with?: string[] }) {
  return (
    // data-axes: 칸의 축 값(깐 짝 값 포함) — AI 티 관문(factory/qa/ai-tell.mjs)이 축 한정 예외를 칸 안에만 적용할 때 읽는다
    <article aria-label={note} data-axes={[id, ...withIds].join(" ")} className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">
        {id} <span className="font-normal text-muted-foreground">{note.replace(/^[A-Z]\d\s*(·\s*)?/, "")}</span>
        {withIds.length > 0 && <span className="font-normal text-muted-foreground"> ({withIds.join("·")} 위)</span>}
      </h3>
      <div className={tray ? "rounded-md bg-muted p-6" : "p-1"}>{children}</div>
    </article>
  )
}

const grid = "grid gap-8 md:grid-cols-2 xl:grid-cols-4"

function ButtonValue({ v }: { v: (typeof G.button)[number] }) {
  const { Button } = v.ui.button
  const { ButtonGroup } = v.ui["button-group"]
  return (
    <Value id={v.id} note={v.note}>
      <div className="flex flex-col items-start gap-4">
        <div className="flex flex-wrap gap-3">
          <Button>
            발주 확정하기 <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
          <Button variant="outline">견적 보기</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm">
            임시 저장
          </Button>
          <Button variant="ghost" size="sm">
            취소
          </Button>
          <Button variant="destructive" size="sm">
            삭제
          </Button>
          <Button size="icon" variant="outline" aria-label="품목 추가">
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
        <Button size="lg">무료로 시작하기</Button>
        <ButtonGroup aria-label="보기 전환">
          <Button variant="outline" size="sm">
            일
          </Button>
          <Button variant="outline" size="sm">
            주
          </Button>
          <Button variant="outline" size="sm">
            월
          </Button>
        </ButtonGroup>
      </div>
    </Value>
  )
}

function InputValue({ v }: { v: (typeof G.input)[number] }) {
  const { Input } = v.ui.input
  const { Textarea } = v.ui.textarea
  const { NativeSelect, NativeSelectOption } = v.ui["native-select"]
  const { InputGroup, InputGroupAddon, InputGroupInput } = v.ui["input-group"]
  const { Field, FieldLabel, FieldError, FieldDescription } = v.ui.field
  const k = v.slug
  return (
    <Value id={v.id} note={v.note}>
      <div className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor={`${k}-empty`}>받는 사람(필수)</FieldLabel>
          <Input id={`${k}-empty`} autoComplete="name" placeholder="예: 김하늘" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${k}-filled`}>연락처(선택)</FieldLabel>
          <Input id={`${k}-filled`} type="tel" autoComplete="tel" defaultValue="010-1234-5678" />
        </Field>
        <Field data-invalid>
          <FieldLabel htmlFor={`${k}-invalid`}>배송 날짜(필수)</FieldLabel>
          <Input id={`${k}-invalid`} aria-invalid aria-describedby={`${k}-invalid-err`} defaultValue="2026-02-30" />
          <FieldError id={`${k}-invalid-err`}>달력에 있는 날짜를 입력해 주세요.</FieldError>
        </Field>
        <Field data-disabled>
          <FieldLabel htmlFor={`${k}-disabled`}>대리점(변경 불가)</FieldLabel>
          <Input id={`${k}-disabled`} disabled defaultValue="성동대리점(예시)" />
          <FieldDescription>계약 기간 중에는 바꿀 수 없습니다.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${k}-select`}>도착 시간대</FieldLabel>
          <NativeSelect id={`${k}-select`} defaultValue="am">
            <NativeSelectOption value="am">오전 6~10시</NativeSelectOption>
            <NativeSelectOption value="pm">오후 2~6시</NativeSelectOption>
          </NativeSelect>
        </Field>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput aria-label="품목 검색" placeholder="품목 이름" />
        </InputGroup>
        <Field>
          <FieldLabel htmlFor={`${k}-note`}>요청 사항(선택)</FieldLabel>
          <Textarea id={`${k}-note`} placeholder="예: 뒷문에 놓아 주세요" />
        </Field>
      </div>
    </Value>
  )
}

function SurfaceValue({ v }: { v: (typeof G.surface)[number] }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } = v.ui.card
  const { Button } = v.ui.button
  const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } = v.ui.dialog
  return (
    <Value id={v.id} note={v.note} tray with={v.with}>
      {v.id === "C5" && (
        // C5 의 블러는 모달 배경에만 걸린다 — 흐르는 카드는 불투명(DESIGN §6). 열어서 배경 블러를 본다.
        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="mb-4" />}>모달 배경 보기</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>발주 요약</DialogTitle>
              <DialogDescription>배경이 20px 흐려지고, 투명도를 줄이는 설정에서는 불투명해집니다.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Card>
        <CardHeader>
          <CardTitle>이번 주 발주</CardTitle>
          <CardDescription>목요일 오전 도착(예시)</CardDescription>
        </CardHeader>
        <CardContent>
          <p>흰 우유 24팩, 저지방 12팩, 초코 40팩. 합계 {won.format(160760)}원(예시).</p>
        </CardContent>
        <CardFooter>
          <Button size="sm" variant="outline">
            내역 보기
          </Button>
        </CardFooter>
      </Card>
    </Value>
  )
}

function TableValue({ v }: { v: (typeof G.table)[number] }) {
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } = v.ui.table
  return (
    <Value id={v.id} note={v.note}>
      <Table>
        <TableCaption>품목별 발주(예시)</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>품목</TableHead>
            <TableHead className="text-right">수량</TableHead>
            <TableHead className="text-right">금액(원)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((r) => (
            <TableRow key={r.item}>
              <TableCell>{r.item}</TableCell>
              <TableCell className="text-right tabular-nums">{r.qty}</TableCell>
              <TableCell className="text-right tabular-nums">{won.format(r.qty * r.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Value>
  )
}

function Nav({ v }: { v: (typeof G.header)[number] }) {
  const { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink, NavigationMenuTrigger, NavigationMenuContent } =
    v.ui["navigation-menu"]
  const { Button } = v.ui.button
  const here = `/qa/axes#axis-header`
  return (
    <NavigationMenu aria-label={`${v.id} 주 메뉴`}>
      <span className="px-2 text-base font-bold whitespace-nowrap">우유상회(예시)</span>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink active href={here}>
            발주
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href={here}>정산</NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>품목</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href={here}>우유·유제품</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <Button size="sm">발주하기</Button>
    </NavigationMenu>
  )
}

function HeaderValue({ v }: { v: (typeof G.header)[number] }) {
  if (v.id !== "H4")
    return (
      <Value id={v.id} note={v.note} tray>
        {/* 스크롤 그릇은 링(box-shadow)을 자르므로 p-1 로 여유를 둔다. */}
        <div className="overflow-x-auto p-1">
          <Nav v={v} />
        </div>
      </Value>
    )
  const { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction, SidebarMenu, SidebarMenuItem, SidebarMenuButton } =
    v.ui.sidebar
  return (
    <Value id={v.id} note={v.note}>
      <SidebarProvider className="min-h-0 overflow-hidden rounded-md border">
        <Sidebar collapsible="none" aria-label="H4 사이드 레일">
          <SidebarHeader>
            <span className="text-base font-bold">운영 콘솔(예시)</span>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>발주</SidebarGroupLabel>
              {/* 묶음 동작은 라벨과 한 줄(첫 메뉴 줄과 겹치지 않는다 — 최종 수정) */}
              <SidebarGroupAction aria-label="발주 추가">
                <PlusIcon />
              </SidebarGroupAction>
              <SidebarMenu>
                {["오늘 발주", "대리점", "정산"].map((t, i) => (
                  <SidebarMenuItem key={t}>
                    <SidebarMenuButton isActive={i === 0}>{t}</SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <Nav v={v} />
        </div>
      </SidebarProvider>
    </Value>
  )
}

// 확정 흐름(DESIGN §7-B) — /qa/base 와 같은 동작 표식. [취소]가 처음 포커스를 받는다(부품 규칙).
function ConfirmOrder({ v }: { v: (typeof G.radius)[number] }) {
  const { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } =
    v.ui["alert-dialog"]
  const { Button } = v.ui.button
  const [open, setOpen] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState(false)
  const [shown, setShown] = React.useState(false)
  return (
    <div className="flex flex-col gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (next) setShown(confirmed)
          setOpen(next)
        }}
      >
        <AlertDialogTrigger data-qa="confirm-open" render={<Button />}>
          {confirmed ? "확정된 발주 보기" : "발주 확정하기"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이번 주 발주 60팩을 확정할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {shown ? "이미 확정된 발주입니다. 바꾸려면 대리점에 직접 연락해 주세요." : "확정하면 대리점으로 주문이 바로 전송되고 취소할 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{shown ? "닫기" : "취소"}</AlertDialogCancel>
            {!shown && (
              <AlertDialogAction
                onClick={() => {
                  const w = window as unknown as { __orders?: number }
                  w.__orders = (w.__orders || 0) + 1
                  setConfirmed(true)
                  setOpen(false)
                }}
              >
                60팩 주문 확정
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p role="status" className="text-sm leading-relaxed text-muted-foreground">
        {confirmed ? "발주를 확정했습니다(예시)." : "아직 확정하지 않았습니다."}
      </p>
    </div>
  )
}

function RadiusValue({ v, behavior }: { v: (typeof G.radius)[number]; behavior?: boolean }) {
  const { Badge } = v.ui.badge
  const { Tabs, TabsList, TabsTrigger, TabsContent } = v.ui.tabs
  const { ToggleGroup, ToggleGroupItem } = v.ui["toggle-group"]
  const { Checkbox } = v.ui.checkbox
  const { Switch } = v.ui.switch
  const { RadioGroup, RadioGroupItem } = v.ui["radio-group"]
  const { Alert, AlertTitle, AlertDescription } = v.ui.alert
  const { Progress, ProgressLabel, ProgressValue } = v.ui.progress
  const { Kbd } = v.ui.kbd
  const { Avatar, AvatarFallback } = v.ui.avatar
  const { Label } = v.ui.label
  const { Button } = v.ui.button
  const { toast } = v.ui.toast
  return (
    <Value id={v.id} note={v.note}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>확정</Badge>
          <Badge variant="secondary">초안</Badge>
          <Badge variant="outline">배송 중</Badge>
          <Avatar>
            <AvatarFallback>김</AvatarFallback>
          </Avatar>
          <Kbd>Ctrl</Kbd>
        </div>
        <Tabs defaultValue="week">
          <TabsList aria-label={`${v.id} 기간`}>
            <TabsTrigger value="week">이번 주</TabsTrigger>
            <TabsTrigger value="month">이번 달</TabsTrigger>
          </TabsList>
          <TabsContent value="week">이번 주 발주 60팩(예시)</TabsContent>
          <TabsContent value="month">이번 달 발주 240팩(예시)</TabsContent>
        </Tabs>
        <ToggleGroup multiple defaultValue={["white"]} aria-label={`${v.id} 품목 필터`}>
          <ToggleGroupItem data-qa={behavior ? "filter" : undefined} value="white">
            흰 우유
          </ToggleGroupItem>
          <ToggleGroupItem data-qa={behavior ? "filter" : undefined} value="lowfat">
            저지방
          </ToggleGroupItem>
          <ToggleGroupItem data-qa={behavior ? "filter" : undefined} value="choco">
            초코
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-wrap items-center gap-6">
          <Label className="flex items-center gap-2">
            <Checkbox defaultChecked /> 저지방 포함
          </Label>
          <Label className="flex items-center gap-2">
            <Switch defaultChecked /> 자동 발주
          </Label>
        </div>
        <RadioGroup defaultValue="am" aria-label={`${v.id} 도착 시간대`} className="flex gap-6">
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="am" /> 오전
          </Label>
          <Label className="flex items-center gap-2">
            <RadioGroupItem value="pm" /> 오후
          </Label>
        </RadioGroup>
        <Progress value={60} aria-label={`${v.id} 주간 발주 진행`}>
          <ProgressLabel>주간 발주 진행</ProgressLabel>
          <ProgressValue />
        </Progress>
        <Alert>
          <AlertTitle>수요일 오후 3시 마감</AlertTitle>
          <AlertDescription>그 뒤에 확정하면 금요일에 도착합니다(예시).</AlertDescription>
        </Alert>
        {behavior && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <ConfirmOrder v={v} />
            <Button
              variant="outline"
              data-qa="toast-trigger"
              onClick={() =>
                toast.add({
                  title: "발주를 임시 저장했습니다.",
                  description: "4초 안에 되돌릴 수 있습니다.",
                  timeout: 4000,
                  actionProps: { children: "되돌리기" },
                })
              }
            >
              임시 저장하기
            </Button>
          </div>
        )}
      </div>
    </Value>
  )
}

// 디스플레이 규모(D, Task 16a): 같은 제목을 값마다 그린다. 제목 수준을 늘리지 않게 p 로 그린다(검수대 제목 체계는 h1·h2·h3).
// D2 는 긴 낱말도 칸을 넘지 않고 줄을 바꾸는지(잘림 없음), D3 은 처음 그릴 때만 움직이고 동작 줄이기에서 정지인지 qa:measure 가 잰다.
function DisplayValue({ v }: { v: (typeof G.display)[number] }) {
  const { DisplayTitle } = v.ui.display
  const { Button } = v.ui.button
  return (
    <Value id={v.id} note={v.note}>
      <div className="flex min-w-0 flex-col items-start gap-4">
        <DisplayTitle as="p" data-qa="display-title">
          새벽에 도착하는 우유
        </DisplayTitle>
        <DisplayTitle as="p" data-qa="display-long">
          정기배송구독관리
        </DisplayTitle>
        <p className="max-w-prose leading-relaxed text-muted-foreground">매주 화·목 오전 7시 전에 문 앞에 둡니다(예시).</p>
        <Button>배송 요일 고르기</Button>
      </div>
    </Value>
  )
}

// 질감(X, Task 16a): 면 구획(Texture) 안에 본문·보조 글자·버튼을 둔다. 무늬 층의 불투명도·합성 방식은 qa:measure 가, 무늬 위 글자 대비는 lint texture-contrast 가 본다.
function TextureValue({ v }: { v: (typeof G.texture)[number] }) {
  const { Texture } = v.ui.texture
  const { Button } = v.ui.button
  return (
    <Value id={v.id} note={v.note}>
      <Texture data-qa="texture" className="flex flex-col items-start gap-3 p-8 pt-12">
        <p className="text-xl font-semibold">이번 주 제철 우유</p>
        <p className="leading-relaxed text-muted-foreground">목장에서 받은 날 병에 담아 보냅니다(예시).</p>
        <Button variant="outline">목장 소개 보기</Button>
      </Texture>
    </Value>
  )
}

// 질감 × 레시피 팔레트 3벌 실측칸(P3-6): 사진 질감(X4~X8)의 글자 대비는 식으로 알 수 없어 Chrome 이 그린 픽셀로 잰다 — factory/qa/texture-contrast.mjs 가
// `[data-tc-cell]` 칸의 `[data-tc]` 글자(title·body·muted·button) 뒤 바탕을 표본한다. 간유리(X7·X8)는 흐르는 구획(자기 사진 위)과, overlay 구획을
// 지나가는 화면 세 가지(튤립 사진·야경 사진·글자색과 같은 최악 단색) 위에서 모두 잰다 — 뒤 장면이 달라지면 불투명도 근거가 달라지기 때문이다.
const SWEEP_RECIPES = ["r1-measure", "r5-celadon", "r8-dusk"]
const SWEEP_SCENES: Record<string, string | undefined> = {
  own: undefined,
  "glass-a": "url(/textures/glass-a.webp) center / cover",
  "glass-b": "url(/textures/glass-b.webp) center / cover",
  worst: "var(--foreground)",
}
function SweepCell({ v, recipe, scene }: { v: (typeof G.texture)[number]; recipe: string; scene: string }) {
  const { Texture } = v.ui.texture
  const overlay = scene !== "own"
  return (
    <div data-recipe={recipe} data-tc-cell={`${v.id}|${recipe}|${scene}`} className="min-w-0 bg-background p-3 text-foreground">
      <p className="mb-2 text-xs text-muted-foreground">{v.id} · {recipe} · {scene === "own" ? "자기 사진 위" : `overlay · ${scene}`}</p>
      <div style={{ background: SWEEP_SCENES[scene] }} className={overlay ? "p-4" : ""}>
        <Texture overlay={overlay} className={`flex flex-col items-start gap-3 p-8 pt-12 ${overlay ? "sticky top-0" : ""}`}>
          <p data-tc="title" className="text-[28px] font-bold leading-tight">이번 주 제철 우유</p>
          <p data-tc="body" className="text-base leading-relaxed">목장에서 받은 날 병에 담아 보냅니다(예시).</p>
          <p data-tc="muted" className="text-sm leading-relaxed text-muted-foreground">배송은 화·목 오전 7시 전에 끝납니다.</p>
          <button type="button" data-tc="button" className="min-h-11 rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground">목장 소개 보기</button>
        </Texture>
      </div>
    </div>
  )
}
function TextureSweep() {
  const values = G.texture.filter((v) => ["X4", "X5", "X6", "X7", "X8"].includes(v.id))
  return (
    <div data-qa="texture-sweep" className="mt-12">
      <h3 className="mb-4 text-lg font-semibold">사진 질감 × 레시피 팔레트 3벌 (대비 실측)</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {values.flatMap((v) => {
          const glass = v.id === "X7" || v.id === "X8"
          return (glass ? ["own", "glass-a", "glass-b", "worst"] : ["own"]).flatMap((scene) => SWEEP_RECIPES.map((r) => <SweepCell key={`${v.id}-${r}-${scene}`} v={v} recipe={r} scene={scene} />))
        })}
      </div>
    </div>
  )
}

// 색 논리 K9 단색 램프(Task 16a) — CSS 축이 아니라 레시피 필드라 컴파일본이 없다. 한 색상각(250°)의 명도 단계만 쓴 예시 팔레트를 칸 변수로 걸어
// 기본 부품을 그린다(강조색 없음). 레시피 lint k9-mono 가 같은 규칙을 레시피 머리에서 잰다.
const K9_SAMPLE = {
  "--background": "oklch(0.985 0.004 250)",
  "--foreground": "oklch(0.22 0.035 250)",
  "--card": "oklch(0.985 0.004 250)",
  "--card-foreground": "oklch(0.22 0.035 250)",
  "--primary": "oklch(0.42 0.09 250)",
  "--primary-foreground": "oklch(0.985 0.004 250)",
  "--muted": "oklch(0.94 0.012 250)",
  "--muted-foreground": "oklch(0.36 0.04 250)",
  "--accent": "oklch(0.92 0.02 250)",
  "--accent-foreground": "oklch(0.22 0.035 250)",
  "--border": "oklch(0.86 0.015 250)",
  "--input": "oklch(0.62 0.03 250)",
  "--ring": "oklch(0.42 0.09 250)",
} as React.CSSProperties
const K9_RAMP = [0.97, 0.9, 0.8, 0.68, 0.56, 0.44, 0.32, 0.22]
function K9Value() {
  const { Button } = G.button[0].ui.button
  return (
    <Value id="K9" note="K9 단색 램프 — 한 색상각(또는 무채)의 명도 단계만, 강조색 없음">
      <div data-qa="k9" style={K9_SAMPLE} className="flex flex-col gap-4 rounded-md border bg-background p-6 text-foreground">
        <ol aria-label="K9 명도 단계(예시)" className="flex gap-1">
          {K9_RAMP.map((l) => (
            <li key={l} className="h-10 flex-1" style={{ background: `oklch(${l} ${(0.09 * (1 - Math.abs(l - 0.5) * 1.6)).toFixed(3)} 250)` }}>
              <span className="sr-only">명도 {l}</span>
            </li>
          ))}
        </ol>
        <p className="text-xl font-semibold">이번 달 배송 기록</p>
        <p className="leading-relaxed text-muted-foreground">강조색 없이 한 색의 밝기만으로 위계를 줍니다(예시).</p>
        <div className="flex gap-3">
          <Button>기록 내려받기</Button>
          <Button variant="outline">기간 바꾸기</Button>
        </div>
      </div>
    </Value>
  )
}

function ShadowValue({ v }: { v: (typeof G.shadow)[number] }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent } = v.ui.card
  return (
    <Value id={v.id} note={v.note} with={v.with}>
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>대리점 공지</CardTitle>
            <CardDescription>카드 높이(1단계). 메뉴·시트·모달은 같은 값의 2~5단계.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>추석 연휴에는 화요일에 한 번 더 배송합니다(예시).</p>
          </CardContent>
        </Card>
      </div>
    </Value>
  )
}

export default function QaAxesPage() {
  const { Toaster } = G.radius[0].ui.toast
  return (
    <Toaster>
      <nav data-sticky-nav aria-label="축 목록" className="sticky top-0 z-40 border-b bg-background px-4 py-2">
        <ul className="flex gap-1 overflow-x-auto text-sm whitespace-nowrap">
          {Object.entries(AXIS_TITLE).map(([k, t]) => (
            <li key={k}>
              <a href={`#axis-${k}`} className="inline-flex min-h-11 items-center rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground">
                {t}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto max-w-[1440px] scroll-mt-16 px-4 py-8 md:px-8">
        <h1 className="font-heading text-3xl font-bold">스타일 축 값 검수대</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          값마다 기본 모양(base) 위에 그 값 하나만 얹었다. 규칙(히트 영역·포커스·대비)은 부품에 있어 값이 바뀌어도 그대로다. 호환표 밖의 조합은 여기서 섞지 않는다.
        </p>
        <Axis axis="button">
          <div className={grid}>{G.button.map((v) => <ButtonValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="input">
          <div className={grid}>{G.input.map((v) => <InputValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="surface">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-5">{G.surface.map((v) => <SurfaceValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="table">
          <div className="grid gap-8 lg:grid-cols-2">{G.table.map((v) => <TableValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="header">
          <div className="flex flex-col gap-8">{G.header.map((v) => <HeaderValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="radius">
          <div className="grid gap-8 lg:grid-cols-3">{G.radius.map((v, i) => <RadiusValue key={v.id} v={v} behavior={i === 0} />)}</div>
        </Axis>
        <Axis axis="shadow">
          <div className={grid}>{G.shadow.map((v) => <ShadowValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="display">
          <div className="flex flex-col gap-10">{G.display.map((v) => <DisplayValue key={v.id} v={v} />)}</div>
        </Axis>
        <Axis axis="texture">
          <div className={grid}>{G.texture.map((v) => <TextureValue key={v.id} v={v} />)}</div>
          <TextureSweep />
        </Axis>
        <Axis axis="color">
          <div className={grid}>
            <K9Value />
          </div>
        </Axis>
      </main>
    </Toaster>
  )
}
