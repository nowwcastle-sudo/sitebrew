// @launch-factory/contract — web-factory 계약(태그·커밋 고정, contract.lock.json)을 다시 내보낸다.
// src/web-factory/ 아래는 sync-contract.mjs 가 쓴 파일이다. 손으로 고치지 않는다(--check 가 잡는다).
import { CONTRACT_VERSION } from "./web-factory/contract/events.ts"
import { CONTRACT_VERSION_EXPECTED } from "./expected.ts"

export * from "./web-factory/contract/events.ts"
export * from "./web-factory/contract/ports.ts"
export * from "./web-factory/contract/attribution.ts"
export type * from "./web-factory/contract/block-contract.ts"
export { CONTRACT_VERSION_EXPECTED }

// 판이 다르면 typecheck 가 여기서 실패한다(조용히 옛 타입으로 빌드되지 않게 — Review Focus 4).
const versionMatches: typeof CONTRACT_VERSION extends typeof CONTRACT_VERSION_EXPECTED ? true : never = true
// 타입을 건너뛴 빌드에서도 불러오는 순간 멈춘다.
if (!versionMatches || (CONTRACT_VERSION as number) !== CONTRACT_VERSION_EXPECTED) {
  throw new Error(`web-factory 계약 판 ${CONTRACT_VERSION} — launch-factory는 ${CONTRACT_VERSION_EXPECTED}를 기대`)
}
