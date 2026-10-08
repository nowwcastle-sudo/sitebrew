// 아이콘 어댑터: 정본 이름(47개) → @tabler/icons-react. 세 어댑터(lucide·phosphor·tabler)의 이름 집합은 같다(factory/scripts/kits.test.mjs).
// 부품 원천(ui-src)은 @/registry/factory/icons 에서 정본 이름을 부르고, 컴파일이 그 경로를 레시피의 어댑터로 바꾼다.
import { createElement, forwardRef, type ComponentType, type RefAttributes } from "react"
import type { Icon as TablerIcon, IconProps } from "@tabler/icons-react"
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowDown,
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconAlertOctagon,
  IconClock,
  IconCopy,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFilter,
  IconHeart,
  IconHome,
  IconInfoCircle,
  IconLayoutSidebar,
  IconLoader2,
  IconLock,
  IconLogout,
  IconMail,
  IconMapPin,
  IconMenu2,
  IconMinus,
  IconPencil,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShare,
  IconShoppingCart,
  IconSortAscending,
  IconStar,
  IconTrash,
  IconUpload,
  IconUser,
  IconX,
} from "@tabler/icons-react"

// 이름(aria-*·role·title)을 받지 않은 아이콘은 장식이라 aria-hidden — lucide-react 기본 동작과 같게(부품의 아이콘이 읽히지 않게).
// 선 굵기는 svg.tabler-icon 에 거는 --icon-stroke 규칙(icons-tabler 항목 css)이 맡는다.
const named = (props: object) => Object.keys(props).some((k) => k.startsWith("aria-") || k === "role" || k === "title")
function bind(Icon: TablerIcon, name: string) {
  const Glyph = Icon as ComponentType<IconProps & RefAttributes<SVGSVGElement>>
  const Bound = forwardRef<SVGSVGElement, IconProps>((props, ref) =>
    createElement(Glyph, { ref, ...(named(props) ? {} : { "aria-hidden": true }), ...props })
  )
  Bound.displayName = name
  return Bound
}

export const Search = bind(IconSearch, "Search")
export const Menu = bind(IconMenu2, "Menu")
export const X = bind(IconX, "X")
export const Check = bind(IconCheck, "Check")
export const ChevronDown = bind(IconChevronDown, "ChevronDown")
export const ChevronRight = bind(IconChevronRight, "ChevronRight")
export const ArrowRight = bind(IconArrowRight, "ArrowRight")
export const Calendar = bind(IconCalendar, "Calendar")
export const Clock = bind(IconClock, "Clock")
export const MapPin = bind(IconMapPin, "MapPin")
export const Phone = bind(IconPhone, "Phone")
export const Mail = bind(IconMail, "Mail")
export const User = bind(IconUser, "User")
export const Settings = bind(IconSettings, "Settings")
export const Plus = bind(IconPlus, "Plus")
export const Minus = bind(IconMinus, "Minus")
export const Trash = bind(IconTrash, "Trash")
export const Edit = bind(IconPencil, "Edit")
export const Copy = bind(IconCopy, "Copy")
export const ExternalLink = bind(IconExternalLink, "ExternalLink")
export const Info = bind(IconInfoCircle, "Info")
export const AlertTriangle = bind(IconAlertTriangle, "AlertTriangle")
export const AlertCircle = bind(IconAlertCircle, "AlertCircle")
export const CheckCircle = bind(IconCircleCheck, "CheckCircle")
export const Filter = bind(IconFilter, "Filter")
export const SortAsc = bind(IconSortAscending, "SortAsc")
export const Download = bind(IconDownload, "Download")
export const Upload = bind(IconUpload, "Upload")
export const Eye = bind(IconEye, "Eye")
export const EyeOff = bind(IconEyeOff, "EyeOff")
export const Lock = bind(IconLock, "Lock")
export const Home = bind(IconHome, "Home")
export const ShoppingCart = bind(IconShoppingCart, "ShoppingCart")
export const Heart = bind(IconHeart, "Heart")
export const Star = bind(IconStar, "Star")
export const Share = bind(IconShare, "Share")
export const Image = bind(IconPhoto, "Image")
export const File = bind(IconFile, "File")
export const Bell = bind(IconBell, "Bell")
export const LogOut = bind(IconLogout, "LogOut")
export const ChevronUp = bind(IconChevronUp, "ChevronUp")
export const ChevronLeft = bind(IconChevronLeft, "ChevronLeft")
export const MoreHorizontal = bind(IconDots, "MoreHorizontal")
export const ArrowDown = bind(IconArrowDown, "ArrowDown")
export const PanelLeft = bind(IconLayoutSidebar, "PanelLeft")
export const LoaderCircle = bind(IconLoader2, "LoaderCircle")
export const XOctagon = bind(IconAlertOctagon, "XOctagon")
