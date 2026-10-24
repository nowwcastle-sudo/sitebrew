// 제품형 전달(sitebrew v0.2.0 계획 3 Task 9) — launch-factory 의 composeProduct 로 템플릿 위에 시안을 얹은 제품 폴더를 만든다. 얇은 다리다:
//   resolveLf 가 찾은 폴더에서 scripts/compose/compose-product.mjs 를 import() 하고, 얹은 출력의 뿌리 메타(제품 이름·OG 언어)를 시안의 것으로 바꾸고,
//   README 에 더할 문장(실행 명령 배열·고른 기능·「제품 화면은 지금 영어」)을 만든다. 필요한 것·안내 장 목록은 README 에 싣지 않는다 — 실제로 쓰기로 한 뒤 런북이 보여 준다(계획 5 Task 10);
//   describeFeatures 의 needs·guides 는 그대로 계산해 돌려준다(런북이 쓴다). 쪽 지우기·링크 고치기·의존 합치기는 launch-factory 가 한다.
//   문장은 deliver-copy.json — 여기에는 사용자 문장도 파일 이름 목록도 없다. 뿌리 메타(제품 이름·OG 언어)는 launch-factory 의 얹기 단계(rootMeta)가 바꾼다.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describeFeatures } from '../intake/features.mjs'

export const LOOP_STEPS_FILE = join('template', 'e2e', 'loop-steps.json')
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

/** launch-factory 한 번 읽기: 한 바퀴 시험의 단계 표(loop 계산용). 없으면 빈 표 — README 의 loop 는 쓰지 않는다. */
export const loadLoopSteps = (lfDir) => {
  const file = join(lfDir, LOOP_STEPS_FILE)
  return existsSync(file) ? readJson(file).steps ?? {} : {}
}

/** 실행 명령 배열({ cwd, command, args }) → 셸 한 줄. 첫 cwd 를 한 번만 적는다. */
export const commandLine = (commands) => `cd "${commands[0].cwd}" && ${commands.map((c) => [c.command, ...c.args].join(' ')).join(' && ')}`

/**
 * 제품 폴더 만들기. dest 는 비었거나 없는 폴더다(deliver 가 이미 확인했다).
 * @returns {{ dir, commands, described, rootMetaSkipped }}
 */
export async function deliverProduct({ lfDir, srcSite, dest, features, table, name }) {
  const mod = await import(pathToFileURL(join(lfDir, 'scripts', 'compose', 'compose-product.mjs')).href)
  const described = describeFeatures(features, table, { loopSteps: loadLoopSteps(lfDir) })
  const r = mod.composeProduct({ siteDir: srcSite, features, table, lfDir, to: dest, name })
  const rootMetaSkipped = r.rootMetaSkipped ?? []
  return { dir: r.dir, commands: r.runCmd, described, rootMetaSkipped }
}

/**
 * README 에 더할 제품형 절(한 언어). 순수 함수 — info: { described, commands }, copy: deliver-copy.json, lang: 'ko'|'en'.
 * 실행 명령 코드 블록은 renderReadme 의 「실행하기」가 commands 로 그린다(여기서는 겹쳐 적지 않는다).
 */
export function productSection({ described }, copy, lang) {
  const say = (k) => copy[k][lang]
  const chosen = described.outcomes.map((o) => `- ${o.say[lang]}`)
  return [
    say('productRunLead'),
    '',
    say('productChosenTitle'),
    '',
    ...chosen,
    '',
    say('productEnglish'),
    '',
    say('productLegal'),
    '',
  ]
}
