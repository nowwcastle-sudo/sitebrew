// 찍어내기 단계 파일(J7, P3-3 Task 2): out/<run>/<candidate>/<step>.json = { inputHash, producedAt, data }.
//   다음 단계는 앞 단계 파일만 읽는다. 입력 해시가 같고 파일이 있으면 그 단계를 건너뛴다 — 중간에 죽은 실행을 다시 돌리면
//   끝난 단계는 읽기만 하고, 입력(브리프·앞 단계 결과)이 바뀐 단계부터 다시 만든다.
//   부르는 쪽은 앞 단계 결과를 다음 단계 inputs 에 넣는다. 그래야 앞 단계가 다시 만들어질 때 뒤 단계도 따라 다시 돈다.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const STEP_NAMES = ['01-direction', '02-sitemap', '03-variants', '04-content', '05-media', '06-pages', '07-qa', '08-board']
const CAND = /^[a-z0-9][a-z0-9._-]*$/i

// 키를 정렬한 JSON — 같은 값이면 키 순서와 상관없이 같은 해시.
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted)
  if (v && typeof v === 'object' && v.constructor === Object) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
  return v
}
export const inputHash = (inputs) => createHash('sha256').update(JSON.stringify(sorted(inputs ?? null))).digest('hex')

export function openRun(runDir) {
  return {
    dir: runDir,
    /** 단계 하나. 입력 해시가 같은 파일이 있으면 그 data 를, 없으면 produce() 결과를 써서 돌려준다. opts.refresh 면 입력이 같아도 캐시를 읽지 않고 다시 만든다(FIT-6 — 측정 못 함이 남은 07). */
    async step(cand, name, inputs, produce, opts = {}) {
      if (!CAND.test(cand)) throw new Error(`후보 이름은 영문·숫자·. _ - 만 쓴다: ${JSON.stringify(cand)}`)
      if (!STEP_NAMES.includes(name)) throw new Error(`모르는 단계: ${name} (${STEP_NAMES.join('·')})`)
      const file = join(runDir, cand, `${name}.json`)
      const hash = inputHash(inputs)
      if (!opts.refresh && existsSync(file)) {
        try {
          const saved = JSON.parse(readFileSync(file, 'utf8'))
          if (saved.inputHash === hash && 'data' in saved) return saved.data
        } catch {
          // 반쯤 쓰다 죽은 파일 — 다시 만든다.
        }
      }
      const data = await produce()
      const text = JSON.stringify({ inputHash: hash, producedAt: new Date().toISOString(), data: data ?? null }, null, 2) + '\n'
      mkdirSync(join(runDir, cand), { recursive: true })
      writeFileSync(`${file}.tmp`, text)
      renameSync(`${file}.tmp`, file)
      return JSON.parse(text).data
    },
  }
}
