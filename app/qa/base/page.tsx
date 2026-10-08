"use client"

// /qa/base — 기본 부품 61개를 한 화면에 펼쳐 DESIGN.md 바닥 규칙을 눈과 자동 검사(Task 6)로 확인하는 검수대.
// 동작 검사 표식: data-qa="confirm-open" · "toast-trigger" · "filter". 숫자는 모두 예시값이다.
import * as React from "react"
import {
  BellIcon,
  CheckIcon,
  FileTextIcon,
  InboxIcon,
  InfoIcon,
  MilkIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react"
import { ko } from "react-day-picker/locale"
import { CartesianGrid, Line, LineChart, XAxis } from "recharts"

import uiRegistry from "@/registry/factory/ui/registry.json"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/registry/factory/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/registry/factory/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/registry/factory/ui/alert-dialog"
import { AspectRatio } from "@/registry/factory/ui/aspect-ratio"
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/registry/factory/ui/attachment"
import { Avatar, AvatarFallback } from "@/registry/factory/ui/avatar"
import { Badge } from "@/registry/factory/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/registry/factory/ui/breadcrumb"
import { Bubble, BubbleContent } from "@/registry/factory/ui/bubble"
import { Button } from "@/registry/factory/ui/button"
import { ButtonGroup } from "@/registry/factory/ui/button-group"
import { Calendar } from "@/registry/factory/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/registry/factory/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/registry/factory/ui/carousel"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/registry/factory/ui/chart"
import { Checkbox } from "@/registry/factory/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/registry/factory/ui/collapsible"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/registry/factory/ui/combobox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/factory/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/registry/factory/ui/context-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/registry/factory/ui/dialog"
import { DirectionProvider } from "@/registry/factory/ui/direction"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/registry/factory/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/factory/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/factory/ui/empty"
import { Field, FieldDescription, FieldLabel } from "@/registry/factory/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/registry/factory/ui/hover-card"
import { Input } from "@/registry/factory/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/registry/factory/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/registry/factory/ui/input-otp"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/registry/factory/ui/item"
import { Kbd, KbdGroup } from "@/registry/factory/ui/kbd"
import { Label } from "@/registry/factory/ui/label"
import { Marker, MarkerContent, MarkerIcon } from "@/registry/factory/ui/marker"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/registry/factory/ui/menubar"
import { Message, MessageContent, MessageGroup } from "@/registry/factory/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/registry/factory/ui/message-scroller"
import { NativeSelect, NativeSelectOption } from "@/registry/factory/ui/native-select"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/registry/factory/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/registry/factory/ui/pagination"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/registry/factory/ui/popover"
import { Progress, ProgressLabel, ProgressValue } from "@/registry/factory/ui/progress"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/registry/factory/ui/questionnaire"
import { RadioGroup, RadioGroupItem } from "@/registry/factory/ui/radio-group"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/registry/factory/ui/resizable"
import { ScrollArea } from "@/registry/factory/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/registry/factory/ui/select"
import { Separator } from "@/registry/factory/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/registry/factory/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/registry/factory/ui/sidebar"
import { Skeleton } from "@/registry/factory/ui/skeleton"
import { Slider } from "@/registry/factory/ui/slider"
import { Spinner } from "@/registry/factory/ui/spinner"
import { Switch } from "@/registry/factory/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/factory/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/factory/ui/tabs"
import { Textarea } from "@/registry/factory/ui/textarea"
import { Toaster, toast } from "@/registry/factory/ui/toast"
import { Toggle } from "@/registry/factory/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/registry/factory/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/registry/factory/ui/tooltip"

const LONG =
  "발주 초안을 확정하면 한빛유업 성동대리점(예시)에 목요일 오전 도착으로 60팩이 주문됩니다(예시)"

// 부품 목록은 ui 층 registry.json(npm run registry:gen 산출물)에서 읽는다 — app/page.tsx 와 같은 방식.
const NAMES: string[] = uiRegistry.items.map((item) => item.name)

const won = new Intl.NumberFormat("ko-KR")
const ORDERS = [
  { day: "월", packs: 48 },
  { day: "화", packs: 52 },
  { day: "수", packs: 45 },
  { day: "목", packs: 60 },
  { day: "금", packs: 57 },
]
const chartConfig = {
  packs: { label: "주문 팩 수(예시)", color: "var(--chart-1)" },
} satisfies ChartConfig
const SUPPLIERS = ["한빛유업 성동대리점(예시)", "가람유업 광진대리점(예시)", "누리유업 동대문대리점(예시)"]

function Section({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  return (
    <section id={`c-${name}`} className="border-t py-8">
      <h2 className="mb-4 font-heading text-xl font-medium">{name}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

// 손으로 쓴 <Section> 들의 이름을 모아, registry 에는 있는데 예시가 없는 부품은 자리 섹션으로 채운다.
// 새 부품이 층에 들어오면 내비·섹션에 바로 보이고, 예시가 빠졌다는 사실도 화면에 드러난다.
function Sections({ children }: { children: React.ReactNode }) {
  const written = new Set(
    React.Children.toArray(children).map(
      (child) => (child as React.ReactElement<{ name: string }>).props.name
    )
  )
  const missing = NAMES.filter((name) => !written.has(name))
  return (
    <>
      {children}
      {missing.map((name) => (
        <Section key={name} name={name}>
          <p className="text-muted-foreground">예시가 아직 없습니다.</p>
        </Section>
      ))}
    </>
  )
}

// 확정 흐름(DESIGN §7-B): [확인] → 확정 + 닫힘 → 포커스는 연 버튼으로 돌아가고 그 버튼이 확정 상태를 읽어 준다.
// 다시 열면 「이미 확정된 발주입니다」와 [닫기]만 — 누를 수 없는 [확인]을 남기지 않는다.
function ConfirmOrder() {
  const [open, setOpen] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState(false)
  // 대화상자 본문은 「열 때」의 상태로 고정한다 — 확정 직후 퇴장 애니메이션 동안 내용이 바뀌어 보이지 않게.
  const [shownConfirmed, setShownConfirmed] = React.useState(false)
  return (
    <div className="flex flex-col gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (next) setShownConfirmed(confirmed)
          setOpen(next)
        }}
      >
        <AlertDialogTrigger data-qa="confirm-open" render={<Button />}>
          {confirmed ? "확정된 발주 보기" : "발주 확정하기"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{LONG}</AlertDialogTitle>
            <AlertDialogDescription>
              {shownConfirmed
                ? "이미 확정된 발주입니다. 바꾸려면 대리점에 직접 연락해 주세요."
                : "확정하면 대리점으로 주문이 바로 전송되고 취소할 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{shownConfirmed ? "닫기" : "취소"}</AlertDialogCancel>
            {!shownConfirmed && (
              <AlertDialogAction
                onClick={() => {
                  // Task 6 behavior.mjs marker: lets the check tell "Enter never
                  // reaches [확인]" apart from "nothing here increments anything".
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
      <p role="status" className="text-sm text-muted-foreground">
        {confirmed ? "발주를 확정했습니다(예시)." : "아직 확정하지 않았습니다."}
      </p>
    </div>
  )
}

export default function QaBasePage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 8, 25))

  return (
    <TooltipProvider>
      <Toaster>
        <nav
          data-sticky-nav
          aria-label="부품 목록"
          className="sticky top-0 z-40 border-b bg-background/95 px-4 py-2 backdrop-blur"
        >
          <ul className="flex gap-1 overflow-x-auto text-sm whitespace-nowrap">
            {NAMES.map((n) => (
              <li key={n}>
                <a
                  href={`#c-${n}`}
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {n}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="mx-auto max-w-5xl px-4 pb-24">
          <header className="py-10">
            <h1 className="font-heading text-3xl font-semibold">기본 부품 검수대</h1>
            <p className="mt-2 max-w-[40em] text-muted-foreground">
              부품 {NAMES.length}개를 한 화면에서 확인합니다. 화면의 숫자는 모두 예시입니다.
              <kbd className="mx-1 rounded border px-1">d</kbd>를 누르면 다크 모드로 바뀝니다.
            </p>
          </header>

          <Sections>

          <Section name="accordion">
            <Accordion className="w-full max-w-md">
              <AccordionItem value="a">
                <AccordionTrigger>발주 마감은 언제인가요?</AccordionTrigger>
                <AccordionContent>매주 수요일 오후 3시까지 확정한 발주가 목요일 오전에 도착합니다(예시).</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>수량은 어떻게 정하나요?</AccordionTrigger>
                <AccordionContent>지난 4주 평균 소비량에 10%를 더해 초안을 만듭니다(예시).</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Section>

          <Section name="alert-dialog">
            <ConfirmOrder />
          </Section>

          <Section name="alert">
            <Alert className="max-w-md">
              <InfoIcon />
              <AlertTitle>목요일 배송분 마감이 3시간 남았습니다(예시)</AlertTitle>
              <AlertDescription>오후 3시 전에 발주를 확정해 주세요.</AlertDescription>
            </Alert>
          </Section>

          <Section name="aspect-ratio">
            <div className="w-64">
              <AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-lg bg-muted text-muted-foreground">
                16:9 영역
              </AspectRatio>
            </div>
          </Section>

          <Section name="attachment">
            <Attachment>
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>9월 넷째 주 발주서.pdf</AttachmentTitle>
                <AttachmentDescription>184KB(예시)</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          </Section>

          <Section name="avatar">
            <Avatar>
              <AvatarFallback>강</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>김</AvatarFallback>
            </Avatar>
          </Section>

          <Section name="badge">
            <Badge>확정</Badge>
            <Badge variant="secondary">초안</Badge>
            <Badge variant="outline" className="max-w-full truncate">{LONG}</Badge>
            <Badge variant="outline" render={<a href="#c-badge" />}>배송 조건 보기</Badge>
          </Section>

          <Section name="breadcrumb">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">처음</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/qa/base">검수대</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>기본 부품</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Section>

          <Section name="bubble">
            <Bubble>
              <BubbleContent>목요일 오전 도착 가능합니다.</BubbleContent>
            </Bubble>
            <Bubble variant="outline">
              <BubbleContent render={<button type="button" />}>금요일로 바꾸기</BubbleContent>
            </Bubble>
          </Section>

          <Section name="button-group">
            <ButtonGroup>
              <Button variant="outline">이전 주</Button>
              <Button variant="outline">이번 주</Button>
              <Button variant="outline">다음 주</Button>
            </ButtonGroup>
            {/* 작은 크기: 묶음 안에서는 히트 영역을 좌우로 넓히지 않는다(이웃 버튼을 덮지 않게). data-qa 로 검사한다. */}
            <ButtonGroup data-qa="button-group-sm">
              <Button variant="outline" size="sm">편집</Button>
              <Button variant="outline" size="sm">삭제</Button>
            </ButtonGroup>
          </Section>

          <Section name="button">
            <Button>발주 저장하기</Button>
            <Button variant="outline">초안 보기</Button>
            <Button variant="ghost">나중에 하기</Button>
            <Button size="sm">작게</Button>
            <Button size="lg">크게</Button>
            <Button size="icon" aria-label="알림 보기">
              <BellIcon />
            </Button>
            <Button className="h-auto max-w-full py-2 whitespace-normal">{LONG}</Button>
          </Section>

          <Section name="calendar">
            <Calendar mode="single" locale={ko} selected={date} onSelect={setDate} className="rounded-lg border" />
          </Section>

          <Section name="card">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>이번 주 우유 발주</CardTitle>
                <CardDescription>성동대리점 · 목요일 도착</CardDescription>
              </CardHeader>
              <CardContent className="tabular-nums">60팩 · {won.format(78000)}원(예시)</CardContent>
            </Card>
          </Section>

          <Section name="carousel">
            <div className="w-full max-w-xs px-12">
              <Carousel>
                <CarouselContent>
                  {["월", "화", "수"].map((d) => (
                    <CarouselItem key={d}>
                      <div className="flex h-32 items-center justify-center rounded-lg border">{d}요일 식단</div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          </Section>

          <Section name="chart">
            <ChartContainer config={chartConfig} className="h-48 w-full max-w-md">
              <LineChart data={ORDERS} accessibilityLayer aria-label="주간 발주량 추이">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="packs" stroke="var(--color-packs)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          </Section>

          <Section name="checkbox">
            <Label className="flex items-center gap-2">
              <Checkbox defaultChecked /> 저지방 우유 포함
            </Label>
          </Section>

          <Section name="collapsible">
            <Collapsible className="max-w-md">
              <CollapsibleTrigger render={<Button variant="outline" />}>세부 수량 보기</CollapsibleTrigger>
              <CollapsibleContent className="pt-2 text-muted-foreground">흰 우유 48팩, 저지방 12팩(예시)</CollapsibleContent>
            </Collapsible>
          </Section>

          <Section name="combobox">
            <Combobox items={SUPPLIERS}>
              <ComboboxInput placeholder="대리점 검색" aria-label="대리점" />
              <ComboboxContent>
                <ComboboxEmpty>맞는 대리점이 없습니다.</ComboboxEmpty>
                <ComboboxList>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Section>

          <Section name="command">
            <Command className="max-w-sm rounded-lg border">
              <CommandInput placeholder="명령 검색" />
              <CommandList>
                <CommandEmpty>결과가 없습니다.</CommandEmpty>
                <CommandGroup heading="발주">
                  <CommandItem>새 발주 만들기</CommandItem>
                  <CommandItem>지난 발주 복사하기</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Section>

          <Section name="context-menu">
            <ContextMenu>
              <ContextMenuTrigger className="flex h-24 w-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                여기를 오른쪽 클릭
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem>복사하기</ContextMenuItem>
                <ContextMenuItem>이름 바꾸기</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </Section>

          <Section name="dialog">
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>배송 메모 편집하기</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{LONG}</DialogTitle>
                  <DialogDescription>대리점 기사님께 전할 메모를 남깁니다.</DialogDescription>
                </DialogHeader>
                <Textarea aria-label="배송 메모" defaultValue="뒷문 냉장고 앞에 놓아 주세요." />
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
                  <Button>메모 저장</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          <Section name="direction">
            <DirectionProvider direction="ltr">
              <p className="text-muted-foreground">DirectionProvider(ltr) 안의 문단입니다.</p>
            </DirectionProvider>
          </Section>

          <Section name="drawer">
            <Drawer>
              <DrawerTrigger render={<Button variant="outline" />}>필터 열기</DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>필터</DrawerTitle>
                  <DrawerDescription>보고 싶은 품목을 고릅니다.</DrawerDescription>
                </DrawerHeader>
                <DrawerFooter>
                  <DrawerClose render={<Button variant="outline" />}>닫기</DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </Section>

          <Section name="dropdown-menu">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>더 보기</DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>인쇄하기</DropdownMenuItem>
                <DropdownMenuItem>엑셀로 내려받기</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Section>

          <Section name="empty">
            <Empty className="max-w-md border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>아직 발주가 없습니다</EmptyTitle>
                <EmptyDescription>지난주 발주를 복사해 초안을 만들 수 있습니다.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button>지난주 발주 복사하기</Button>
              </EmptyContent>
            </Empty>
          </Section>

          <Section name="field">
            <Field className="max-w-sm">
              <FieldLabel htmlFor="qa-field">받는 사람(필수)</FieldLabel>
              <Input id="qa-field" autoComplete="name" defaultValue="강현성" />
              <FieldDescription>대리점 기사님이 부를 이름입니다.</FieldDescription>
            </Field>
          </Section>

          <Section name="hover-card">
            <HoverCard>
              <HoverCardTrigger render={<a href="#c-hover-card" className="underline underline-offset-4" />}>
                성동대리점 정보
              </HoverCardTrigger>
              <HoverCardContent>평일 오전 6~10시 배송(예시)</HoverCardContent>
            </HoverCard>
          </Section>

          <Section name="input-group">
            <InputGroup className="max-w-xs">
              <InputGroupInput aria-label="수량" inputMode="numeric" defaultValue="60" />
              <InputGroupAddon align="inline-end">
                <InputGroupText>팩</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Section>

          <Section name="input-otp">
            <InputOTP maxLength={4} aria-label="인증 번호">
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </Section>

          <Section name="input">
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Label htmlFor="qa-input">연락처</Label>
              <Input id="qa-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" />
            </div>
          </Section>

          <Section name="item">
            <Item variant="outline" className="max-w-md">
              <ItemContent>
                <ItemTitle>흰 우유 200ml</ItemTitle>
                <ItemDescription>48팩 · 지난주보다 3팩 많음(예시)</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="outline" size="sm">수량 바꾸기</Button>
              </ItemActions>
            </Item>
          </Section>

          <Section name="kbd">
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </Section>

          <Section name="label">
            <Label htmlFor="qa-label">메모</Label>
            <Input id="qa-label" className="max-w-xs" />
          </Section>

          <Section name="marker">
            <Marker>
              <MarkerIcon>
                <CheckIcon />
              </MarkerIcon>
              <MarkerContent>발주가 대리점에 전달되었습니다.</MarkerContent>
            </Marker>
          </Section>

          <Section name="menubar">
            <Menubar>
              <MenubarMenu>
                <MenubarTrigger>파일</MenubarTrigger>
                <MenubarContent>
                  <MenubarItem>새 발주</MenubarItem>
                  <MenubarItem>인쇄하기</MenubarItem>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          </Section>

          <Section name="message-scroller">
            <MessageScrollerProvider>
              <MessageScroller className="h-40 w-full max-w-md rounded-lg border">
                <MessageScrollerViewport aria-label="대리점과 주고받은 메시지">
                  <MessageScrollerContent>
                    {["발주 확인했습니다.", "목요일 오전 도착 예정입니다.", "뒷문에 두겠습니다."].map((t, i) => (
                      <MessageScrollerItem key={t} messageId={`m${i}`}>
                        <p className="px-3 py-2">{t}</p>
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          </Section>

          <Section name="message">
            <MessageGroup className="w-full max-w-md">
              <Message align="start">
                <MessageContent>
                  <Bubble>
                    <BubbleContent>60팩 맞으신가요?</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
              <Message align="end">
                <MessageContent>
                  <Bubble>
                    <BubbleContent>네, 맞습니다.</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageGroup>
          </Section>

          <Section name="native-select">
            <NativeSelect aria-label="배송 요일" defaultValue="thu">
              <NativeSelectOption value="mon">월요일</NativeSelectOption>
              <NativeSelectOption value="thu">목요일</NativeSelectOption>
            </NativeSelect>
          </Section>

          <Section name="navigation-menu">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>발주</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <NavigationMenuLink href="/qa/base#c-table">이번 주 발주표</NavigationMenuLink>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </Section>

          <Section name="pagination">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="/qa/base?page=1#c-pagination" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="/qa/base?page=1#c-pagination">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="/qa/base?page=2#c-pagination" isActive>2</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="/qa/base?page=3#c-pagination" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </Section>

          <Section name="popover">
            <Popover>
              <PopoverTrigger render={<Button variant="outline" />}>도착 시간 보기</PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>목요일 오전</PopoverTitle>
                  <PopoverDescription>6시~10시 사이 도착(예시)</PopoverDescription>
                </PopoverHeader>
              </PopoverContent>
            </Popover>
          </Section>

          <Section name="progress">
            <Progress value={60} aria-label="주간 발주 진행" className="w-full max-w-sm">
              <ProgressLabel>주간 발주 진행</ProgressLabel>
              <ProgressValue />
            </Progress>
          </Section>

          <Section name="questionnaire">
            <Questionnaire className="w-full max-w-md">
              <QuestionnaireProgress />
              <QuestionnaireItem name="milk">
                <QuestionnaireTitle>어떤 우유를 받으시나요?</QuestionnaireTitle>
                <QuestionnaireChoices>
                  <QuestionnaireChoice value="white">흰 우유</QuestionnaireChoice>
                  <QuestionnaireChoice value="lowfat">저지방 우유</QuestionnaireChoice>
                </QuestionnaireChoices>
              </QuestionnaireItem>
              <QuestionnaireActions>
                <QuestionnairePrevious>이전</QuestionnairePrevious>
                <QuestionnaireNext>다음</QuestionnaireNext>
                <QuestionnaireSubmit>답변 보내기</QuestionnaireSubmit>
              </QuestionnaireActions>
            </Questionnaire>
            <Questionnaire className="w-full max-w-md">
              <QuestionnaireItem name="memo">
                <QuestionnaireTitle>기사님께 남길 말(예시)</QuestionnaireTitle>
                <QuestionnaireInput aria-label="기사님께 남길 말" placeholder="예: 경비실에 맡겨 주세요" />
              </QuestionnaireItem>
            </Questionnaire>
          </Section>

          <Section name="radio-group">
            <RadioGroup defaultValue="am" aria-label="도착 시간대">
              <Label className="flex items-center gap-2">
                <RadioGroupItem value="am" /> 오전
              </Label>
              <Label className="flex items-center gap-2">
                <RadioGroupItem value="pm" /> 오후
              </Label>
            </RadioGroup>
          </Section>

          <Section name="resizable">
            <ResizablePanelGroup className="h-32 max-w-md rounded-lg border">
              <ResizablePanel defaultSize="50%">
                <div className="flex h-full items-center justify-center">목록</div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="50%">
                <div className="flex h-full items-center justify-center">상세</div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </Section>

          <Section name="scroll-area">
            <ScrollArea className="h-32 w-64 rounded-lg border">
              <ul className="p-3">
                {Array.from({ length: 12 }, (_, i) => (
                  <li key={i}>{i + 1}주차 발주(예시)</li>
                ))}
              </ul>
            </ScrollArea>
          </Section>

          <Section name="select">
            <Select defaultValue="thu">
              <SelectTrigger aria-label="배송 요일" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mon">월요일</SelectItem>
                <SelectItem value="thu">목요일</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <Section name="separator">
            <div className="flex h-6 items-center gap-3">
              <span>흰 우유</span>
              <Separator orientation="vertical" />
              <span>저지방</span>
            </div>
          </Section>

          <Section name="sheet">
            <Sheet>
              <SheetTrigger render={<Button variant="outline" />}>상세 보기</SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>발주 상세</SheetTitle>
                  <SheetDescription>{LONG}</SheetDescription>
                </SheetHeader>
                <SheetFooter>
                  <SheetClose render={<Button variant="outline" />}>닫기</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </Section>

          <Section name="sidebar">
            <SidebarProvider className="min-h-0 w-auto">
              <Sidebar collapsible="none" className="h-48 rounded-lg border">
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel>운영</SidebarGroupLabel>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton isActive>
                          <MilkIcon />
                          <span>발주</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <FileTextIcon />
                          <span>거래 명세</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
            {/* dashboard 원형 안(SiteShell 이 다는 data-archetype): 동작 버튼 20px 의 확장이 마우스에서 24, 터치에서 44 — 예외 dashboard-dense-actions */}
            <div data-archetype="dashboard" data-qa="sidebar-dashboard">
              <SidebarProvider className="min-h-0 w-auto">
                <Sidebar collapsible="none" className="h-48 rounded-lg border">
                  <SidebarContent>
                    <SidebarGroup>
                      <SidebarGroupLabel>대시보드 (예시)</SidebarGroupLabel>
                      <SidebarGroupAction aria-label="보고서 추가">
                        <PlusIcon />
                      </SidebarGroupAction>
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton>
                            <InboxIcon />
                            <span>미수금</span>
                          </SidebarMenuButton>
                          <SidebarMenuAction aria-label="미수금 더 보기">
                            <MoreHorizontalIcon />
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    </SidebarGroup>
                  </SidebarContent>
                </Sidebar>
              </SidebarProvider>
            </div>
            {/* 접힌 아이콘 모드(collapsible="icon") 터치 견본 — P2 이월(P3-2 Task 2 Step 7). 아이콘 사이 틈이 터치 44px 와 겹치는지
                hit-area --pointer coarse 로 잰다. 사이드바 틀은 fixed 라 transform 으로 이 칸 안에 가둔다(768px 이상에서만 그려진다). */}
            <div data-qa="sidebar-icon-collapsed" className="relative h-72 w-20 [transform:translateZ(0)]">
              <SidebarProvider defaultOpen={false} className="h-full min-h-0 w-auto">
                <Sidebar collapsible="icon" className="h-full">
                  <SidebarContent>
                    <SidebarGroup>
                      <SidebarGroupLabel>운영</SidebarGroupLabel>
                      <SidebarMenu>
                        {[
                          { Icon: MilkIcon, label: "발주" },
                          { Icon: FileTextIcon, label: "거래 명세" },
                          { Icon: InboxIcon, label: "미수금" },
                          { Icon: BellIcon, label: "알림" },
                        ].map(({ Icon, label }, i) => (
                          <SidebarMenuItem key={label}>
                            <SidebarMenuButton isActive={i === 0}>
                              <Icon />
                              <span>{label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroup>
                  </SidebarContent>
                </Sidebar>
              </SidebarProvider>
            </div>
          </Section>

          <Section name="skeleton">
            <div className="flex w-64 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Section>

          <Section name="slider">
            <Slider defaultValue={[60]} max={100} aria-label="수량" className="max-w-sm" />
          </Section>

          <Section name="spinner">
            <Spinner />
          </Section>

          <Section name="switch">
            <Label className="flex items-center gap-2">
              <Switch defaultChecked /> 매주 자동 발주
            </Label>
          </Section>

          <Section name="table">
            <Table className="max-w-md">
              <TableCaption>요일별 주문 팩 수(예시)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">요일</TableHead>
                  <TableHead scope="col" className="text-right">팩</TableHead>
                  <TableHead scope="col" className="text-right">금액(원)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ORDERS.map((o) => (
                  <TableRow key={o.day}>
                    <TableCell>{o.day}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.packs}</TableCell>
                    <TableCell className="text-right tabular-nums">{won.format(o.packs * 1300)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section name="tabs">
            <Tabs defaultValue="week" className="max-w-md">
              <TabsList>
                <TabsTrigger value="week">이번 주</TabsTrigger>
                <TabsTrigger value="month">이번 달</TabsTrigger>
              </TabsList>
              <TabsContent value="week">이번 주 발주 60팩(예시)</TabsContent>
              <TabsContent value="month">이번 달 발주 240팩(예시)</TabsContent>
            </Tabs>
          </Section>

          <Section name="textarea">
            <Textarea aria-label="요청 사항" placeholder="예: 뒷문에 놓아 주세요" className="max-w-md" />
          </Section>

          <Section name="toast">
            <Button
              data-qa="toast-trigger"
              onClick={() =>
                toast.add({
                  title: LONG,
                  description: "4초 안에 되돌릴 수 있습니다.",
                  timeout: 4000,
                  actionProps: { children: "되돌리기" },
                })
              }
            >
              임시 저장하기
            </Button>
          </Section>

          <Section name="toggle-group">
            <ToggleGroup multiple defaultValue={["white"]} aria-label="품목 필터">
              <ToggleGroupItem data-qa="filter" value="white">흰 우유</ToggleGroupItem>
              <ToggleGroupItem data-qa="filter" value="lowfat">저지방</ToggleGroupItem>
              <ToggleGroupItem data-qa="filter" value="choco">초코</ToggleGroupItem>
            </ToggleGroup>
          </Section>

          <Section name="toggle">
            <Toggle aria-label="굵게">가</Toggle>
          </Section>

          {/* 히트 영역 겹침 검수(Task 13a 항목 4) — 묶음 안·밖에서 흔한 간격으로 붙여 둔다(묶음 밖 toggle 은 DESIGN §7 의 8px). hit-area.mjs 가 겹침을 fine·coarse 로 잰다. */}
          <Section name="hit-overlap">
            <ButtonGroup orientation="vertical" aria-label="세로 버튼 묶음(예시)">
              <Button variant="outline" size="sm">위로</Button>
              <Button variant="outline" size="sm">가운데</Button>
              <Button variant="outline" size="sm">아래로</Button>
            </ButtonGroup>
            <ToggleGroup orientation="vertical" defaultValue={["a"]} aria-label="세로 토글 묶음(예시)">
              <ToggleGroupItem value="a">오전</ToggleGroupItem>
              <ToggleGroupItem value="b">오후</ToggleGroupItem>
              <ToggleGroupItem value="c">저녁</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              {["흰 우유", "저지방", "두유"].map((t) => (
                <Label key={t} className="flex items-center gap-2">
                  <Checkbox /> {t}
                </Label>
              ))}
            </div>
            <Slider defaultValue={[40, 42]} max={100} aria-label="가격 범위(예시)" className="w-48" />
            <div className="flex gap-2">
              <Toggle size="sm" aria-label="굵게">가</Toggle>
              <Toggle size="sm" aria-label="기울임">나</Toggle>
              <Toggle size="sm" aria-label="밑줄">다</Toggle>
            </div>
            <InputGroup className="w-56">
              <InputGroupInput aria-label="검색어(예시)" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="지우기">×</InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Section>

          <Section name="tooltip">
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>도움말</TooltipTrigger>
              <TooltipContent>수요일 오후 3시까지 확정해야 목요일에 도착합니다.</TooltipContent>
            </Tooltip>
          </Section>
          </Sections>
        </main>
      </Toaster>
    </TooltipProvider>
  )
}
