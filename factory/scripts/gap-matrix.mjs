#!/usr/bin/env node
// 빈틈 표(레퍼런스 쪽) 생성기 — factory v1 Task 2.3 (합의안 D10~D12).
//   레퍼런스 카드(저장소 밖 REFCARDS_DIR) × 현재 공장 인벤토리(블록 메타·레시피 머리·모션 키트·효과 카드·스타일·축·부품)를 맞대어
//   「카드에 자주 나오는데 공장에 없는 것」을 원형·종류별로 센다. SNS 쪽 빈틈 행(docs/qa/factory-v1/gap-sns.json)은 source "sns" 로 합친다.
//   패턴 추출은 결정적이다(factory/scripts/lib/gap-patterns.mjs 의 키워드 정규화 표). 날짜·경로·난수가 출력에 없다.
//   사용:
//     node factory/scripts/gap-matrix.mjs --write [--cards <폴더>] [--sns <파일>] [--inventory <저장소 루트>] [--out <폴더>]
//     node factory/scripts/gap-matrix.mjs --check   (다시 만들어 메모리에서 견준다 — 다르면 1, 카드 폴더가 없으면 건너뛰고 0)
//   종료 코드: 0 성공(또는 카드 폴더 없음으로 건너뜀) · 1 다름/쓰기 실패 · 2 사용법.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { CODE_NAMESPACES, PATTERNS, extractPatterns, isMisfit } from './lib/gap-patterns.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DEFAULT_CARDS_DIR = 'design-rules/factory/refs-v2/cards'
export const MIN_CARDS = 3
export const MIN_BOLD_CARDS = 2
const OUT_DIR = join(ROOT, 'docs', 'qa', 'factory-v1')
const REGEN = 'node factory/scripts/gap-matrix.mjs --write'
const COVERAGE_RANK = { no: 0, partial: 1, yes: 2 }
const SOURCE_RANK = { refs: 0, sns: 1 }

const lc = (s) => String(s).toLowerCase()
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const listFiles = (dir, ok) => (existsSync(dir) ? readdirSync(dir).filter(ok).sort() : [])
const listDirs = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [])

// ── 입력 읽기 ──────────────────────────────────────────────────────────────
/** 카드 폴더 → { cards(id 순), skipped[{file, reason}] }. 읽을 수 없는 파일은 이유와 함께 건너뛴다. */
export function loadCards(dir) {
  const cards = []
  const skipped = []
  for (const f of listFiles(dir, (n) => n.endsWith('.json'))) {
    try {
      const c = readJson(join(dir, f))
      if (!c || typeof c !== 'object' || typeof c.id !== 'string') skipped.push({ file: f, reason: 'id 문자열이 없다' })
      else cards.push(c)
    } catch (e) { skipped.push({ file: f, reason: `JSON 을 읽을 수 없다: ${e.message}`.slice(0, 200) }) }
  }
  cards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return { cards, skipped }
}

export function loadSns(file) {
  const rows = readJson(file)
  if (!Array.isArray(rows)) throw new Error(`SNS 빈틈 표가 배열이 아니다: ${file}`)
  return rows
}

// `export const NAME = { … }` 한 덩어리(여는 줄 ~ 첫 줄 맨 앞 `}`)의 2칸 들여쓴 키 이름.
function objectKeys(src, name) {
  const lines = src.split(/\r?\n/)
  const start = lines.findIndex((l) => l.startsWith(`export const ${name} = {`))
  if (start < 0) return []
  const keys = []
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('}'); i++) {
    const m = lines[i].match(/^ {2}(?:"([^"]+)"|([A-Za-z_]\w*))\s*:/)
    if (m) keys.push(m[1] ?? m[2])
  }
  return keys
}

function frontMatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  return m ? { head: parseYaml(m[1]) ?? {}, body: m[2] } : null
}

