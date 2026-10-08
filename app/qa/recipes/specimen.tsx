"use client"

// 레시피 견본 한 벌 — 레시피의 컴파일 부품(registry/factory/r/<id>/ui)만 쓴다.
// 모양은 모두 부품과 레시피 변수에서 오고, 이 파일은 배치만 한다. 틀(칸 제목·구분선)은 중립 토큰(--border)만 쓴다(M12).
// 표는 소비자가 설치한 그대로 쓴다(글꼴 덮어쓰기 없음) — 숫자 칸에만 data-numeric(T7-I1). 숫자는 모두 예시값이다.
import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import type { recipes } from "@/.tmp/recipes/gallery"
import { FACE_CLASS } from "./heroes/parts"

export type Recipe = (typeof recipes)[number]

const num = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 })

// 28px 이상 제목은 굵기 클래스를 달지 않는다 — 레시피 제목 굵기(fonts.display.weight → --wf-heading-weight, .font-heading 기본 층)를 그대로 보인다(Task 6 리뷰 I1).
// 1.25 비율 한 줄(레시피 「쓰는 법」): 16 × 1.25ⁿ = 16 · 20 · 25 · 31.25 · 39.06 · 48.83px. 가장 큰 단계(제목:본문 ≈ 3.05배)에서 멈춘다.
const SCALE = [
  { px: 49, cls: "text-[3.052rem] leading-[1.1] tracking-[-0.02em]", sample: "강변 측정소 12곳" },
  { px: 39, cls: "text-[2.441rem] leading-[1.15]", sample: "탁도 경보 2건" },
  { px: 31, cls: "text-[1.953rem] leading-[1.2]", sample: "상류 구간 요약" },
  { px: 25, cls: "text-[1.563rem] leading-[1.25] font-bold", sample: "측정 주기와 기준" },
  { px: 20, cls: "text-[1.25rem] leading-[1.4] font-bold", sample: "3번 측정소 점검 기록" },
  { px: 16, cls: "text-base leading-[1.7]", sample: "탁도는 비가 온 다음 날 오르고 사흘 안에 제자리로 돌아옵니다." },
]

// 한 줄 KPI 셀(component-k17) — 큰 수치는 굵기 300, 단위는 수치의 45% 크기·굵기 400·muted 색(type-t06, 레시피 「쓰는 법」).
const KPI = [
  { label: "평균 탁도", value: 1.8, unit: "NTU" },
  { label: "용존산소", value: 8.4, unit: "mg/L" },
  { label: "수온", value: 17.2, unit: "℃" },
  { label: "열린 경보", value: 2, unit: "건" },
]

const STATIONS = [
  { name: "1번 상류 취수구", turbidity: 1.2, oxygen: 9.1, state: "정상" },
  { name: "3번 합류점", turbidity: 4.6, oxygen: 7.2, state: "주의" },
  { name: "5번 중류 보", turbidity: 1.9, oxygen: 8.3, state: "정상" },
  { name: "8번 하류 교량", turbidity: 5.3, oxygen: 6.8, state: "주의" },
  { name: "12번 하구 둑", turbidity: 2.4, oxygen: 7.9, state: "정상" },
]

const TREND = [
  { day: "월", up: 1.1, mid: 1.6, down: 2.2 },
  { day: "화", up: 1.3, mid: 1.8, down: 2.6 },
  { day: "수", up: 3.9, mid: 4.4, down: 5.3 },
  { day: "목", up: 2.6, mid: 3.1, down: 4.1 },
  { day: "금", up: 1.7, mid: 2.2, down: 3.0 },
  { day: "토", up: 1.3, mid: 1.9, down: 2.5 },
  { day: "일", up: 1.2, mid: 1.7, down: 2.3 },
]

// 칸마다 위 간격을 다르게 둔다(§13 균일 간격 금지, M1): 조밀한 조작 묶음은 붙이고, 데이터 묶음 앞은 크게 비운다.
function Block({ id, title, children, className = "", rule = true }: { id: string; title: string; children: React.ReactNode; className?: string; rule?: boolean }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${rule ? "border-t pt-5" : ""} ${className}`}>
      <h3 id={id} className="mb-4 text-[1.25rem] leading-[1.4] font-bold">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Header({ r }: { r: Recipe }) {
  const { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink, NavigationMenuTrigger, NavigationMenuContent } = r.ui["navigation-menu"]
  const { Button } = r.ui.button
  const here = `#${r.id}`
  return (
    <div className="overflow-x-auto p-1">
      <NavigationMenu aria-label={`${r.name} 견본 주 메뉴`} className="min-w-max">
        <span className="px-2 text-base font-bold whitespace-nowrap">물길측정(예시)</span>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink active href={here}>
              측정소
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href={here}>경보</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>기준</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href={here}>수질 기준표</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
        <Button size="sm">측정 요청</Button>
      </NavigationMenu>
    </div>
  )
}

