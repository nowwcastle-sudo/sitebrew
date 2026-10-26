// 영어 관리 화면 문구(개요 · 구획 표 · 기록 상세 · 사이드바 · 접근 거절) — 제품이 콘텐츠로 바꾼다. 관리 화면은 영어 하나다(구획 이름·열 이름은 구획 모듈이 준다).
// 화면 글은 모두 여기 있다: 블록은 copy 로 받고, 조립(components/product/admin-blocks.tsx)은 이 글을 그대로 넘긴다.
// CSV 내려받기는 3d 에서 연결하지 않는다 — 표 문구 타입에서 export 칸을 뺐다.
import type { DashboardPanelActionListCopy } from "@/components/blocks/dashboard-panel/action-list"
import type { DashboardPanelKpiFirstCopy } from "@/components/blocks/dashboard-panel/kpi-first"
import type { DataTableAdminListCopy } from "@/components/blocks/data-table/admin-list"
import type { DataTableRecordPanelCopy } from "@/components/blocks/data-table/record-panel"
import type { NavAppSidebarCopy } from "@/components/blocks/nav/app-sidebar"
import type { NavTopBarCopy } from "@/components/blocks/nav/top-bar"
import { submitNotices } from "@/content/copy.en"
import { PRODUCT_NAME } from "@/content/copy.en"
import { adminMessages } from "@/content/copy.admin-messages.en"

/** 쪽 제목(h1, 화면 낭독기·문서 윤곽용) */
export const adminPageTitles = { overview: "Admin overview", list: "{section}", record: "{section} record" }

/** 접근 거절 한 줄 — 사유마다 한 줄이고, 누가 왜 막혔는지(관리자 목록·계정 존재 여부)는 말하지 않는다 */
export const adminDenied = {
  title: "This page isn't available to you",
  forbidden: adminMessages.forbidden,
  two_factor_required: adminMessages.two_factor_required,
  impersonation_blocked: adminMessages.impersonation_blocked,
  provider_unavailable: adminMessages.provider_unavailable,
  nothing: "There is nothing to manage here for your account.",
  other: "We couldn't open the admin pages. Please try again in a moment.",
  home: "Back to the site",
  account: "Open your account",
}

/** 한 구획·기록을 못 열었을 때(읽기 실패) */
export const adminReadError = { title: "We couldn't load this", retryLabel: "Reload" }

export const adminNav: Omit<NavAppSidebarCopy, "groups"> & { overview: string } = {
  brand: { name: `${PRODUCT_NAME} admin`, href: "/admin" },
  navLabel: "Admin",
  collapse: "Collapse the menu",
  expand: "Expand the menu",
  overview: "Overview",
}

export const adminTopBar: NavTopBarCopy = {
  title: "Admin",
  account: {
    menuLabel: "Account",
    links: [
      { label: "Your account", href: "/account" },
      { label: "Back to the site", href: "/" },
    ],
  },
}

/** 개요: 먼저 할 일 한 가지 + 최근 변화 숫자 */
export const overviewCopy: DashboardPanelKpiFirstCopy = {
  title: "What needs you today",
  lead: "The first thing to do, and how things moved compared with the earlier period.",
  asOfLabel: "As of",
  focusLabel: "Do this first",
  kpi: { target: "Target {v}", range: "Normal {a}–{b}", compare: "Compared with {p}", up: "Up {v}", down: "Down {v}", flat: "No change" },
  loadingLabel: "Loading the overview",
  empty: { title: "Nothing needs you right now", body: "New orders, bookings and messages will show up here." },
  error: { title: "We couldn't load the overview", retryLabel: "Reload" },
}
export const todoCopy: DashboardPanelActionListCopy = {
  title: "To do",
  lead: "Things waiting for you, most urgent first.",
  asOfLabel: "As of",
  severity: { critical: "Urgent", warning: "Needs attention" },
  countTemplate: "{critical} urgent · {warning} need attention",
  ownerLabel: "Owner",
  dueLabel: "Due",
  loadingLabel: "Loading the to-do list",
  empty: { title: "Nothing is waiting for you", body: "When something needs a person, it will be listed here." },
  error: { title: "We couldn't load the to-do list", retryLabel: "Reload" },
}
export const todoOpenLabel = "Open"
/** 개요를 못 만든 구획이 있을 때의 한 줄 — {sections} 은 구획 id 목록 */
export const overviewFailed = "Some parts of the overview couldn't be loaded ({sections}). Reload to try again."

