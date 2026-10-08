// 타입 검사(npm run typecheck 가 돈다 — P3-2 Task 1c, 리뷰 I-6): FixtureStates<P> 가 블록 props 에서 data·receipt 타입을 뽑는다.
// 틀린 모양은 @ts-expect-error 로 적었다 — 타입이 느슨해지면(그 줄이 오류가 아니게 되면) typecheck 가 실패한다(음성 대조).
import type { ActionResult, AsyncState, BlockBase } from "@/registry/factory/contract/block-contract"
import type { FixtureStates } from "@/registry/factory/contract/adapter-mock"

type Product = { name: string; price: number }
type DataProps = BlockBase<{ title: string }> & { state: AsyncState<Product[]> }
type FormProps = BlockBase<{ title: string }> & { submit: (input: { name: string }) => Promise<ActionResult<{ id: string }>> }

export const dataOk: FixtureStates<DataProps> = { data: [{ name: "가(예시)", price: 1000 }], reason: "아직 없습니다(예시)." }
// @ts-expect-error — data 는 Product[] 다
export const dataBad: FixtureStates<DataProps> = { data: [{ title: "x" }] }
// @ts-expect-error — 데이터 블록에는 접수 결과가 없다(never)
export const dataNoReceipt: FixtureStates<DataProps> = { receipt: { id: "x" } }
export const formOk: FixtureStates<FormProps> = { receipt: { id: "R-1" }, fieldErrors: { name: ["확인해 주세요(예시)."] }, formError: "다시 확인해 주세요(예시)." }
// @ts-expect-error — receipt 는 { id: string } 이다
export const formBad: FixtureStates<FormProps> = { receipt: { id: 1 } }
