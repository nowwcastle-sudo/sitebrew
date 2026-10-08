// 3D 오브젝트 칸의 재료(FV1 3D-GEN) — 3D 히어로(object-3d-orbit)는 **이미지에서 시작한다**: 원본 이미지(판매 대상은 실제 사진 · 상징 오브젝트는 생성 이미지) → 이미지-3D 변환 GLB → 화면은 표시만.
// 생성 이미지의 우선순위는 ① Higgsfield(HIGGSFIELD_DIR 의 파일 · 요청 파일) ② Codex CLI 이미지 생성(WF_CODEX_IMAGES=1 일 때만) ③ ChatGPT(사람이 수동으로 만들어 폴더에 둔다).
// 이 모듈은 (1) 03 이 쓰는 「이 사용자가 재료를 만들 수 있나」 판정, (2) 05 의 요청 줄 모양, (3) Codex CLI 비대화형 이미지 생성 래퍼를 담는다.
//
// Codex CLI 실측(2026-10-11, codex-cli 0.162.0, Windows): `codex exec --skip-git-repo-check --ephemeral --ignore-user-config -C <폴더> --sandbox read-only --json -o <끝 글 파일> "<프롬프트>"` 가
//   내장 이미지 생성 도구를 불러 1024² PNG 한 장을 만들었다(약 30초). 파일은 작업 폴더가 아니라 `~/.codex/generated_images/<thread_id>/exec-*.png` 에 저장된다 —
//   thread_id 는 `--json` 첫 줄 `{"type":"thread.started","thread_id":…}` 에서 읽는다(셸 복사는 샌드박스가 막는다). 사용자 설정(훅·플러그인·MCP)이 든 채로는 이 PC 에서 모델 연결이 시간 초과였다 —
//   `--ignore-user-config` 가 필요하다(로그인은 설정 파일이 아니라 따로 있어 그대로 쓰인다). 로그인이 없거나 이미지 생성이 꺼진 계정이면 실패한다.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { designRulesPath } from '../lib/design-rules.mjs'

export const OBJECT_HERO_BLOCK = 'block-hero-object-3d-orbit'
export const CODEX_TIMEOUT_MS = 300_000
export const GLB_BUDGET = 2 * 1024 * 1024

/** Codex 이미지 생성을 켜는 스위치. 켜지 않으면 Codex 는 부르지 않는다(비용·계정을 쓰는 길이라 명시적으로만). */
export const codexImagesEnabled = (env = process.env) => env.WF_CODEX_IMAGES === '1'

/** Higgsfield 원본 폴더(HIGGSFIELD_DIR → $WF_DESIGN_RULES_DIR/factory/media/higgsfield). 폴더가 실제로 있을 때만. */
export function higgsfieldDirOf(env = process.env, exists = existsSync) {
  const dir = env.HIGGSFIELD_DIR?.trim() || designRulesPath('factory/media/higgsfield', { env }) || null
  return dir && exists(dir) ? dir : null
}

/** codex 실행 파일이 있고 돈다(`codex --version`)? → 부울. 시험은 run 을 바꿔 끼운다. */
export function codexAvailable(run = defaultRun) {
  return run('codex', ['--version']).then((r) => r.code === 0, () => false)
}

function defaultRun(cmd, args, { timeoutMs = 15_000, cwd, input } = {}) {
  return new Promise((done) => {
    let out = ''
    const p = spawn(cmd, args, { shell: process.platform === 'win32', windowsHide: true, cwd, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'ignore'] })
    if (input != null) p.stdin.end(input) // 프롬프트는 인자가 아니라 표준 입력으로 넘긴다 — Windows 에서 codex 는 .cmd 껍데기라 셸을 거치고, 인자의 공백·따옴표가 깨진다
    const t = setTimeout(() => { try { p.kill() } catch { /* 이미 끝남 */ } done({ code: -2, out }) }, timeoutMs)
    p.stdout.on('data', (d) => { out += d })
    p.on('error', () => { clearTimeout(t); done({ code: -1, out }) })
    p.on('close', (code) => { clearTimeout(t); done({ code: code ?? -1, out }) })
  })
}

/**
 * 이 사용자가 3D 오브젝트 재료(원본 이미지)를 만들 길이 있는가 — 03 이 쓴다. { higgsfield, codex, any }.
 * 길이 하나도 없으면 any:false 이고 03 은 이 히어로를 고르지 않는다(다른 히어로가 있는 한).
 * 대표(사용자)가 실제 사진 파일을 직접 주는 길(content.media[칸].file)은 04 뒤에야 알 수 있어 여기서 세지 않는다 — 그 사용자는 HIGGSFIELD_DIR 에 원본을 두거나 Codex 를 켜면 된다.
 */
export async function objectMediaTools({ env = process.env, exists = existsSync, run } = {}) {
  const higgsfield = Boolean(higgsfieldDirOf(env, exists))
  const codex = codexImagesEnabled(env) && (await codexAvailable(run))
  return { higgsfield, codex, any: higgsfield || codex }
}

