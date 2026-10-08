// 아이콘 어댑터: 정본 이름(47개) → @phosphor-icons/react. 세 어댑터(lucide·phosphor·tabler)의 이름 집합은 같다(factory/scripts/kits.test.mjs).
// 부품 원천(ui-src)은 @/registry/factory/icons 에서 정본 이름을 부르고, 컴파일이 그 경로를 레시피의 어댑터로 바꾼다.
// Phosphor 는 선 굵기가 아니라 굵기(weight) 모양이 따로 있어 --icon-stroke 가 듣지 않는다. 결(G1~G5)은 WEIGHT 로 정한다:
// G1·G3·G4 → regular(이 파일), G2 → light(phosphor-light.ts), G5 → bold(phosphor-bold.ts). 두 파일은 gen-kits.mjs 가 이 파일에서 WEIGHT 만 바꿔 만든다.
import { createElement, forwardRef } from "react"
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  BellIcon,
  CalendarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  ClockIcon,
  CopyIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FileIcon,
  FunnelIcon,
  GearIcon,
  HeartIcon,
  HouseIcon,
  ImageIcon,
  InfoIcon,
  ListIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MinusIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlusIcon,
  ShareNetworkIcon,
  ShoppingCartIcon,
  SidebarIcon,
  SignOutIcon,
  SortAscendingIcon,
  StarIcon,
  TrashIcon,
  UploadSimpleIcon,
  UserIcon,
  WarningCircleIcon,
  WarningIcon,
  WarningOctagonIcon,
  XIcon,
} from "@phosphor-icons/react/ssr"

const WEIGHT: IconWeight = "regular"

// 크기 기본값 24(lucide·tabler 와 같다 — Phosphor 기본값은 1em), 색은 currentColor(Phosphor 기본값).
// 이름(aria-*·role·title)을 받지 않은 아이콘은 장식이라 aria-hidden — lucide-react 기본 동작과 같게(부품의 아이콘이 읽히지 않게).
const named = (props: object) => Object.keys(props).some((k) => k.startsWith("aria-") || k === "role" || k === "title")
function bind(Glyph: PhosphorIcon, name: string) {
  const Bound = forwardRef<SVGSVGElement, IconProps>((props, ref) =>
    createElement(Glyph, { ref, size: 24, weight: WEIGHT, ...(named(props) ? {} : { "aria-hidden": true }), ...props })
  )
  Bound.displayName = name
  return Bound
}

export const Search = bind(MagnifyingGlassIcon, "Search")
export const Menu = bind(ListIcon, "Menu")
export const X = bind(XIcon, "X")
export const Check = bind(CheckIcon, "Check")
export const ChevronDown = bind(CaretDownIcon, "ChevronDown")
export const ChevronRight = bind(CaretRightIcon, "ChevronRight")
export const ArrowRight = bind(ArrowRightIcon, "ArrowRight")
export const Calendar = bind(CalendarIcon, "Calendar")
export const Clock = bind(ClockIcon, "Clock")
export const MapPin = bind(MapPinIcon, "MapPin")
export const Phone = bind(PhoneIcon, "Phone")
export const Mail = bind(EnvelopeIcon, "Mail")
export const User = bind(UserIcon, "User")
export const Settings = bind(GearIcon, "Settings")
export const Plus = bind(PlusIcon, "Plus")
export const Minus = bind(MinusIcon, "Minus")
export const Trash = bind(TrashIcon, "Trash")
export const Edit = bind(PencilSimpleIcon, "Edit")
export const Copy = bind(CopyIcon, "Copy")
export const ExternalLink = bind(ArrowSquareOutIcon, "ExternalLink")
export const Info = bind(InfoIcon, "Info")
export const AlertTriangle = bind(WarningIcon, "AlertTriangle")
export const AlertCircle = bind(WarningCircleIcon, "AlertCircle")
export const CheckCircle = bind(CheckCircleIcon, "CheckCircle")
export const Filter = bind(FunnelIcon, "Filter")
export const SortAsc = bind(SortAscendingIcon, "SortAsc")
export const Download = bind(DownloadSimpleIcon, "Download")
export const Upload = bind(UploadSimpleIcon, "Upload")
export const Eye = bind(EyeIcon, "Eye")
export const EyeOff = bind(EyeSlashIcon, "EyeOff")
export const Lock = bind(LockIcon, "Lock")
export const Home = bind(HouseIcon, "Home")
export const ShoppingCart = bind(ShoppingCartIcon, "ShoppingCart")
export const Heart = bind(HeartIcon, "Heart")
export const Star = bind(StarIcon, "Star")
export const Share = bind(ShareNetworkIcon, "Share")
export const Image = bind(ImageIcon, "Image")
export const File = bind(FileIcon, "File")
export const Bell = bind(BellIcon, "Bell")
export const LogOut = bind(SignOutIcon, "LogOut")
export const ChevronUp = bind(CaretUpIcon, "ChevronUp")
export const ChevronLeft = bind(CaretLeftIcon, "ChevronLeft")
export const MoreHorizontal = bind(DotsThreeIcon, "MoreHorizontal")
export const ArrowDown = bind(ArrowDownIcon, "ArrowDown")
export const PanelLeft = bind(SidebarIcon, "PanelLeft")
export const LoaderCircle = bind(CircleNotchIcon, "LoaderCircle")
export const XOctagon = bind(WarningOctagonIcon, "XOctagon")