/** 공장 인벤토리(저장소 루트 기준) → { tokens:Set<소문자 토큰>, counts }. 없는 폴더는 비어 있는 것으로 읽는다. */
export function loadInventory(root) {
  const tokens = new Set()
  const add = (t) => tokens.add(lc(t))
  const counts = { blocks: 0, recipes: 0, techs: 0, eases: 0, effectCards: 0, styles: 0, ui: 0 }

  // 블록 메타 — kind·variant·layout·media·motion
  const blocksDir = join(root, 'registry', 'factory', 'blocks')
  for (const kind of listDirs(blocksDir).filter((d) => !d.startsWith('_'))) {
    for (const f of listFiles(join(blocksDir, kind), (n) => n.endsWith('.block.json'))) {
      const m = readJson(join(blocksDir, kind, f))
      counts.blocks++
      add(`block:kind:${m.kind ?? kind}`)
      add(`block:variant:${m.kind ?? kind}/${m.variant}`)
      if (m.layout) add(`block:layout:${m.layout}`)
      for (const v of m.media ?? []) add(`block:media:${v}`)
      for (const v of m.motion ?? []) add(`block:motion:${v}`)
    }
  }

  // 레시피 머리 — 색 논리·역동성·모션 단계·히어로·시그니처·축 (「운영자 확인 전」 절이 있는 초안은 공장이 건너뛰므로 같게 건너뛴다)
  const recipesDir = join(root, 'registry', 'factory', 'recipes')
  for (const id of listDirs(recipesDir)) {
    const file = join(recipesDir, id, 'DESIGN.md')
    if (!existsSync(file)) continue
    const fm = frontMatter(readFileSync(file, 'utf8'))
    if (!fm || /^## 운영자 확인 전/m.test(fm.body)) continue
    const h = fm.head
    const alt = h.alternates ?? {}
    counts.recipes++
    for (const c of [h.colorLogic, alt.colorLogic]) if (c) add(`recipe:color:${c}`)
    for (const d of [...(h.dynamics ?? []), ...(alt.dynamics ?? [])]) add(`recipe:dynamics:${d}`)
    for (const mo of [h.motion, alt.motion]) if (mo) add(`recipe:motion:${mo}`)
    for (const hero of [h.hero, alt.hero]) if (hero) add(`recipe:hero:${hero}`)
    for (const s of h.signature ?? []) add(`recipe:signature:${s}`)
    for (const [axis, value] of Object.entries(h.axes ?? {})) add(`recipe:axes:${axis}:${value}`)
  }

  // 모션 키트 — EASES·TECH 이름
  const scale = join(root, 'registry', 'factory', 'motion', 'motion-scale.ts')
  if (existsSync(scale)) {
    const src = readFileSync(scale, 'utf8')
    const techs = objectKeys(src, 'TECH')
    const eases = objectKeys(src, 'EASES')
    counts.techs = techs.length
    counts.eases = eases.length
    for (const t of techs) add(`motion:tech:${t}`)
    for (const e of eases) add(`motion:ease:${e}`)
  }

  // 효과 카드(조사 카드 — 구현이 아니라 문서)
  const effects = join(root, 'references', 'motion', 'effects.json')
  if (existsSync(effects)) {
    const list = readJson(effects).effects ?? []
    counts.effectCards = list.length
    for (const e of list) add(`card:${e.id}`)
  }

  // 스타일 사전 — 금지(ban)가 아닌 것만
  const stylesFile = join(root, 'references', 'styles', 'styles.json')
  if (existsSync(stylesFile)) {
    for (const s of readJson(stylesFile).styles ?? []) {
      if (s.verdict === 'ban') continue
      counts.styles++
      add(`style:${s.id}`)
      for (const c of String(s.recipeFields?.colorLogic ?? '').split(',')) if (c.trim()) add(`style:color:${c.trim()}`)
    }
  }

  // 스타일 축 값 — axes/<축>/<값>-<이름>.css
  const axesDir = join(root, 'registry', 'factory', 'styles', 'axes')
  for (const axis of listDirs(axesDir)) {
    for (const f of listFiles(join(axesDir, axis), (n) => n.endsWith('.css'))) {
      const m = f.match(/^([a-z]+\d+)-/i)
      if (m) add(`axis:${axis}:${m[1]}`)
    }
  }

  // ui 부품
  for (const f of listFiles(join(root, 'registry', 'factory', 'ui-src'), (n) => n.endsWith('.tsx'))) {
    counts.ui++
    add(`ui:${basename(f, '.tsx')}`)
  }
  return { tokens, counts }
}

// ── 대조 ───────────────────────────────────────────────────────────────────
const isCode = (t) => CODE_NAMESPACES.includes(t.split(':')[0])

/** 패턴 하나의 공장 보유 판정 → { coverage, evidence[] } */
function coverageOf(p, tokens) {
  const hitC = p.covers.filter((t) => tokens.has(t))
  const hitN = p.near.filter((t) => tokens.has(t))
  if (hitC.some(isCode)) return { coverage: 'yes', evidence: hitC }
  if (hitC.length) return { coverage: 'partial', evidence: hitC }
  if (hitN.length) return { coverage: 'partial', evidence: hitN }
  const looked = [...p.covers, ...p.near]
  return { coverage: 'no', evidence: [looked.length ? `없음: ${looked.join(', ')}` : '없음: 맞대 볼 기존 항목이 없는 새 기법'] }
}

const byCountThenName = (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

function refsRow(p, hit, tokens, minBold) {
  const { coverage, evidence } = coverageOf(p, tokens)
  const cards = hit.ids.length
  const proposal = coverage === 'yes'
    ? { kind: 'doc', summary: `이미 있음 — 빈틈 아님 (${evidence.slice(0, 3).join(', ')})`.slice(0, 240) }
    : { kind: p.proposal.kind, summary: p.proposal.summary }
  return {
    id: `refs:${p.id}`,
    source: 'refs',
    archetypes: [...hit.arch.entries()].sort(byCountThenName).map(([a]) => a),
    pattern: p.label,
    evidence: { cards, boldCards: hit.bold, cardIds: [...hit.ids].sort(), sns: { mentions: 0 } },
    factoryCoverage: coverage,
    coverageEvidence: evidence,
    proposal,
    bold: hit.bold >= minBold && hit.bold * 2 >= cards,
    goldenImpact: coverage !== 'yes' && ['block', 'recipe'].includes(proposal.kind),
  }
}

function snsRow(r) {
  return {
    id: `sns:${r.id}`,
    source: 'sns',
    archetypes: [...(r.archetypes ?? [])],
    pattern: r.theme,
    evidence: { cards: 0, boldCards: 0, cardIds: [], sns: { mentions: r.evidence?.mentions ?? 0 } },
    factoryCoverage: r.coverage,
    coverageEvidence: [...r.coverageEvidence],
    proposal: { kind: r.proposal.kind, summary: r.proposal.summary },
    bold: false,
    goldenImpact: Boolean(r.goldenImpact),
  }
}

const weight = (r) => (r.source === 'refs' ? r.evidence.cards : r.evidence.sns.mentions)
const compareRows = (a, b) =>
  COVERAGE_RANK[a.factoryCoverage] - COVERAGE_RANK[b.factoryCoverage]
  || SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
  || Number(b.bold) - Number(a.bold)
  || weight(b) - weight(a)
  || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** 빈틈 행(공장에 없거나 일부만 있는 것). */
export const gapRows = (rows) => rows.filter((r) => r.factoryCoverage !== 'yes')

/**
 * 행렬을 만든다. 순수 — 입력을 바꾸지 않고, 같은 입력은 입력 순서와 상관없이 같은 출력을 낸다.
 * 카드 패턴은 적합도 미달(isMisfit) 카드를 뺀 카드 3장 이상(또는 대담안 2장 이상)에 나올 때 행이 된다.
 */
export function buildGapMatrix({ cards, sns = [], inventory, minCards = MIN_CARDS, minBoldCards = MIN_BOLD_CARDS }) {
  const used = cards.filter((c) => !isMisfit(c))
  const hits = new Map()
  for (const card of used) {
    for (const pid of extractPatterns(card)) {
      if (!hits.has(pid)) hits.set(pid, { ids: [], bold: 0, arch: new Map() })
      const h = hits.get(pid)
      h.ids.push(card.id)
      if (card.boldness === 'bold') h.bold++
      h.arch.set(card.archetype, (h.arch.get(card.archetype) ?? 0) + 1)
    }
  }
  const rows = []
  for (const p of PATTERNS) {
    const hit = hits.get(p.id)
    if (hit && (hit.ids.length >= minCards || hit.bold >= minBoldCards)) rows.push(refsRow(p, hit, inventory.tokens, minBoldCards))
  }
  for (const r of sns) rows.push(snsRow(r))
  rows.sort(compareRows)
  return {
    meta: {
      generator: REGEN,
      thresholds: { minCards, minBoldCards },
      cards: { total: cards.length, used: used.length, misfit: cards.length - used.length },
      inventory: { ...inventory.counts },
      patterns: PATTERNS.length,
      snsRows: sns.length,
    },
    rows,
  }
}

/** 빈틈 행의 원형별·제안 종류별 개수(미리보기·요약 표). */
export function summarize(rows) {
  const gaps = gapRows(rows)
  const tally = (get) => {
    const m = {}
    for (const r of gaps) for (const k of get(r)) m[k] = (m[k] ?? 0) + 1
    return Object.fromEntries(Object.entries(m).sort(byCountThenName))
  }
  return {
    rows: rows.length,
    gaps: gaps.length,
    byCoverage: Object.fromEntries(['no', 'partial', 'yes'].map((c) => [c, rows.filter((r) => r.factoryCoverage === c).length])),
    bySource: Object.fromEntries(['refs', 'sns'].map((s) => [s, rows.filter((r) => r.source === s).length])),
    byArchetype: tally((r) => r.archetypes),
    byProposalKind: tally((r) => [r.proposal.kind]),
    bold: gaps.filter((r) => r.bold).length,
    goldenImpact: gaps.filter((r) => r.goldenImpact).length,
  }
}

// ── 출력 ───────────────────────────────────────────────────────────────────
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function evidenceCell(r) {
  if (r.source === 'sns') return `SNS 언급 ${r.evidence.sns.mentions.toLocaleString('en-US')}`
  const ids = r.evidence.cardIds
  const shown = ids.slice(0, 4).map((i) => `\`${i}\``).join(' ')
  return `카드 ${r.evidence.cards}${r.evidence.boldCards ? `(대담 ${r.evidence.boldCards})` : ''} · ${shown}${ids.length > 4 ? ` 외 ${ids.length - 4}` : ''}`
}

const tableHead = '| 행 | 빈틈 | 근거 | 원형 | 공장 | 제안 | 대담안 | 골든 영향 |\n|---|---|---|---|---|---|---|---|'
const tableRow = (r) =>
  `| \`${r.id}\` | ${cell(r.pattern)} | ${cell(evidenceCell(r))} | ${cell(r.archetypes.join(', '))} | ${r.factoryCoverage} · ${cell(clip(r.coverageEvidence.join(', '), 70))} | ${r.proposal.kind}: ${cell(clip(r.proposal.summary, 110))} | ${r.bold ? '예' : '-'} | ${r.goldenImpact ? '예' : '-'} |`

export function renderMarkdown(matrix) {
  const { meta, rows } = matrix
  const s = summarize(rows)
  const gaps = gapRows(rows)
  const have = rows.filter((r) => r.factoryCoverage === 'yes')
  const kv = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'
  const out = [
    `<!-- 생성물 — ${REGEN} 로 다시 만든다(검사: --check). 손으로 고치지 않는다. -->`,
    '',
    '# 빈틈 표 — 레퍼런스 카드 × 현재 공장 (+ SNS 빈틈)',
    '',
    `다시 만들기: \`${REGEN}\` · 어긋남 검사: \`node factory/scripts/gap-matrix.mjs --check\`. 카드 폴더는 환경 변수 \`REFCARDS_DIR\`(기본 \`${DEFAULT_CARDS_DIR}\`), SNS 빈틈은 \`docs/qa/factory-v1/gap-sns.json\`.`,
    '',
    '## 읽는 법',
    '',
    `- **빈틈**: 적합도 미달 카드를 뺀 카드 ${meta.thresholds.minCards}장 이상(또는 대담안 카드 ${meta.thresholds.minBoldCards}장 이상)에 나오는 패턴 중 공장 인벤토리(블록 메타·레시피 머리·모션 키트·효과 카드·스타일 사전·축 값·부품)에 맞는 항목이 없는 것(\`no\`)·조사 카드나 스타일 사전에만 있는 것(\`partial\`). SNS 행은 \`gap-sns.json\` 그대로.`,
    '- **공장** 칸: `yes` 는 코드에 있음(근거 토큰), `partial` 은 조사 카드·스타일 사전에만 있거나 일부만 있음, `no` 는 맞는 항목 없음.',
    '- **대담안**: 근거 카드 중 대담한 카드가 2장 이상이고 절반 이상. **골든 영향**: 빈틈을 메우는 산출물이 블록·레시피라 03-variants 고름(골든 18개)이 달라질 수 있음.',
    '- 패턴은 `factory/scripts/lib/gap-patterns.mjs` 의 키워드 표로 카드 서술에서 읽는다(결정적). 카드 원문은 옮기지 않는다.',
    '',
    '## 요약',
    '',
    `- 카드 ${meta.cards.total}장 중 ${meta.cards.used}장 사용(적합도 미달 ${meta.cards.misfit}장 제외) · 패턴 표 ${meta.patterns}개 · SNS 행 ${meta.snsRows}개`,
    `- 행 ${s.rows}개 = 카드 ${s.bySource.refs} + SNS ${s.bySource.sns} · 공장 보유: ${kv(s.byCoverage)}`,
    `- 빈틈 ${s.gaps}개 중 대담안 ${s.bold}개 · 골든 영향 ${s.goldenImpact}개`,
    `- 빈틈의 제안 종류: ${kv(s.byProposalKind)}`,
    `- 빈틈의 원형: ${kv(s.byArchetype)}`,
    '',
    `## 빈틈 (${gaps.length})`,
    '',
    ...(gaps.length ? [tableHead, ...gaps.map(tableRow)] : ['빈틈 없음.']),
    '',
    `## 이미 있음 (${have.length})`,
    '',
    ...(have.length ? [tableHead, ...have.map(tableRow)] : ['없음.']),
    '',
  ]
  return out.join('\n')
}

export const renderJson = (matrix) => `${JSON.stringify(matrix, null, 2)}\n`

/** 폴더 셋 → { matrix, md, json, skipped } */
export function generate({ cardsDir, snsFile, inventoryRoot }) {
  const { cards, skipped } = loadCards(cardsDir)
  const matrix = buildGapMatrix({ cards, sns: loadSns(snsFile), inventory: loadInventory(inventoryRoot) })
  return { matrix, md: renderMarkdown(matrix), json: renderJson(matrix), skipped }
}

// ── CLI ────────────────────────────────────────────────────────────────────
const USAGE = `사용: node factory/scripts/gap-matrix.mjs (--write | --check) [--cards <폴더>] [--sns <파일>] [--inventory <저장소 루트>] [--out <폴더>]
  카드 폴더 기본값: 환경 변수 REFCARDS_DIR, 없으면 ${DEFAULT_CARDS_DIR}`
const VALUE_FLAGS = ['--cards', '--sns', '--inventory', '--out']
const norm = (t) => t.replace(/\r\n/g, '\n')

function parseArgs(argv) {
  const modes = []
  const opt = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--write' || a === '--check') modes.push(a)
    else if (VALUE_FLAGS.includes(a) && argv[i + 1] !== undefined) opt[a.slice(2)] = argv[++i]
    else return { error: `알 수 없는 인자: ${a}` }
  }
  if (modes.length !== 1) return { error: '--write 와 --check 중 하나만 준다' }
  return { mode: modes[0], opt }
}

export function main(argv, { log = console.log, env = process.env } = {}) {
  const parsed = parseArgs(argv)
  if (parsed.error) { log(`${parsed.error}\n${USAGE}`); return 2 }
  const { mode, opt } = parsed
  const cardsDir = opt.cards ?? env.REFCARDS_DIR ?? DEFAULT_CARDS_DIR
  const outDir = opt.out ?? OUT_DIR
  const mdFile = join(outDir, 'gap-matrix.md')
  const jsonFile = join(outDir, 'gap-matrix.json')
  if (!existsSync(cardsDir)) {
    if (mode === '--check') { log(`카드 폴더 없음(${cardsDir}) — 빈틈 표 어긋남 검사를 건너뛴다(이 컴퓨터에는 원자료가 없다). REFCARDS_DIR 로 폴더를 알려 주면 검사한다.`); return 0 }
    log(`카드 폴더 없음(${cardsDir}) — 쓰지 않았다. REFCARDS_DIR 또는 --cards 로 폴더를 알려 준다.`)
    return 1
  }
  try {
    const g = generate({ cardsDir, snsFile: opt.sns ?? join(OUT_DIR, 'gap-sns.json'), inventoryRoot: opt.inventory ?? ROOT })
    for (const s of g.skipped) log(`경고: 카드 ${s.file} 를 건너뛴다 — ${s.reason}`)
    const sum = summarize(g.matrix.rows)
    if (mode === '--write') {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(mdFile, g.md)
      writeFileSync(jsonFile, g.json)
      log(`썼다: ${mdFile} · ${jsonFile} — 행 ${sum.rows}(빈틈 ${sum.gaps}) · 카드 ${g.matrix.meta.cards.used}/${g.matrix.meta.cards.total}장 사용`)
      return 0
    }
    const bad = []
    for (const [file, want] of [[mdFile, g.md], [jsonFile, g.json]]) {
      if (!existsSync(file)) bad.push(`${basename(file)} 가 없다`)
      else if (norm(readFileSync(file, 'utf8')) !== norm(want)) bad.push(`${basename(file)} 가 지금 카드·공장으로 다시 만든 것과 다르다`)
    }
    if (bad.length) { log(`빈틈 표가 낡았다: ${bad.join(' · ')} — \`${REGEN}\` 로 다시 만든다.`); return 1 }
    log(`빈틈 표가 최신이다 — 행 ${sum.rows}(빈틈 ${sum.gaps}) · 카드 ${g.matrix.meta.cards.used}/${g.matrix.meta.cards.total}장 사용`)
    return 0
  } catch (e) {
    log(`오류: ${e.message}`)
    return 1
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = main(process.argv.slice(2))
