// 블록 비동기 상태 표(P3-2 Task 1c — 리뷰 I-6·G-2). 의존 0 인 순수 모듈이라 갤러리(app/qa/blocks — 클라이언트)와 관문 job 빌더(Task 7)가
// 같은 표를 부른다. blocks.mjs 가 다시 내보낸다(정본 이름 blocks.mjs STATE_QUERY).
// 메타 states 값(.block.json) → 갤러리 쿼리 한 쌍. 읽기 상태는 &state=, 제출 결과는 &submit=(adapter-mock stateFromQuery 가 읽는다).
export const STATE_QUERY = {
  loading: { key: 'state', value: 'loading' },
  empty: { key: 'state', value: 'empty' },
  error: { key: 'state', value: 'error' },
  ready: { key: 'state', value: 'ready' },
  'submit-ok': { key: 'submit', value: 'ok' },
  'submit-field-error': { key: 'submit', value: 'field-error' },
  'submit-server-error': { key: 'submit', value: 'server-error' },
  'submit-pending': { key: 'submit', value: 'pending' },
}
export const BLOCK_STATES = Object.keys(STATE_QUERY)
export const READ_STATES = BLOCK_STATES.filter((s) => STATE_QUERY[s].key === 'state')
export const SUBMIT_STATES = BLOCK_STATES.filter((s) => STATE_QUERY[s].key === 'submit')
// 메타 상태 하나 → 쿼리 조각("state=loading"). 모르는 값이면 멈춘다(빈 쿼리로 기본 상태를 조용히 찍지 않게).
export function stateQuery(state) {
  const q = STATE_QUERY[state]
  if (!q) throw new Error(`블록 상태 ${state} 는 없다. 허용 값: ${BLOCK_STATES.join('|')}`)
  return `${q.key}=${q.value}`
}