/** 구획 표. title·lead 는 구획 이름으로 채운다 */
export const listCopy: Omit<DataTableAdminListCopy, "export" | "title" | "lead"> = {
  caption: "Records with their key details; select a name to open one",
  regionLabel: "Records",
  search: { label: "Search records", placeholder: "Search" },
  filterAll: "All",
  reset: "Clear filters",
  count: "{shown} shown",
  sort: { asc: "Sort ascending", desc: "Sort descending", hint: "Select to sort" },
  pager: { label: "Pages", prev: "Previous page", next: "Next page", range: "{from}–{to} of {total}", page: "Page {page}" },
  empty: { title: "Nothing here yet", body: "Records will appear here as they come in." },
  noResults: { title: "No records match", body: "Nothing matches your search or filters.", reset: "Clear filters" },
  loading: "Loading records",
  error: { title: "We couldn't load the records", retryLabel: "Reload" },
}
/** 목록이 한 쪽보다 길 때(쪽 매김)의 안내 — {from}·{to}·{total}. 쪽 이동은 아래 listPager */
export const listRange = "Showing {from}–{to} of {total}. Search to narrow it down."
/** 범위를 넘은 쪽(줄이 없음)의 안내 — {total} */
export const listPastEnd = "There are no records on this page. {total} in total."
/** 서버 쪽 이동 줄(표 블록 안의 10줄 쪽 이동과 따로다) — {from}·{to}·{total}·{page}·{pages} */
export const listPager = { label: "Result pages", range: "Records {from}–{to} of {total}", page: "Page {page} of {pages}", prev: "Previous records", next: "Next records" }
export const listLead = "Select a name to open the record."
/** 기록 상세에서 목록으로 돌아가는 링크 이름 — {section} 은 구획 이름 */
export const recordBackLabel = "Back to {section}"
/** 편집 칸이 없는 기록의 오른쪽 제목(편집 폼은 숨기고 위험 행동만 남을 때) */
export const recordMoreTitle = "More options"

/**
 * 기록 상세 문구. title 은 기록의 제목, danger 는 위험 행동의 이름표(구획이 하나 정한다)로 채운다.
 * back 은 구획 목록 쪽 — 행동이 끝난 뒤 돌아갈 곳이다.
 */
export function recordCopy(input: { title: string; danger?: { label: string }; editable?: boolean; back: { label: string; href: string } }): DataTableRecordPanelCopy {
  const label = input.danger?.label ?? "Confirm"
  return {
    title: input.title,
    summaryTitle: "Details",
    actionsTitle: "Actions",
    editTitle: input.editable === false ? recordMoreTitle : "Edit",
    required: "(required)",
    optional: "(optional)",
    form: {
      required: "Fill in this field",
      submitLabel: "Save changes",
      pendingLabel: "Saving",
      errorTitle: "We couldn't save that",
      fieldErrorTitle: "Please check the highlighted fields",
      notices: submitNotices,
      done: { title: "Saved", body: "Your changes were saved." },
    },
    saved: "Saved",
    actionDone: "Done",
    danger: {
      title: "Careful",
      body: "This can't easily be undone, so you'll be asked to confirm first.",
      trigger: label,
      question: `${label}? This can't easily be undone.`,
      cancel: "Keep it",
      confirm: label,
      pending: "Working",
      errorTitle: "We couldn't do that",
      done: { title: "Done", body: "The change was made.", link: input.back },
    },
    empty: { title: "We couldn't find this record", body: "It may have been removed.", action: input.back },
    loading: "Loading the record",
    error: { title: "We couldn't load this record", retryLabel: "Reload" },
  }
}
