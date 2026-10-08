// 레시피 초안 갤러리 준비(보드 A2 — 임시): node factory/board/scene-board/draft-preview.mjs <작업 폴더>
// 초안(r12~r16)은 「## 운영자 확인 전」 절이 있어 gen:all 이 건너뛰므로 갤러리(/qa/recipes)에 없다. 보드에서 보이려면 어디선가 그 절을 지우고 gen:all 을 돌려야 한다.
// 그 자리를 **저장소 기본 작업 폴더도, 이 도구가 들어 있는 작업 폴더도 아닌 별도 폴더**(커밋하지 않는 보드 전용 git worktree)로 못 박는다:
//   · 그 폴더 안에서만 초안 DESIGN.md 의 절을 지우고, 그 폴더에서 npm run gen:all · npm run qa:recipes 를 돌린다. 그 폴더에 커밋하지 않는다(git 을 부르지 않는다).
//   · 거절: 저장소 기본 작업 폴더(<sitebrew checkout>) · 이 레인 worktree(<worktree>) · 이 파일이 들어 있는 작업 폴더 · .git 이 폴더인 체크아웃(= 기본 작업 폴더) ·
//     git worktree 가 아닌 폴더 · 레시피 폴더가 없는 곳. 거절은 파일을 건드리기 전에 한다.
//   · gen:all 이 실패해도(확정하면 qa:distinct 의 히어로 고유 검사가 실패할 수 있다) qa:recipes 는 돈다 — 컴파일 산출물이 있으면 갤러리는 뜬다. 둘 중 하나라도 실패면 종료 1.
// 이 폴더에서 npm run build → next start 로 서버를 띄운 뒤 촬영(capture.mjs <origin>)은 부모가 한다.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { isUnconfirmed, recipeIds } from '../../scripts/recipe.mjs'
import { ROOT, inDraftRange, DRAFT_RANGE } from './jobs.mjs'

export const BASE_CHECKOUT = '<sitebrew checkout>'
export const LANE_WORKTREE = '<worktree>'
const norm = (p) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

/** 절(「## 운영자 확인 전」 제목 줄부터 다음 `## ` 제목 앞까지, 없으면 끝까지)을 지운다. 줄바꿈 방식을 지키고, 절이 없으면 그대로 돌려준다. */
export function stripUnconfirmedSection(md) {
  const text = String(md)
  if (!isUnconfirmed(text)) return text
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##[ \t]+운영자 확인 전[ \t]*$/.test(l))
  let end = lines.findIndex((l, i) => i > start && /^##[ \t]/.test(l))
  if (end < 0) end = lines.length
  const head = lines.slice(0, start)
  while (head.length && head.at(-1).trim() === '') head.pop()
  const tail = lines.slice(end)
  while (tail.length && tail.at(-1).trim() === '') tail.pop()
  return [...head, ...(tail.length ? ['', ...tail] : [])].join(eol) + eol
}

/** 이 폴더를 준비 대상으로 쓸 수 없는 까닭 목록(빈 목록 = 쓸 수 있다). 앞의 둘은 파일 시스템을 보지 않고 경로만 본다. */
export function previewDirProblems(dir, { root = ROOT } = {}) {
  const p = []
  const d = norm(dir)
  if (d === norm(BASE_CHECKOUT)) p.push(`저장소 기본 작업 폴더(${BASE_CHECKOUT})에서는 하지 않는다`)
  if (d === norm(LANE_WORKTREE)) p.push(`이 레인 worktree(${LANE_WORKTREE})에서는 하지 않는다`)
  if (d === norm(root)) p.push('이 스크립트가 있는 작업 폴더에서는 하지 않는다 — 다른 작업 폴더를 대상으로 준다')
  if (p.length) return p
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`폴더가 없다: ${dir}`]
  const git = join(dir, '.git')
  if (!existsSync(git)) p.push('git worktree 가 아니다(.git 이 없다) — 보드 전용 worktree 를 만들어 준다')
  else if (statSync(git).isDirectory()) p.push('.git 이 폴더다 — 저장소 기본 작업 폴더(체크아웃)로 보여 하지 않는다')
  if (!existsSync(join(dir, 'registry', 'factory', 'recipes'))) p.push('레시피 폴더(registry/factory/recipes)가 없다')
  return p
}

const defaultRun = (cmd, args, opts) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })

/**
 * 준비: 거절 검사 → 그 폴더의 초안 절 삭제(r12~r16 범위만) → npm run gen:all → npm run qa:recipes.
 * 거절이면 던진다(아무것도 부르지 않는다). 돌려주는 값 { dir, stripped, runs: [{ args, status }], ok }.
 */
export async function previewDrafts({ dir, root = ROOT, ids = null, run = defaultRun, range = DRAFT_RANGE } = {}) {
  const problems = previewDirProblems(dir, { root })
  if (problems.length) throw new Error(`거절: ${problems.join(' · ')}`)
  const abs = resolve(dir)
  const recipes = join(abs, 'registry', 'factory', 'recipes')
  const open = readdirSync(recipes, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(recipes, e.name, 'DESIGN.md')) && isUnconfirmed(readFileSync(join(recipes, e.name, 'DESIGN.md'), 'utf8')))
    .map((e) => e.name).sort().filter((id) => inDraftRange(id, range) && (!ids || ids.includes(id)))
  const stripped = []
  for (const id of open) {
    const f = join(abs, 'registry', 'factory', 'recipes', id, 'DESIGN.md')
    writeFileSync(f, stripUnconfirmedSection(readFileSync(f, 'utf8')))
    stripped.push(id)
  }
  const runs = []
  for (const args of [['run', 'gen:all'], ['run', 'qa:recipes']]) {
    const r = run('npm', args, { cwd: abs })
    runs.push({ args, status: r.status ?? 1 })
  }
  const inRange = recipeIds(abs).filter((id) => inDraftRange(id, range))
  return { dir: abs, stripped, inRange, runs, ok: runs.every((r) => r.status === 0) }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const [dir, idsArg] = process.argv.slice(2)
  if (!dir) { console.error('사용: node factory/board/scene-board/draft-preview.mjs <보드 전용 worktree 폴더> [r12-…,r13-…]'); process.exit(2) }
  try {
    const res = await previewDrafts({ dir, ids: idsArg ? idsArg.split(',') : null })
    console.log(`초안 준비: ${res.dir} — 절을 지운 초안 ${res.stripped.length}벌(${res.stripped.join(', ') || '없음'}) · gen:all ${res.runs[0].status} · qa:recipes ${res.runs[1].status}`)
    if (!res.stripped.length) console.error('문제: 지울 초안이 없다(이미 지웠거나 범위 안에 초안이 없다)')
    process.exit(res.ok && (res.stripped.length || res.inRange.length) ? 0 : 1)
  } catch (e) {
    console.error(String(e.message).startsWith('거절') ? e.message : `도구 실패: ${e.message}`)
    process.exit(1)
  }
}
