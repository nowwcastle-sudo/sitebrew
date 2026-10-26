// 타입 검사(npm run typecheck 가 돈다 — 계획 3d): 관리 포트 타입의 울타리. 계약 층은 블록을 부르지 않으므로(import 층 규칙) 표·상세 모양을 블록 키트와 다시 적었다 —
// 여기서 두 모양이 서로 받아들여지는지 맞춘다(한쪽만 바뀌면 typecheck 가 멈춘다). 틀린 모양은 @ts-expect-error 로 적었다.
// admin-contract.test.mjs 가 이 파일에서 @ts-expect-error 줄을 지운 사본을 tsc 로 돌려, 오류가 바로 그 줄들에서 나는지 본다(음성 대조).
import type { ActionFailureCode, ActionResult } from "@/registry/factory/contract/block-contract"
import type { HumanConfirmation } from "@/registry/factory/contract/ports"
import type { AdminActInput, AdminColumn, AdminFailureCode, AdminOverview, AdminPort, AdminRecord, AdminResult, AdminRow, AdminTable } from "@/registry/factory/contract/admin"
import type { mockAdmin } from "@/registry/factory/contract/adapter-mock-admin"
import type { TableColumn, TableData, TableRowData } from "@/registry/factory/blocks/_shared/data-table-kit"
import type { RecordAction, RecordData, RecordField } from "@/registry/factory/blocks/data-table/record-panel"

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const same = <T extends true>(t: T) => t

// ① 결과·실패 갈래·확인 칸은 다른 포트와 같은 것이다
same<Same<AdminResult<number>, ActionResult<number>>>(true)
same<Same<Extract<AdminFailureCode, ActionFailureCode>, AdminFailureCode>>(true) // 모든 갈래가 ActionFailureCode 의 값이다
same<Same<AdminActInput["confirmed"], HumanConfirmation["confirmed"]>>(true)
same<Same<ReturnType<typeof mockAdmin>, AdminPort>>(true)

// ② 표·상세·개요는 블록이 받는 모양과 맞는다(블록 키트의 표 모양과 같고, 상세는 편집 칸·작업이 같다)
same<Same<AdminColumn, TableColumn>>(true)
same<Same<AdminRow, TableRowData>>(true)
export const tableForBlock: TableData = {} as AdminTable
export const recordForBlock: RecordData = {} as AdminRecord
export const fieldsForBlock: RecordField[] = {} as AdminRecord["fields"]
export const actionsForBlock: RecordAction[] = {} as AdminRecord["actions"]
export const noFailed: AdminOverview = { asOf: "2026-10-01T00:00:00.000Z", todo: [], metrics: [] }
export const someFailed: AdminOverview = { ...noFailed, failed: ["orders"] }

// ③ 틀린 모양
// @ts-expect-error — 확인 칸은 true 만(false 는 확인이 아니다)
export const notConfirmed: AdminActInput = { section: "orders", id: "o1", action: "cancel", confirmed: false }
// @ts-expect-error — 모르는 열 종류
export const badKind: AdminColumn = { id: "phone", label: "연락처", kind: "phone" }
// @ts-expect-error — 사용자(role·userId)는 입력으로 받지 않는다(세션에서 읽는다)
export const withRole: AdminActInput = { section: "orders", id: "o1", action: "cancel", role: "admin" }
// @ts-expect-error — failed 는 구획 id 글자의 목록이다
export const badFailed: AdminOverview = { ...noFailed, failed: [1] }
