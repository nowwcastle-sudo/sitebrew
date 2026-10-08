// 레시피 DNA 카드 겹침 검사. 사용: node docs/recipes/dna/check-unique.mjs
// 카드(<recipe-id>.md)를 읽어 사이트 URL·팔레트 id·1순위 라틴 디스플레이·1순위 한글 제목·히어로 수(제목과 본문)가
// 카드 사이에서 모두 서로 다를 때만 종료 코드 0. 함께 보는 것: 카드 10장·필수 절 6개, 레시피마다 사이트 2개와 국제 수상·큐레이션 출처 1개 이상,
// 팔레트가 references/palettes/palettes.json 에서 use "recipe", 모션 id가 §8-6 카탈로그(recipe.mjs DYNAMICS) 안, index.md 에 카드마다 한 줄.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(DIR, '..', '..', '..')
const RECIPES = readdirSync(join(ROOT, 'registry', 'factory', 'recipes')).filter((d) => /^r\d+-/.test(d)).sort()
const AWARD = ['awwwards', 'cssda', 'siteinspire', 'httpster', 'onepagelove', 'godly', 'lapaninja', 'saasframe']
const SECTIONS = ['출처', '팔레트', '서체', '히어로 배치 2수', '모션 1수', '복제하지 않는 것']
const CATALOG = ['split-text', 'oversize-crop', 'variable-axis', 'svg-draw', 'clip-reveal', 'tilt-3d', 'magnetic-cta', 'sticky-stack', 'marquee', 'mesh-gradient', 'grain', 'blend', 'view-transition']
const palettes = JSON.parse(readFileSync(join(ROOT, 'references', 'palettes', 'palettes.json'), 'utf8'))
const palList = Array.isArray(palettes) ? palettes : palettes.palettes ?? Object.values(palettes)