function TypeScale() {
  return (
    <ol className="flex flex-col gap-4">
      {SCALE.map((s) => (
        <li key={s.px} className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-4">
          <span className="text-sm tabular-nums text-muted-foreground">{s.px}px</span>
          <span className={`font-heading ${s.cls}`}>{s.sample}</span>
        </li>
      ))}
    </ol>
  )
}

function Kpis() {
  return (
    <dl className="grid grid-cols-2 border md:grid-cols-4">
      {KPI.map((k, i) => (
        <div
          key={k.label}
          className={`flex flex-col gap-1 p-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
        >
          <dt className="text-sm text-muted-foreground">{k.label}</dt>
          <dd className="font-heading tabular-nums">
            <span className="text-[2.441rem] leading-none font-light">{num.format(k.value)}</span>
            <span className="ms-1 text-[1.1rem] font-normal text-muted-foreground">{k.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Buttons({ r }: { r: Recipe }) {
  const { Button } = r.ui.button
  const { IconButton } = r.ui["icon-button"]
  const { Search } = r.glyphs
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-wrap gap-3">
        <Button>측정 요청</Button>
        <Button variant="outline">기록 내려받기</Button>
        <Button variant="secondary">임시 저장</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm">
          닫기
        </Button>
        <Button variant="destructive" size="sm">
          경보 해제
        </Button>
        <Button variant="link" size="sm">
          측정 기준 보기
        </Button>
        <IconButton icon={Search} label="측정소 찾기" variant="outline" />
        <Button size="sm" disabled>
          전송 중
        </Button>
      </div>
      <Button size="lg">이번 주 보고서 만들기</Button>
    </div>
  )
}

// 면·칸 견본(Task 7 fix 1 — 리뷰 I1): 색 논리 K6~K8 레시피의 면마다 data-face 구획 하나. 그 안의 주 버튼·외곽선 버튼·입력·체크·보조 글자가
// 면 스코프 토큰(recipe.mjs faceRules)으로 대비를 지키는지 게이트가 잰다. 면 → 클래스 대응은 heroes/parts.tsx FACE_CLASS 하나에서 온다.
function Faces({ r }: { r: Recipe }) {
  const { Button } = r.ui.button
  const { Input } = r.ui.input
  const { Checkbox } = r.ui.checkbox
  const { Label } = r.ui.label
  // 크기로 위계를 준다(K8 칸 위계와 같은 뜻): 첫 면이 큰 칸이고 조작을 모두 싣는다. 나머지는 작은 칸마다 조작 하나씩 — 같은 구조 카드를 늘어놓지 않는다(G136).
  const [first, ...rest] = r.faces as string[]
  const small = [
    () => (
      <>
        <p className="leading-[1.7]">이번 주 새 메뉴 2가지(예시)</p>
        <Button variant="outline" className="self-start">메뉴 보기</Button>
      </>
    ),
    (k: string) => (
      <>
        <Label htmlFor={`${r.id}-${k}-phone`}>연락처</Label>
        <Input id={`${r.id}-${k}-phone`} inputMode="tel" placeholder="010-0000-0000" />
      </>
    ),
    (k: string) => (
      <div className="flex items-center gap-2">
        <Checkbox id={`${r.id}-${k}-gift`} />
        <Label htmlFor={`${r.id}-${k}-gift`}>선물 포장 요청</Label>
      </div>
    ),
  ]
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <section data-face={first} aria-label={`${first} 면 견본`} className={`flex flex-col gap-4 p-6 md:col-span-2 md:row-span-3 ${FACE_CLASS[first] ?? ""}`}>
        <p className="text-[1.953rem] leading-[1.2] font-bold">오늘 예약 3자리 남음(예시)</p>
        <p className="max-w-[40ch] leading-[1.7] text-muted-foreground">면 안의 보조 글자와 입력 테두리도 이 면의 짝 색으로 그립니다.</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${r.id}-${first}-name`}>예약자 이름</Label>
          <Input id={`${r.id}-${first}-name`} placeholder="홍길동" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`${r.id}-${first}-agree`} defaultChecked />
          <Label htmlFor={`${r.id}-${first}-agree`}>문자 알림 받기</Label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button>예약하기</Button>
          <Button variant="outline">전화 문의</Button>
        </div>
      </section>
      {rest.map((k, i) => (
        <section key={k} data-face={k} aria-label={`${k} 면 견본`} className={`flex flex-col gap-3 p-5 ${FACE_CLASS[k] ?? ""}`}>
          {small[i % small.length](k)}
        </section>
      ))}
    </div>
  )
}

function FormStates({ r }: { r: Recipe }) {
  const { Input } = r.ui.input
  const { Textarea } = r.ui.textarea
  const { NativeSelect, NativeSelectOption } = r.ui["native-select"]
  const { Field, FieldLabel, FieldError, FieldDescription } = r.ui.field
  const { Checkbox } = r.ui.checkbox
  const { Label } = r.ui.label
  const k = r.id
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${k}-empty`}>측정소 이름(필수)</FieldLabel>
        <Input id={`${k}-empty`} placeholder="예: 3번 합류점" />
        <FieldDescription>빈 칸</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${k}-filled`}>담당자 연락처(선택)</FieldLabel>
        <Input id={`${k}-filled`} type="tel" autoComplete="tel" defaultValue="010-1234-5678" />
        <FieldDescription>입력됨</FieldDescription>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor={`${k}-invalid`}>탁도 경보 기준(NTU)</FieldLabel>
        <Input id={`${k}-invalid`} inputMode="decimal" aria-invalid aria-describedby={`${k}-invalid-err`} defaultValue="-3" />
        <FieldError id={`${k}-invalid-err`}>0보다 큰 수를 입력해 주세요.</FieldError>
      </Field>
      <Field data-disabled>
        <FieldLabel htmlFor={`${k}-disabled`}>측정 장비 번호(변경 불가)</FieldLabel>
        <Input id={`${k}-disabled`} disabled defaultValue="WQ-0312(예시)" />
        <FieldDescription>비활성: 점검 중에는 바꿀 수 없습니다.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${k}-readonly`}>마지막 교정일</FieldLabel>
        <Input id={`${k}-readonly`} readOnly defaultValue="2026. 9. 14." />
        <FieldDescription>읽기 전용</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${k}-cycle`}>측정 주기</FieldLabel>
        <NativeSelect id={`${k}-cycle`} defaultValue="15">
          <NativeSelectOption value="5">5분마다</NativeSelectOption>
          <NativeSelectOption value="15">15분마다</NativeSelectOption>
          <NativeSelectOption value="60">1시간마다</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel htmlFor={`${k}-note`}>점검 메모(선택)</FieldLabel>
        <Textarea id={`${k}-note`} placeholder="예: 센서 창에 물때가 끼어 닦았습니다." />
      </Field>
      <Label className="flex items-center gap-2 md:col-span-2">
        <Checkbox defaultChecked /> 경보가 나면 담당자에게 문자로 알립니다
      </Label>
    </div>
  )
}

