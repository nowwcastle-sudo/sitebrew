// 블록 행렬(P3-2 Task 7a — 블록 관문·7상태 감사·시각 회귀가 같이 쓰는 목록). 브라우저 없이 목록만 만든다(순수).
// 갤러리 주소: /qa/blocks?b=<블록>&r=<레시피>&theme=<light|dark>[&fx=max|min][&state=…][&sub=…]&frame=1  — 모든 행에 frame=1(검수대 설명 없이 블록만, 위 띠 44px).
//
// 판정 행렬(blockJobs({ full: false }), 관문 — 전체 한 번): 블록마다 레시피 3벌
//   ① primary  — 블록 메타 archetypes 에 맞는 레시피 중 첫 번째(없으면 첫 레시피)
//   ② face     — K6~K8 레시피 하나(면 스코프·대비) — 원형이 맞는 것을 먼저, ①과 다른 것
//   ③ quiet    — r1·r6·r10 중 모션 단계가 가장 낮은 것(①·②를 뺀다) — 동작 줄이기 가시성은 모든 행에서 따로 본다
//   레시피마다 1440·375 라이트 기본, 375 라이트 fx=max·min, ②는 1440 다크 하나 더(다크는 여기서만).
//   데이터 블록(메타 읽기 상태 넷)은 ① 375 라이트에 state= 4행, 조건 화면(구독 상태가 있어야 뜨는 블록)은 ① 1440 에 그 쿼리 행,
//   흐름·창 블록(SCENE_STEPS)은 ① 1440 에 「그 단계로 들어간」 행을 더한다(대장 A121 — 단계 안에서만 잴 수 있는 규칙이 na 로 남지 않게).
// 촬영 행렬(blockJobs({ full: true }), 시각 회귀 기준): 블록 × 레시피 전부 × 1440·375 × 라이트·다크 × fx 기본 — 판정 없이 찍기만 한다.
//   SCENE_STEPS 가 있는 블록은 단계마다 같은 행렬(40칸)을 더 찍는다(파일 이름 …-<테마>@<단계>.webp — 열린 창·가입 2단계·해지 2단계).
//   기준 폴더 <기준 루트>\<블록>\<레시피>-<폭>-<테마>.webp — WF_VISUAL_BASELINE, 없으면 $WF_DESIGN_RULES_DIR/factory/visual-baseline/blocks, 그것도 없으면 저장소 .tmp/visual-baseline/blocks (git 에 없다).
import { join } from 'node:path'
import { designRulesPath } from '../../lib/design-rules.mjs'
import { blockName } from '../../scripts/blocks.mjs'
import { READ_STATES, stateQuery } from '../../scripts/block-states.mjs'
import { BOLD_LOGICS } from '../../scripts/recipe.mjs'
import { EXTRA_SCENES } from '../../qa/marketing-blocks.mjs'
import { GATE_CHROME_FLAGS, ROOT } from '../recipe-board/jobs.mjs'

export { GATE_CHROME_FLAGS, ROOT }
export const WIDTHS = [1440, 375]
export const THEMES = ['light', 'dark']
export const FX = ['default', 'max', 'min']
export const OUT = join(ROOT, '.tmp', 'blocks-gates')
export const VISUAL_OUT = join(ROOT, '.tmp', 'blocks-visual')
// 시각 회귀 기준 폴더. WF_VISUAL_BASELINE → $WF_DESIGN_RULES_DIR/factory/visual-baseline/blocks → 저장소 .tmp/visual-baseline/blocks 순(D24 — 비공개 자료가 없어도 촬영은 된다).
export const BASELINE_DIR = process.env.WF_VISUAL_BASELINE ?? designRulesPath('factory/visual-baseline/blocks') ?? join(ROOT, '.tmp', 'visual-baseline', 'blocks')
// 모션이 가장 낮은 레시피를 고를 후보(계획 Task 7 Step 1 ③).
export const QUIET_CANDIDATES = ['r1', 'r6', 'r10']

// 「들어가서 재야 하는」 화면(대장 A121): 블록 이름 → 단계 id 목록. 구현은 gates.mjs STEPS 에 있다(시험이 둘이 맞는지 본다).
// 기본 그림 하나로는 안 열리는 흐름 단계·창이다 — 여기서 열지 않으면 그 안에서만 재지는 마케팅 규칙(cancel-steps·decline-parity·optin-unchecked 등)이 na 로 남는다.
export const SCENE_STEPS = {
  'block-auth-sign-up-consents': ['consents-step-2'],
  'block-retention-cancel-flow': ['cancel-step-2'],
  'block-paywall-upgrade-modal': ['open-dialog'],
  'block-consent-preference-dialog': ['open-dialog'],
  'block-lead-capture-cart-exit-offer': ['open-dialog'],
}