const problems = []
const norm = (s) => s.toLowerCase().replace(/[`*「」"'()\[\]·,.\s]+/g, ' ').trim()
const host = (u) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') } catch { return u } }
const section = (md, name) => md.match(new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'))?.[1] ?? null

const rows = []
for (const id of RECIPES) {
  const file = join(DIR, `${id}.md`)
  if (!existsSync(file)) { problems.push(`${id}: 카드 없음 (${id}.md)`); continue }
  const md = readFileSync(file, 'utf8')
  for (const s of SECTIONS) if (section(md, s) === null) problems.push(`${id}: 절 「## ${s}」 없음`)
  const src = section(md, '출처') ?? ''
  const sites = [...src.matchAll(/^- 사이트 \d+: (https?:\/\/\S+) · 출처 `([^`]+)`/gm)].map((m) => ({ url: m[1], source: m[2] }))
  if (sites.length !== 2) problems.push(`${id}: 사이트 ${sites.length}개 — 2개여야 한다`)
  if (!sites.some((s) => AWARD.includes(s.source))) problems.push(`${id}: 국제 수상·큐레이션 출처(${AWARD.join('·')}) 사이트가 없다`)
  const pal = src.match(/^- 팔레트: `([^`]+)`/m)?.[1]
  if (!pal) problems.push(`${id}: 팔레트 id 없음`)
  else { const p = palList.find((x) => x.id === pal); if (!p) problems.push(`${id}: 팔레트 ${pal} 가 palettes.json 에 없다`); else if (p.use !== 'recipe') problems.push(`${id}: 팔레트 ${pal} 는 use "${p.use}"`) }
  const font = section(md, '서체') ?? ''
  const latin = font.match(/^- 1순위 라틴 디스플레이: \*\*(.+?)\*\*/m)?.[1]
  const korean = font.match(/^- 1순위 한글 제목: \*\*(.+?)\*\*/m)?.[1]
  if (!latin) problems.push(`${id}: 1순위 라틴 디스플레이 없음`)
  if (!korean) problems.push(`${id}: 1순위 한글 제목 없음`)
  const hero = section(md, '히어로 배치 2수') ?? ''
  // 제목 끝의 「(사이트 N)」은 그 수의 구조를 가져온 사이트 표시다(보드 출처 분류가 읽는다) — 제목 비교에서는 뗀다.
  const moves = [...hero.matchAll(/^### 수 \d+ — (.+?)(?: \(사이트 \d\))?$([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((m) => ({ title: m[1].trim(), body: m[2].trim() }))
  if (moves.length !== 2) problems.push(`${id}: 히어로 수 ${moves.length}개 — 2개여야 한다`)
  for (const m of moves) if (m.body.length < 80) problems.push(`${id}: 히어로 수 「${m.title}」 본문이 너무 짧다(${m.body.length}자)`)
  const motion = (section(md, '모션 1수') ?? '').match(/^- 카탈로그 id: `([^`]+)`/m)?.[1]
  if (!motion) problems.push(`${id}: 모션 카탈로그 id 없음`)
  else if (!CATALOG.includes(motion)) problems.push(`${id}: 모션 id ${motion} 는 §8-6 카탈로그 밖`)
  rows.push({ id, sites, pal, latin, korean, moves, motion })
}

const dupes = (label, pairs) => {
  const seen = new Map()
  for (const [owner, key, shown] of pairs) {
    if (!key) continue
    if (seen.has(key)) problems.push(`겹침 ${label}: ${shown} — ${seen.get(key)} · ${owner}`)
    else seen.set(key, owner)
  }
  return seen.size
}
const nSites = dupes('사이트', rows.flatMap((r) => r.sites.map((s) => [r.id, host(s.url), s.url])))
const nPal = dupes('팔레트', rows.map((r) => [r.id, r.pal, r.pal]))
const nLatin = dupes('1순위 라틴 디스플레이', rows.map((r) => [r.id, r.latin && norm(r.latin), r.latin]))
const nKorean = dupes('1순위 한글 제목', rows.map((r) => [r.id, r.korean && norm(r.korean), r.korean]))
const nTitles = dupes('히어로 수 제목', rows.flatMap((r) => r.moves.map((m, i) => [`${r.id} 수 ${i + 1}`, norm(m.title), m.title])))
dupes('히어로 수 본문', rows.flatMap((r) => r.moves.map((m, i) => [`${r.id} 수 ${i + 1}`, norm(m.body), m.title])))

const indexFile = join(DIR, 'index.md')
if (!existsSync(indexFile)) problems.push('index.md 없음')
else {
  const idx = readFileSync(indexFile, 'utf8')
  for (const r of rows) {
    const line = idx.split(/\r?\n/).find((l) => l.startsWith(`| [${r.id}]`))
    if (!line) { problems.push(`index.md: ${r.id} 줄 없음`); continue }
    for (const want of [...r.sites.map((s) => s.url), r.pal, r.latin, r.korean, ...r.moves.map((m) => m.title), r.motion]) if (want && !line.includes(want)) problems.push(`index.md: ${r.id} 줄에 「${want}」 없음(카드와 다르다)`)
  }
}

const motions = rows.map((r) => r.motion).filter(Boolean)
const shared = [...new Set(motions.filter((m, i) => motions.indexOf(m) !== i))]
console.log(`카드 ${rows.length}/${RECIPES.length} · 사이트 ${nSites}(서로 다름) · 팔레트 ${nPal} · 라틴 1순위 ${nLatin} · 한글 1순위 ${nKorean} · 히어로 수 ${nTitles}`)
console.log(`모션 id(겹침 허용, 참고): ${rows.map((r) => `${r.id}=${r.motion}`).join(' ')}${shared.length ? ` — 둘 이상 쓰는 id: ${shared.join(', ')}` : ''}`)
if (problems.length) { for (const p of problems) console.log('FAIL ' + p); console.log(`문제 ${problems.length}건`); process.exit(1) }
console.log('PASS 사이트·팔레트 id·1순위 서체·히어로 수가 모두 서로 다르다')
process.exit(0)
