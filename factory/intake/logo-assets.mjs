// 로고 시안의 재료 읽기(v0.2.6 T14) — 서체 파일 찾기와 Codex 기호 그림 손질. 파일·sharp 만 쓰고 Chrome 은 부르지 않는다.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const KIT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const PRETENDARD = (weight) => join(KIT_ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static', `Pretendard-${weight}.otf`)
export const FONT_FORMAT = { '.otf': ['font/otf', 'opentype'], '.woff2': ['font/woff2', 'woff2'] }
const MAX_EXTRA_FONTS = 2

/** 서체 파일 → HTML @font-face 에 넣는 data URL. 파일이 없으면 무엇을 하면 되는지 알려 주며 던진다. */
export function fontDataUrl(file, mime = FONT_FORMAT[extname(file).toLowerCase()]?.[0] ?? 'font/otf') {
  if (!existsSync(file)) throw new Error(`도구 실패: 서체 파일이 없다 — ${file} (저장소 루트에서 npm ci 를 먼저 돈다)`)
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}

/** WF_LOGO_FONT_DIR 의 서체 파일 중 브랜드 서체 이름에 맞는 것(최대 둘). 이름이 하나도 없으면 폴더 앞의 둘. 폴더가 없으면 빈 목록. */
export function extraFontFiles(dir, fonts = [], max = MAX_EXTRA_FONTS) {
  if (!dir || !existsSync(dir)) return []
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  const names = fonts.map(norm).filter(Boolean)
  const files = readdirSync(dir).filter((f) => extname(f).toLowerCase() in FONT_FORMAT).sort()
  const hit = names.length ? files.filter((f) => names.some((n) => norm(basename(f, extname(f))).includes(n))) : files
  return hit.slice(0, max).map((f) => join(dir, f))
}

/** Codex 가 만든 기호 그림의 흰 바탕을 투명으로 바꾼다 — 흰 네모가 로고에 남지 않게. 거의 흰색은 완전 투명, 중간 톤은 비례해서 반투명. */
export async function whiteToAlpha(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const lightest = Math.min(data[i], data[i + 1], data[i + 2])
    const keep = lightest >= 245 ? 0 : lightest <= 215 ? 255 : Math.round(((245 - lightest) / 30) * 255)
    data[i + 3] = Math.min(data[i + 3], keep)
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}