/** 03 의 readiness 표(Map<블록, 0|1|2>)에서 재료가 없을 때 3D 히어로를 「못 채움(2)」으로 바꾼 사본. 다른 변형이 있으면 03 이 고르지 않는다. */
export function applyObjectReadiness(readiness, tools, { archetype, sitemap } = {}) {
  const out = new Map(readiness)
  // 재료가 없으면 못 채운다. 그리고(FINAL-WF2 #20) 이 원형에서 3D 히어로를 허용하는 섹션 어디에도 이미지 칸(imageSlots)이 없으면 오브젝트 칸이 없어 재료가 있어도 못 채운다 —
  // portfolio 의 첫 화면(statement)은 이미지 칸이 없는데 3D 히어로를 골라 사진가 포트폴리오가 빈 틀이 됐다.
  if (out.has(OBJECT_HERO_BLOCK) && (!tools.any || (archetype && sitemap && !objectHeroHasImageSlot(archetype, sitemap)))) out.set(OBJECT_HERO_BLOCK, 2)
  return out
}

/** 사이트맵에서 3D 히어로를 허용하는 블록 섹션 중 이미지 칸(출처 none 아님)이 있는 것이 하나라도 있는가 — 허용하는 섹션이 아예 없으면 따질 것이 없어 true. */
export function objectHeroHasImageSlot(archetype, sitemap) {
  let allowedSomewhere = false
  for (const page of sitemap.pages ?? []) for (const s of page.sections ?? []) {
    if (s.status !== 'block' || !(s.allowedVariants ?? []).includes(OBJECT_HERO_BLOCK)) continue
    allowedSomewhere = true
    const spec = archetype.pages?.find((p) => p.id === page.id)?.sections?.find((x) => x.kind === s.kind)
    if ((spec?.imageSlots ?? []).some((i) => i.source !== 'none')) return true
  }
  return !allowedSomewhere
}

/** 05 의 요청 줄(higgsfield.request.json) — 이미지 생성 → generate_3d 두 줄. 이미지가 이미 있으면 generate_3d 한 줄. */
export function objectRequests({ slot, recipe, aspect, prompt, haveImage, imageFile }) {
  const image = { slot, recipe, aspect, step: 'image', tool: 'generate_image', prompt }
  const model = { slot, recipe, aspect, step: 'generate_3d', tool: 'generate_3d', from: imageFile ?? `${slot} 의 위 이미지`, note: '이미지-3D 변환 GLB 를 폴더에 두고 콘텐츠 media["<칸>"].higgsfieldModel 에 파일 이름을 적는다(PBR 재질 유지, 텍스처 1024 이하 권장)' }
  return haveImage ? [model] : [image, model]
}

/** 생성 이미지 프롬프트 기본값(콘텐츠 media[칸].prompt 가 없을 때). 배경은 단색 — 이미지-3D 변환기가 물체만 읽게 한다. */
export const defaultObjectPrompt = (query) => `Studio product photograph of a single ${query}, centered, whole object visible with generous margin, seamless plain light grey background, soft large softbox key light, soft contact shadow, three-quarter view slightly from above, no text, no props, no hands, photorealistic, sharp focus`

/** `codex exec --json` 출력 줄들에서 thread_id 를 읽는다(순수). */
export function threadIdOf(jsonl) {
  for (const line of String(jsonl).split(/\r?\n/)) {
    try {
      const e = JSON.parse(line)
      if (e?.type === 'thread.started' && typeof e.thread_id === 'string') return e.thread_id
    } catch { /* JSON 이 아닌 줄(로그)은 건너뛴다 */ }
  }
  return null
}

/** thread 폴더에서 가장 최근에 만들어진 이미지 파일(순수에 가까움: 파일 시스템만 읽는다). 없으면 null. */
export function generatedImageOf(threadId, { codexHome = process.env.CODEX_HOME || join(homedir(), '.codex') } = {}) {
  const dir = join(codexHome, 'generated_images', threadId)
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)
  return files.length ? join(dir, files[0].f) : null
}

/** Codex CLI 로 이미지 한 장을 만든다 → { file, threadId }. 실패하면 사유 문장으로 던진다(도구 실패:). run·codexHome 은 시험이 바꿔 끼운다. */
export async function codexImage({ prompt, workDir, run = defaultRun, codexHome, timeoutMs = CODEX_TIMEOUT_MS }) {
  mkdirSync(workDir, { recursive: true })
  const instruction = `Use your built-in image generation tool to create exactly ONE image for this brief, then stop. Do not write any files and do not run other tools. Brief: ${prompt}`
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--sandbox', 'read-only', '--json', '-']
  const r = await run('codex', args, { timeoutMs, cwd: workDir, input: instruction })
  if (r.code === -2) throw new Error(`도구 실패: codex exec 이 ${timeoutMs / 1000}초 안에 끝나지 않았다 — 로그인(codex login status)·네트워크를 확인한다`)
  const threadId = threadIdOf(r.out)
  if (!threadId) throw new Error(`도구 실패: codex exec 출력에서 thread_id 를 읽지 못했다(종료 ${r.code}) — codex 가 설치돼 있고 로그인돼 있는지 확인한다`)
  const file = generatedImageOf(threadId, { codexHome })
  if (!file) throw new Error(`도구 실패: codex exec(종료 ${r.code})가 이미지를 만들지 않았다 — 이 계정에서 이미지 생성(features.image_generation)이 켜져 있는지 확인한다`)
  return { file, threadId }
}
