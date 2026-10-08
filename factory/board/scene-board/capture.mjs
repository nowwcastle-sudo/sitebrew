// 장면 보드(보드 A2) 촬영: node factory/board/scene-board/capture.mjs [origin=$WF_SCENE_ORIGIN|http://localhost:3000] [--only <id,id>] [--limit <N>] [--out <폴더>]
// recipe-board/video.mjs 의 captureAll(8초 영상 MP4 H.264 + WebM VP9, 정지 1440·375, 동작 줄이기 검사)을 **그대로** 불러 jobs.mjs 의 장면마다 찍는다.
// 크기 한도도 보드 v2 와 같다(video.mjs 의 VIDEO_MAX 파일 ≤ 4MB · TOTAL_MAX 합 ≤ 60MB — checkManifest 가 본다).
// 결과: .tmp/scene-board/ 에 <id>.mp4 · <id>.webm · <id>-1440.webp · <id>-375.webp + manifest.json. Chrome 은 captureAll 이 끝나면 트리째 정리한다(cdp.mjs close()).
// 서버: `npm run build` 뒤 `npm start`(또는 next start -p <포트>) — 레시피 초안은 draft-preview.mjs 로 준비한 폴더의 서버여야 갤러리에 뜬다.
//   --only / --limit 는 일부만 다시 찍는다(스모크) — 옛 목록의 다른 장면 줄은 이어 쓴다. 전체 실행은 시작할 때 옛 목록을 지운다(도중에 실패하면 build 가 옛 목록으로 보드를 만들지 않게).
// 종료: 0 = 모두 찍었고 목록 검사 통과, 1 = 도구 실패(「도구 실패:」) 또는 검사 문제.
import { writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { captureAll, manifestOf, checkManifest, VIDEO_MAX, TOTAL_MAX } from '../recipe-board/video.mjs'
import { sceneJobs, checkJobs, ROOT } from './jobs.mjs'

export const OUT = join(ROOT, '.tmp', 'scene-board')
export const BUDGET = { videoMaxBytes: VIDEO_MAX, totalMaxBytes: TOTAL_MAX }
// captureAll 이 히어로 칸이 붙은 시각을 재는 선택자 — 블록 장면(data-block)과 레시피 초안 장면(article[data-scene]) 둘 다.
export const HERO_SEL = 'article[data-scene], [data-block]'
export const filesOf = (id) => ({ video: `${id}.webm`, mp4: `${id}.mp4`, 1440: `${id}-1440.webp`, 375: `${id}-375.webp` })

/** jobs.mjs 의 장면 → captureAll 작업(문서 id 를 recipe 칸에, 선택지는 A 하나). url 은 origin + 장면 주소. */
export const captureJobs = (jobs, origin) => jobs.map((j) => ({
  recipe: j.id, option: 'A', theme: j.theme, query: '', hero: null, displayKo: j.displayKo,
  url: `${origin.replace(/\/$/, '')}${j.path}`, sel: j.sel, files: filesOf(j.id),
}))

/** --only(문서 id 목록) · --limit(앞에서 N개). 모르는 id 는 던진다. */
export function pickJobs(jobs, { only = null, limit = null } = {}) {
  if (only) {
    const unknown = only.filter((id) => !jobs.some((j) => j.id === id))
    if (unknown.length) throw new Error(`목록에 없는 장면: ${unknown.join(', ')}`)
  }
  const picked = jobs.filter((j) => !only || only.includes(j.id))
  return limit ? picked.slice(0, limit) : picked
}

export async function captureScenes(jobs, { origin, out = OUT, log = console } = {}) {
  return captureAll(captureJobs(jobs, origin), { origin, out, log, heroSel: HERO_SEL })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null }
  const only = flag('--only')?.split(',').filter(Boolean) ?? null
  const limit = Number(flag('--limit')) || null
  const outDir = flag('--out') ?? OUT
  const origin = (argv[0] ?? process.env.WF_SCENE_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '')
  const mf = join(outDir, 'manifest.json')
  let code = 0
  try {
    const all = sceneJobs()
    const bad = checkJobs(all)
    if (bad.length) throw new Error(`목록 문제: ${bad.join(' · ')}`)
    const jobs = pickJobs(all, { only, limit })
    const partial = jobs.length !== all.length
    const previous = partial && existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : null
    rmSync(mf, { force: true })
    const got = await captureScenes(jobs, { origin, out: outDir })
    const order = all.map((j) => j.id)
    const kept = previous ? previous.options.filter((o) => order.includes(o.recipe) && !jobs.some((j) => j.id === o.recipe)) : []
    const options = [...kept, ...got].sort((a, b) => order.indexOf(a.recipe) - order.indexOf(b.recipe))
    let commit = null
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT }).toString().trim()) commit += '+dirty' } catch {}
    const m = manifestOf({ origin, commit, options })
    writeFileSync(mf, JSON.stringify(m, null, 2) + '\n')
    const problems = checkManifest(m, { expectOptions: partial ? options.length : all.length })
    console.log(`scene-board: 장면 ${got.length}개 촬영(목록 ${options.length}/${all.length}) · 파일 ${m.count}개 · ${m.totalMB}MB(mp4 ${m.byKind.mp4} · webm ${m.byKind.webm} · webp ${m.byKind.webp}) · 영상 최대 ${m.maxVideoMB}MB · 동작 줄이기 멈춤 ${m.reducedMotion.still}/${m.reducedMotion.checked} → ${outDir}`)
    for (const p of problems) console.error(`문제: ${p}`)
    if (problems.length) code = 1
  } catch (e) {
    console.error(`도구 실패: ${e.message}`)
    rmSync(mf, { force: true })
    code = 1
  }
  process.exit(code)
}
