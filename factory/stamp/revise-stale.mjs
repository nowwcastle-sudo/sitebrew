// 수정을 고르면 낡는 단계 — revise.mjs(고르기)와 revise-history.mjs(되돌리기)가 함께 쓰는 잎 모듈(서로를 부르지 않는다).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 고르면 지금 사이트(06)와 관문 결과(07)는 낡는다 — 단계 파일의 자료는 두고 입력 해시만 바꿔, 다음 찍어내기가 두 단계를 다시 돈다(파일이 없으면 건너뛴다). */
export const STALE_STAGES = ['06', '07']
export const STALE_FILES = ['06-pages', '07-qa'] // STALE_STAGES 의 단계 파일 이름

/** 방향 3안을 다시 고르면(--redraw-wider) 변형(03)부터 낡는다 — 02 사이트맵은 방향에 기대지 않는다. */
export const REDRAW_FILES = ['03-variants', '04-content', '05-media', ...STALE_FILES]

/**
 * 단계 파일의 입력 해시를 낡은 값으로 바꾼다(files 기본은 06·07). 구획 수정이 03 에 적어 둔 revisedFor(그 사이트맵이면 03 을 다시 고르지 않고 쓰는 열쇠)도 지워,
 * 사이트맵이 그대로여도 03 을 다시 고르게 한다 — 고른 블록이 낡은 레시피 기준이라서.
 */
export function markStale(candDir, index, files = STALE_FILES) {
  for (const name of files) {
    const file = join(candDir, `${name}.json`)
    if (!existsSync(file)) continue
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    if (saved === null || typeof saved !== 'object' || !('inputHash' in saved) || !('data' in saved)) continue
    const next = { ...saved, inputHash: `stale:revise-${index}` }
    delete next.revisedFor
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  }
}