// 메타 값 하나(zod 결과든 평문이든) 꺼내기.
export const metaOf = (b) => (b.meta && 'success' in b.meta ? (b.meta.success ? b.meta.data : null) : b.meta) ?? null
// 갤러리(app/qa/blocks/view.tsx)가 오류 알림으로 그리는 짝 — D2(초대형 제목) 레시피 × 제목이 전폭이 아닌 히어로. 찍으면 도구 실패라 촬영 행렬에서 뺀다.
export const galleryRefuses = (meta, head) => meta?.kind === 'hero' && head?.axes?.display === 'D2' && meta.titleWidth !== 'full'
export const isDataBlock = (m) => READ_STATES.every((s) => (m.states ?? []).includes(s))
export const isFormBlock = (m) => (m.states ?? []).some((s) => s.startsWith('submit-'))
const motionLevel = (h) => Number(String(h.motion ?? 'M9').replace(/\D/g, '') || 9)

// 블록 하나의 판정 레시피 셋: { primary, face, quiet } (레시피 id). 순수·결정적.
// 소스에 data-face=(field|block)-… 를 그리는 블록 → 그 면 이름들(Set). 레시피 계열(K6·K7 field, K8 block)이 맞을 때만 면 규칙이 서고,
// 계열이 안 맞으면 그 레시피에는 그 스코프가 없다(블록이 카드 색으로 그린다).
export const recipeFaceFamily = (head) => (head.colorLogic === 'K8' ? 'block' : 'field')
export function faceFamilies(blocks) {
  const m = new Map()
  for (const b of blocks) {
    const fam = new Set([...(b.source ?? '').matchAll(/data-face=\{?[`"'](field|block)-/g)].map((x) => x[1]))
    if (fam.size) m.set(blockName(b.kind, b.variant), fam)
  }
  return m
}

// families(선택): 이 블록이 그리는 면 계열 — 있으면 ② 는 그 계열의 K6~K8 레시피를 먼저 고른다(면적 규칙이 실제로 서는 레시피).
export function judgeRecipes(meta, heads, families) {
  if (!heads.length) throw new Error('레시피가 0벌이다')
  const fits = (h) => (h.archetypes ?? []).some((a) => (meta.archetypes ?? []).includes(a))
  const bold = (h) => BOLD_LOGICS.includes(h.colorLogic)
  const famFit = (h) => Number(!!families?.has(recipeFaceFamily(h)))
  const primary = heads.find(fits) ?? heads[0]
  const face = heads.filter((h) => h.id !== primary.id && bold(h)).sort((a, b) => famFit(b) - famFit(a) || Number(fits(b)) - Number(fits(a)))[0]
  if (!face) throw new Error('K6~K8 레시피가 없다(면 스코프 행을 정할 수 없다)')
  const rest = heads.filter((h) => h.id !== primary.id && h.id !== face.id)
  const candidates = rest.filter((h) => QUIET_CANDIDATES.some((q) => h.id === q || h.id.startsWith(`${q}-`)))
  const pool = candidates.length ? candidates : rest
  const quiet = [...pool].sort((a, b) => motionLevel(a) - motionLevel(b))[0]
  if (!quiet) throw new Error('모션이 낮은 레시피를 고를 수 없다(레시피가 3벌 미만이다)')
  return { primary: primary.id, face: face.id, quiet: quiet.id }
}

// 주소 조각(순서 고정 — 같은 행은 같은 주소). extra 는 「sub=trialing」 같은 쿼리 조각.
export function jobPath({ block, recipe, theme, fx, state, extra }) {
  const q = [`b=${block}`, `r=${recipe}`, `theme=${theme}`]
  if (fx && fx !== 'default') q.push(`fx=${fx}`)
  if (state) q.push(state)
  if (extra) q.push(extra)
  q.push('frame=1')
  return `/qa/blocks?${q.join('&')}`
}
export const absUrl = (origin, job) => `${origin.replace(/\/$/, '')}${job.url}`

const idOf = (j) => [j.block, j.recipe, j.width, j.theme, j.fx, j.state ?? '', j.extra ?? '', j.step ?? ''].join('|')

/**
 * blockJobs({ blocks, recipes, full }) → Job[]
 *   blocks:  loadBlocks() 결과(또는 { kind, variant, meta }) — 메타 검사를 통과한 것
 *   recipes: 레시피 머리 목록(loadHeads())
 *   full:    false = 판정 행렬 · true = 촬영 행렬
 * Job = { mode, id, block, kind, variant, recipe, role, width, theme, fx, state?, extra?, step?, url, file? }
 */
export function blockJobs({ blocks, recipes, full = false, extras = EXTRA_SCENES, steps = SCENE_STEPS }) {
  const jobs = []
  const fam = faceFamilies(blocks)
  for (const b of blocks) {
    const meta = metaOf(b)
    if (!meta) continue
    const block = blockName(b.kind, b.variant)
    const base = { block, kind: b.kind, variant: b.variant }
    const push = (j) => {
      const job = { ...base, ...j, mode: full ? 'capture' : 'judge' }
      job.url = jobPath(job)
      job.id = idOf(job)
      if (full) job.file = `${block}/${job.recipe}-${job.width}-${job.theme}${job.step ? `@${job.step}` : ''}.webp`
      jobs.push(job)
    }
    if (full) {
      const shot = recipes.filter((h) => !galleryRefuses(meta, h))
      for (const h of shot) for (const width of WIDTHS) for (const theme of THEMES) push({ recipe: h.id, role: null, width, theme, fx: 'default' })
      // 장면(P3-8): SCENE_STEPS 의 단계로 들어간 화면(열린 창·가입 2단계·해지 2단계)도 같은 행렬로 찍는다 — 기본 화면만 찍으면 열린 창은 기준에 없다(REL11 §7).
      for (const step of steps[block] ?? []) for (const h of shot) for (const width of WIDTHS) for (const theme of THEMES) push({ recipe: h.id, role: null, width, theme, fx: 'default', step })
      continue
    }
    const pick = judgeRecipes(meta, recipes, fam.get(block))
    for (const role of ['primary', 'face', 'quiet']) {
      const recipe = pick[role]
      push({ recipe, role, width: 1440, theme: 'light', fx: 'default' })
      push({ recipe, role, width: 375, theme: 'light', fx: 'default' })
      push({ recipe, role, width: 375, theme: 'light', fx: 'max' })
      push({ recipe, role, width: 375, theme: 'light', fx: 'min' })
      if (role === 'face') push({ recipe, role, width: 1440, theme: 'dark', fx: 'default' })
    }
    if (isDataBlock(meta)) for (const s of READ_STATES.filter((x) => meta.states.includes(x))) push({ recipe: pick.primary, role: 'primary', width: 375, theme: 'light', fx: 'default', state: stateQuery(s) })
    for (const extra of extras[block] ?? []) push({ recipe: pick.primary, role: 'primary', width: 1440, theme: 'light', fx: 'default', extra })
    for (const step of steps[block] ?? []) push({ recipe: pick.primary, role: 'primary', width: 1440, theme: 'light', fx: 'default', step })
  }
  return jobs
}

// 크기 요약(보고용): 모드 행 수 · 레시피 3벌 판정 조합(같은 주소에서 run.mjs·ai-tell 을 한 번만 돌리는 단위) 수.
export function matrixSize(jobs) {
  return { rows: jobs.length, urls: new Set(jobs.map((j) => `${j.block}|${j.recipe}`)).size, blocks: new Set(jobs.map((j) => j.block)).size }
}

// ── 7상태 감사 행렬(Task 7a Step 3 — states.mjs) ─────────────────────────────────────────────────
// 데이터 블록(읽기 상태 넷): 상태마다 한 행 + 「loading → ready 전환」 한 행(&state=ready&delay=800 — CLS 를 잰다).
// 폼 블록(제출 결과 셋 + 있으면 pending): 결과마다 한 행. 레시피는 ①(primary)·375 라이트 — 좁은 화면이 가장 빠듯하다.
// 예시(`fixture`)에 상태가 없어도 메타 states 만 본다(상태 주입은 갤러리 states.ts 몫).
export const STATE_DELAY_MS = 800
export function stateJobs({ blocks, recipes }) {
  const jobs = []
  for (const b of blocks) {
    const meta = metaOf(b)
    if (!meta) continue
    const block = blockName(b.kind, b.variant)
    const recipe = judgeRecipes(meta, recipes).primary
    const push = (j) => {
      const job = { block, kind: b.kind, variant: b.variant, recipe, width: 375, theme: 'light', fx: 'default', ...j }
      job.url = jobPath({ ...job, extra: j.extra })
      job.id = [block, j.type, j.name].join('|')
      jobs.push(job)
    }
    if (isDataBlock(meta)) {
      for (const s of READ_STATES) push({ type: 'read', name: s, extra: stateQuery(s) })
      push({ type: 'cls', name: 'ready-delayed', extra: `${stateQuery('ready')}&delay=${STATE_DELAY_MS}` })
    }
    for (const s of (meta.states ?? []).filter((x) => x.startsWith('submit-'))) push({ type: 'submit', name: s.slice('submit-'.length), extra: stateQuery(s) })
  }
  return jobs
}