function CardAndTable({ r }: { r: Recipe }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } = r.ui.card
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } = r.ui.table
  const { Badge } = r.ui.badge
  const { Button } = r.ui.button
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>3번 합류점</CardTitle>
          <CardDescription>오늘 오전 9시 측정(예시)</CardDescription>
        </CardHeader>
        <CardContent>
          <p>탁도가 기준 4.0 NTU를 넘었습니다. 어제 내린 비로 지류 흙탕물이 섞였습니다.</p>
        </CardContent>
        <CardFooter>
          <Button size="sm" variant="outline">
            측정 기록 보기
          </Button>
        </CardFooter>
      </Card>
      <div className="overflow-x-auto p-1">
        <Table>
          <TableCaption>측정소별 오늘 값(예시)</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>측정소</TableHead>
              <TableHead className="text-right">탁도(NTU)</TableHead>
              <TableHead className="text-right">용존산소(mg/L)</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATIONS.map((s) => (
              <TableRow key={s.name}>
                <TableCell>{s.name}</TableCell>
                <TableCell data-numeric className="text-right">
                  {num.format(s.turbidity)}
                </TableCell>
                <TableCell data-numeric className="text-right">
                  {num.format(s.oxygen)}
                </TableCell>
                <TableCell>
                  {/* 상태색(T7-M13): 글자가 곧 상태 이름이라 색만으로 전하지 않는다. */}
                  <Badge className={s.state === "주의" ? "border-transparent bg-warning text-warning-foreground" : "border-transparent bg-success text-success-foreground"}>{s.state}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Chart({ r }: { r: Recipe }) {
  const { ChartContainer, ChartTooltip, ChartTooltipContent } = r.ui.chart
  const config = {
    up: { label: "상류", color: "var(--chart-1)" },
    mid: { label: "중류", color: "var(--chart-3)" },
    down: { label: "하류", color: "var(--chart-5)" },
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <figure className="min-w-0">
        <ChartContainer config={config} className="h-64 w-full">
          <LineChart data={TREND} accessibilityLayer aria-label="이번 주 구간별 탁도 추이(예시)" margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis width={32} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {/* recharts 선 그리기(1.5초)는 모션 M1(등장 300ms 이하)보다 길어 끈다. */}
            <Line dataKey="up" type="linear" stroke="var(--color-up)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="mid" type="linear" stroke="var(--color-mid)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            <Line dataKey="down" type="linear" stroke="var(--color-down)" strokeWidth={2} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
        <figcaption className="mt-3 text-sm text-muted-foreground">
          이번 주 구간별 탁도(NTU, 예시). 상류는 실선, 중류는 긴 점선, 하류는 짧은 점선입니다. 수요일 비로 세 구간이 함께 올랐습니다.
        </figcaption>
      </figure>
      <ul className="grid grid-cols-5 gap-2 self-start" aria-label="차트 색 다섯 단계">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex flex-col gap-2">
            <span className="block h-12 border" style={{ background: `var(--chart-${i})` }} />
            <span className="text-sm tabular-nums">chart-{i}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 확정 흐름(DESIGN §7-B) — /qa/base 와 같은 동작 표식. [취소]가 처음 포커스를 받는다(부품 규칙).
function ConfirmRequest({ r }: { r: Recipe }) {
  const { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } =
    r.ui["alert-dialog"]
  const { Button } = r.ui.button
  const [open, setOpen] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  return (
    <div className="flex flex-col gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger data-qa="confirm-open" render={<Button />} disabled={sent}>
          {sent ? "측정 요청을 보냈습니다" : "현장 측정 요청 보내기"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>3번 합류점에 현장 측정을 요청할까요?</AlertDialogTitle>
            <AlertDialogDescription>요청하면 담당 조사원에게 바로 문자가 갑니다. 보낸 요청은 거둘 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const w = window as unknown as { __orders?: number }
                w.__orders = (w.__orders || 0) + 1
                setSent(true)
                setOpen(false)
              }}
            >
              측정 요청
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p role="status" className="text-sm leading-relaxed text-muted-foreground">
        {sent ? "요청을 보냈습니다(예시)." : "아직 보내지 않았습니다."}
      </p>
    </div>
  )
}

function Overlays({ r }: { r: Recipe }) {
  const { Button } = r.ui.button
  const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } = r.ui.dialog
  const { ToggleGroup, ToggleGroupItem } = r.ui["toggle-group"]
  const { Tabs, TabsList, TabsTrigger, TabsContent } = r.ui.tabs
  const { toast } = r.ui.toast
  return (
    <div className="flex flex-col items-start gap-5">
      {/* 선택 표시(T7-I2): 눌린 토글·선택된 탭은 링 색 2px 안쪽 테두리 — 면 색만으로 구별하지 않는다. */}
      <Tabs defaultValue="day">
        <TabsList aria-label="측정 기간">
          <TabsTrigger value="day">오늘</TabsTrigger>
          <TabsTrigger value="week">이번 주</TabsTrigger>
          <TabsTrigger value="month">이번 달</TabsTrigger>
        </TabsList>
        <TabsContent value="day" className="pt-2 text-sm text-muted-foreground">
          오늘 측정 96회(예시)
        </TabsContent>
        <TabsContent value="week" className="pt-2 text-sm text-muted-foreground">
          이번 주 측정 672회(예시)
        </TabsContent>
        <TabsContent value="month" className="pt-2 text-sm text-muted-foreground">
          이번 달 측정 2,880회(예시)
        </TabsContent>
      </Tabs>
      <ToggleGroup multiple defaultValue={["up"]} aria-label="구간 필터">
        <ToggleGroupItem data-qa="filter" value="up">
          상류
        </ToggleGroupItem>
        <ToggleGroupItem data-qa="filter" value="mid">
          중류
        </ToggleGroupItem>
        <ToggleGroupItem data-qa="filter" value="down">
          하류
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-wrap items-start gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>측정 기준 보기</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>탁도 경보 기준</DialogTitle>
              <DialogDescription>4.0 NTU를 넘는 값이 두 번 이어지면 경보를 엽니다(예시).</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          variant="outline"
          data-qa="toast-trigger"
          onClick={() =>
            toast.add({
              title: "보고서를 임시 저장했습니다.",
              description: "4초 안에 되돌릴 수 있습니다.",
              timeout: 4000,
              actionProps: { children: "되돌리기" },
            })
          }
        >
          보고서 임시 저장
        </Button>
      </div>
      <ConfirmRequest r={r} />
    </div>
  )
}

export function Specimen({ r, fontClass, missingFonts, onActive }: { r: Recipe; fontClass: string; missingFonts: string[]; onActive: (id: string) => void }) {
  const { Toaster } = r.ui.toast
  const activate = () => onActive(r.id)
  return (
    <Toaster>
      <article
        id={r.id}
        data-recipe={r.id}
        aria-labelledby={`${r.id}-title`}
        className={`scroll-mt-16 border font-sans ${fontClass}`}
        onFocusCapture={activate}
        onPointerDownCapture={activate}
      >
        <Header r={r} />
        <div className="flex flex-col px-4 py-8 md:px-8">
          {missingFonts.length > 0 && (
            <p role="note" className="mb-6 border border-destructive p-3 text-sm">
              서체 로더 없음: {missingFonts.join(", ")}. 이 칸은 폴백 서체로 그려졌습니다(Task 8 폰트 항목 전까지).
            </p>
          )}
          <header className="flex max-w-3xl flex-col gap-3">
            <h2 id={`${r.id}-title`} className="font-heading text-[2.441rem] leading-[1.15]">
              {/* id 표지는 제목 굵기를 따른다 — 가는 제목(r5 200) 안에서 400 표지가 「제목 속 굵은 강조」(G102)로 읽히지 않게 */}
              {r.name} <code className="font-mono text-base [font-weight:inherit] text-muted-foreground">{r.id}</code>
            </h2>
            <p className="leading-[1.7] text-muted-foreground">
              분위기: {r.mood.join(", ")}. 맞는 원형은 {r.archetypes.join(", ")}입니다.
            </p>
            <p className="text-sm leading-[1.7] text-muted-foreground">
              축 값 {Object.values(r.axes).join(" ")}, 모션 {r.motion}, 아이콘 {r.icons.library}
            </p>
          </header>
          <div className="mt-6">
            <Kpis />
          </div>
          <Block id={`${r.id}-type`} title="글자 크기" className="mt-16">
            <TypeScale />
          </Block>
          {/* 조작 묶음: 버튼과 선택·대화상자를 한 덩어리로 붙인다. */}
          <div className="mt-12 grid gap-x-10 gap-y-8 border-t pt-5 lg:grid-cols-2">
            <Block id={`${r.id}-buttons`} title="버튼" rule={false}>
              <Buttons r={r} />
            </Block>
            <Block id={`${r.id}-overlays`} title="선택과 대화상자" rule={false}>
              <Overlays r={r} />
            </Block>
          </div>
          <Block id={`${r.id}-form`} title="입력 칸 다섯 상태" className="mt-10">
            <FormStates r={r} />
          </Block>
          {r.faces.length > 0 && (
            <Block id={`${r.id}-faces`} title="면 위의 조작" className="mt-16">
              <Faces r={r} />
            </Block>
          )}
          {/* 데이터 묶음 앞은 크게 비운다. */}
          <Block id={`${r.id}-data`} title="카드와 표" className="mt-24">
            <CardAndTable r={r} />
          </Block>
          <Block id={`${r.id}-chart`} title="차트 색" rule={false} className="mt-12">
            <Chart r={r} />
          </Block>
        </div>
      </article>
    </Toaster>
  )
}
