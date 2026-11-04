// 07 후보 병렬 선택 옵션(v0.2.6 T16·S11) — 순수 함수만 둔다. 환경 변수 WF_QA_PARALLEL=1 일 때만 07 을 후보 동시 최대 3개로 돌린다. 기본은 끈다.
//   조사 결과(공유 지점): 후보마다 폴더(site·07-qa)·단계 파일·서버·Chrome 프로필이 따로라 겹치지 않는다. 겹치는 곳은 ① `next start` 빈 포트 고르기(고르고 닫은 뒤 다시 여는 틈)
//   — qa.mjs startSite 가 켜기를 한 줄로 세운다 ② 컴퓨터 자원 — 후보마다 서버 + Chrome + Lighthouse 라 여유 메모리가 모자라면 직렬로 물러선다
//   ③ 성능 점수(LCP·TBT)는 동시에 돌리면 낮게 나올 수 있다 — 그래서 기본을 끄고 로그에 알린다.
export const MAX_QA_PARALLEL = 3
/** 후보 하나를 더 동시에 돌리려면 남아야 하는 여유 메모리(GiB). */
export const FREE_GIB_PER_WORKER = 2
const GIB = 1024 ** 3

/**
 * @param {{ env?: Record<string,string|undefined>, count: number, freeBytes: number }} p
 * @returns {{ limit: number, reason?: 'off'|'single'|'memory' }} limit 1 = 직렬(reason 은 왜 직렬인지)
 */
export function qaParallelLimit({ env = process.env, count, freeBytes }) {
  if (env.WF_QA_PARALLEL !== '1') return { limit: 1, reason: 'off' }
  if (count < 2) return { limit: 1, reason: 'single' }
  const byMemory = Math.floor(freeBytes / GIB / FREE_GIB_PER_WORKER)
  const limit = Math.min(MAX_QA_PARALLEL, count, byMemory)
  return limit >= 2 ? { limit } : { limit: 1, reason: 'memory' }
}

/** 순서를 지켜 결과를 모으되 동시에 `limit` 개까지만 돌린다. fn 이 던지면 그 던짐이 그대로 나간다(호출한 쪽이 잡아 후보별 실패로 쓴다). */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}
