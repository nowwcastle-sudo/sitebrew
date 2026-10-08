// UI 스타일 사전 references/styles/styles.json 을 만든다(P3-2 Task 15m, 2026-09-29, 접합면 J4).
// 입력(저장소 밖 선택 자료, 기본 $WF_DESIGN_RULES_DIR/factory/materials — 없으면 한 줄 알리고 종료 0, 기존 styles.json 은 그대로): styles/candidates.jsonl(styles 레인 54) · sns/candidates.jsonl(sns 레인 스타일 30,
// 정의·축) · bsk/signals.jsonl(Dribbble 태그 수·siteinspire 분류 수) · sns-crawler/research/reports/materials_candidates.jsonl(SNS 새 점수기).
// 순위는 sns-crawler/research/merge_sources.py(weights.json 의 sources 가중)를 불러 합친다 — 중간 파일은 materials/register/.
// 원천이 저장소 밖이라 gen:all 에 넣지 않는다. 사용: node factory/scripts/build-styles.mjs [--src <materials 폴더>] [--out <파일>]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { StyleRef, Proposal, styleProblems, axisValuesOnDisk, AXIS_KEYS, VERDICTS, COLOR_LOGICS } from './styles-ref.mjs'
import { COMPAT } from './compat.mjs'
import { absentNote, designRulesPath, skipAndExit } from '../lib/design-rules.mjs'
const COMPAT_FAMILIES = COMPAT.families

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def }
const SRC = opt('--src', designRulesPath('factory/materials'))
const OUT = opt('--out', join(ROOT, 'references', 'styles', 'styles.json'))
const SNS_SCORES = 'sns-crawler/research/reports/materials_candidates.jsonl'
const MERGE = 'sns-crawler/research/merge_sources.py'
const WORK = SRC ? join(SRC, 'register') : null
const rd = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

// SNS 레인 id → 사전 id(같은 스타일이면 styles 레인 id 를 쓴다). 표에 없는 SNS 스타일은 새 항목.
export const SNS_TO_ID = {
  'bento-grid': 'bento-grid', minimalism: 'minimalism', neobrutalism: 'neo-brutalism', glassmorphism: 'glassmorphism',
  claymorphism: 'claymorphism', 'editorial-layout': 'editorial-magazine', 'dark-mode': 'dark-mode-first', 'swiss-style': 'swiss-typographic',
  'mesh-gradient': 'aurora-mesh-gradient', neumorphism: 'neumorphism', 'pixel-art': 'pixel-8bit', brutalism: 'brutalist-editorial-hybrid',
  'hand-drawn': 'hand-drawn-doodle', 'liquid-glass': 'liquid-glass', 'isometric-3d': 'isometric', 'retro-os': 'retro-os-desktop',
  'grain-texture': 'grain-texture', collage: 'collage-scrapbook', y2k: 'y2k', monochrome: 'monochrome', skeuomorphism: 'skeuomorphism',
  'flat-design': 'flat-design',
}

// 새 축 값 제안(구현 안 됨). plan 은 대표 판단 2026-09-29 21:58(progress.md): C6·C8·H5·R3·K9·D·X 는 Task 16a 에서 구현,
// S4·C5 렌즈는 금지 스타일 전용이라 건너뜀, C9·H6 은 근거가 적어 건너뜀. 그 목록에 없는 제안은 「미정」.
const PLAN_16A = 'Task 16a 에서 구현 예정(대표 판단 2026-09-29) — 이 사전에서는 제안일 뿐'
const PROPOSALS = [
  { id: 'C6', axis: 'surface', name: '굵은 테두리 색면 카드', match: /^C6\b/, plan: PLAN_16A },
  { id: 'C8', axis: 'surface', name: '웹툰 컷(패널) 프레임', match: /^C8\b/, plan: PLAN_16A },
  { id: 'C9', axis: 'surface', name: '창(window) 크롬 카드', match: /^C9\b/, plan: '건너뜀 — 근거가 적다(대표 판단 2026-09-29)' },
  { id: 'H5', axis: 'header', name: '마스트헤드(제호 + 섹션 레일)', match: /^H5\b/, plan: PLAN_16A },
  { id: 'H6', axis: 'header', name: '메뉴 막대·작업표시줄 헤더', match: /^H6\b/, plan: '건너뜀 — 근거가 적다(대표 판단 2026-09-29)' },
  { id: 'R3', axis: 'radius', name: '유기 곡선(장식·마스크만)', match: /^R3\b/, plan: PLAN_16A },
  { id: 'K9', axis: 'colorLogic', name: '단색 램프', match: /^K9\b/, plan: PLAN_16A },
  { id: 'D', axis: 'display (새 축)', name: '디스플레이 규모 D1 표준 · D2 초대형 · D3 키네틱', match: /^D[123]?\b.*(디스플레이|초대형|키네틱)|^D[23]\*?$/, plan: PLAN_16A },
  { id: 'X', axis: 'texture (새 축)', name: '질감 X0 없음 · X1 그레인 · X2 인쇄 · X3 콜라주', match: /^X\b|^X[0-3]\*?$|X\(질감\)|X3 콜라주|X2 인쇄/, plan: PLAN_16A },
  { id: 'S4', axis: 'shadow', name: '양방향 볼록 그림자(뉴모피즘)', match: /^S4\b/, plan: '건너뜀 — 금지 스타일(뉴모피즘) 전용(대표 판단 2026-09-29)' },
  { id: 'S5', axis: 'shadow', name: '베벨(안쪽 하이라이트 + 1px 그림자)', match: /^S5\b/, plan: '미정 — 대표 판단 목록(2026-09-29 21:58)에 없다' },
  { id: 'C5-lens', axis: 'surface', name: 'C5 변형 굴절 렌즈', match: /^C5 변형/, plan: '건너뜀 — 금지 스타일(리퀴드 글래스) 전용(대표 판단 2026-09-29)' },
  { id: 'C7', axis: 'surface', name: '재질 표면(텍스처 배경 + 안쪽 하이라이트)', match: /^C7\b/, plan: '미정 — 브리프 목록 밖(sns 레인 제안)' },
  { id: 'decor-geometric', axis: 'decor (sns 레인 이름 D1 — 디스플레이 축 D 와 이름이 겹쳐 따로 적는다)', name: '기하 도형 장식층', match: /^D1 기하/, plan: '미정 — 브리프 목록 밖(sns 레인 제안)' },
  { id: 'decor-chrome', axis: 'decor (sns 레인 이름 D2 — 디스플레이 축 D 와 이름이 겹쳐 따로 적는다)', name: '크롬 이미지 재료(래스터)', match: /^D2 크롬/, plan: '미정 — 브리프 목록 밖(sns 레인 제안)' },
]
const proposalOf = (text) => PROPOSALS.find((p) => p.match.test(text))?.id
// 구현된 제안(Task 16a, 2026-09-29): 축 폴더에 값 파일이 생겼거나(C6·C8·H5·R3·D 축·X 축) 색 논리 목록에 들어간 것(K9).
// 레인이 「C6*」처럼 제안 표시로 적은 자리도 이제 진짜 값으로 읽고, proposals 에서 빼 implemented 로 옮긴다.
const AXIS_OF_PROPOSAL = { D: 'display', X: 'texture' }
export const isImplemented = (id, disk) => (id === 'K9' ? COLOR_LOGICS.includes('K9') : AXIS_OF_PROPOSAL[id] ? !!disk[AXIS_OF_PROPOSAL[id]]?.length : Object.values(disk).some((vs) => vs.includes(id)))
const onDisk = (code, disk) => Object.values(disk).some((vs) => vs.includes(code))

// 축 문자열 "B3|B4" · "mid|R1" · "C8*" · "K1+dark" 풀기.
// 레인의 "B1|B4 · C6*|C3 · R0|R1" 은 자리마다 한 벌이다: 첫째끼리가 기본 벌(axes), 둘째끼리가 변형 벌 하나(axesVariants) …
// 자리 값이 제안(*)이거나 「mid」(반경 축에 중간 값이 없다)면 그 벌에서 그 축을 비운다. 자리 값이 없는 축은 기본 벌 값을 그대로 쓴다.
function parseAxes(raw, disk) {
  const lists = {}, notes = [], props = new Set(), recipe = {}
  for (const [k, v] of Object.entries(raw ?? {})) {
    const items = String(v).split('|')
    if (k === 'M') { recipe.motion = items[0]; continue }
    if (k === 'K') {
      const ks = []
      for (const it of items) {
        const [code, mod] = it.split('+')
        if (code.endsWith('*') && !COLOR_LOGICS.includes(code.slice(0, -1))) { props.add(proposalOf(code.slice(0, -1))); continue }
        if (code.endsWith('*')) { ks.push(code.slice(0, -1)); continue }
        ks.push(code)
        if (mod === 'dark') recipe.defaultTheme = 'dark'
      }
      if (ks.length) recipe.colorLogic = ks
      continue
    }
    // D·X 는 Task 16a 에서 축이 됐다 — 폴더에 값이 있으면 축 값으로, 없으면 제안으로.
    if ((k === 'D' || k === 'X') && !disk[AXIS_KEYS[k]]?.length) { for (const it of items) props.add(proposalOf(it)); continue }
    const axis = AXIS_KEYS[k]
    if (!axis) throw new Error(`모르는 축 글자 ${k}`)
    lists[axis] = items.map((it) => {
      if (it.endsWith('*') && onDisk(it.slice(0, -1), disk) && disk[axis]?.includes(it.slice(0, -1))) return it.slice(0, -1)
      if (it.endsWith('*')) { props.add(proposalOf(it.slice(0, -1))); return null }
      if (it === 'mid') { notes.push(`${axis}: 「mid」(중간 반경) — 반경 축에 중간 값이 없어 그 벌에서 축 값을 두지 않는다(base 반경). 중간 계열 부품(B2·B3·C1·H1 …)과 섞을 수 있는 반경은 R1·R2`); return null }
      if (disk[axis]?.includes(it)) return it
      throw new Error(`${k}=${it} 가 축 폴더에 없다`)
    })
  }
  const n = Math.max(1, ...Object.values(lists).map((l) => l.length))
  const sets = []
  for (let i = 0; i < n; i++) {
    const sel = {}
    for (const [axis, l] of Object.entries(lists)) { const v = i < l.length ? l[i] : l[0]; if (v) sel[axis] = v }
    sets.push(sel)
  }
  const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
  const variants = sets.slice(1).filter((s, i, arr) => !same(s, sets[0]) && arr.findIndex((t) => same(t, s)) === i)
  return { axes: sets[0], variants, notes: [...new Set(notes)], props, recipe }
}

if (!SRC || !existsSync(join(SRC, 'styles', 'candidates.jsonl'))) {
  skipAndExit(absentNote('스타일 원천 자료(factory/materials)', 'style source materials (factory/materials)'))
}
const disk = axisValuesOnDisk()
const lane = rd(join(SRC, 'styles', 'candidates.jsonl'))
const snsDefs = rd(join(SRC, 'sns', 'candidates.jsonl')).filter((r) => r.kind === 'style')
const snsScores = new Map(rd(SNS_SCORES).filter((r) => r.kind === 'style').map((r) => [r.key, r]))
const bsk = rd(join(SRC, 'bsk', 'signals.jsonl')).filter((b) => b.style_id)
const strict = (a, b) => (VERDICTS.indexOf(a) >= VERDICTS.indexOf(b) ? a : b) // ban > allow-with-rules > allow

const byId = new Map()
for (const s of lane) {
  const p = parseAxes(s.axes, disk)
  for (const t of s.newAxisValues) p.props.add(proposalOf(t))
  byId.set(s.id, {
    id: s.id, name: s.name, visualRules: s.visualRules, parsed: p, archetypes: new Set(s.archetypes),
    compatNote: s.compat === '없음' ? '' : s.compat, verdicts: [['styles', s.verdict, s.verdictRef]],
    evidence: s.evidence.filter((e) => !/^sns \(reserved/.test(e.type)), lanes: new Set(['styles']),
    raw: { opl: s.evidence.find((e) => e.type === 'gallery-count:onepagelove')?.signal, trend: s.evidence.find((e) => e.type.startsWith('trend-article'))?.signal,
      github: s.evidence.find((e) => e.type === 'github-topic-repos')?.signal, naver: s.evidence.find((e) => e.type.startsWith('naver-blog-total'))?.signal,
      naver_docs: s.evidence.find((e) => e.type.startsWith('naver-trend-doc'))?.signal, slp: s.evidence.find((e) => e.type === 'gallery-count:saaslandingpage')?.signal },
    note: s.confidence === 'low' ? 'styles 레인 신뢰도 낮음 — 사람이 확인할 것' : undefined,
  })
}
const snsKeyOf = new Map()
for (const s of snsDefs) {
  const key = s.id.replace(/^style-/, '')
  const id = SNS_TO_ID[key] ?? key
  snsKeyOf.set(key, id)
  let r = byId.get(id)
  if (!r) {
    const p = parseAxes(s.axes, disk)
    r = { id, name: s.name, visualRules: s.visual_rules, parsed: p, archetypes: new Set(), compatNote: s.compat === 'ok' ? '' : s.compat, verdicts: [], evidence: [], lanes: new Set(), raw: {} }
    byId.set(id, r)
  }
  for (const t of s.newAxisValues) r.parsed.props.add(proposalOf(t))
  for (const a of s.archetypes) r.archetypes.add(a)
  r.verdicts.push(['sns', s.verdict, s.verdict_basis])
  r.lanes.add('sns')
  const sc = snsScores.get(key)
  if (sc) for (const e of sc.evidence) r.evidence.push({ url: e.url, signal: `${e.platform} @${e.author}: ${Object.entries(e.signals).map(([k, v]) => `${k} ${v.value}`).join(', ')} (기여 ${e.contribution}${e.flags?.length ? `, ${e.flags.join('·')}` : ''})`, type: `sns-post:${e.platform}` })
  else for (const e of s.evidence) r.evidence.push({ url: e.url, signal: `${e.platform} @${e.author}: ${Object.entries(e.signal).map(([k, v]) => `${k} ${v}`).join(', ')} (옛 sns 레인 점수 — 새 점수기에 없음)`, type: `sns-post:${e.platform}` })
}
// Dribbble 태그 수(가중 0.2, 스펙 §4) · siteinspire 분류 수(같은 스타일에 분류 여럿이면 합) → curation 출처
const drib = new Map(), site = new Map()
for (const b of bsk) {
  if (!byId.has(b.style_id)) throw new Error(`bsk style_id ${b.style_id} 가 사전에 없다`)
  if (b.count == null) continue
  const r = byId.get(b.style_id)
  if (b.site === 'dribbble') { drib.set(b.style_id, b.count); r.evidence.push({ url: b.url, signal: `Dribbble 태그 「${b.tag}」 샷 ${b.count.toLocaleString('en')}개`, type: 'dribbble-tag-count' }) }
  if (b.site === 'siteinspire') { site.set(b.style_id, (site.get(b.style_id) ?? 0) + b.count); r.evidence.push({ url: b.url, signal: `siteinspire 분류 「${b.tag}」 사이트 ${b.count}곳`, type: 'siteinspire-category-count' }) }
}

// ── 순위: merge_sources.py (Σw·p + 0.5)/(Σw + 1). weights.json 에 없는 출처(opl·trend·naver_docs·slp)는 styles 레인 가중을 행에 적는다.
const ROW_W = { opl: 1.0, trend: 1.0, naver_docs: 0.25, slp: 0.5 }
const other = []
for (const r of byId.values()) {
  for (const [src, v] of Object.entries(r.raw)) if (typeof v === 'number') other.push({ kind: 'style', key: r.id, source: src, value: v, ...(ROW_W[src] ? { weight: ROW_W[src] } : {}) })
  if (drib.has(r.id)) other.push({ kind: 'style', key: r.id, source: 'dribbble', value: drib.get(r.id) })
  if (site.has(r.id)) other.push({ kind: 'style', key: r.id, source: 'curation', value: site.get(r.id) })
}
const snsRows = [...snsScores.values()].map((c) => ({ kind: 'style', key: snsKeyOf.get(c.key) ?? c.key, score: c.score }))
for (const s of snsRows) if (!byId.has(s.key)) throw new Error(`SNS 점수 ${s.key} 가 사전에 없다`)
mkdirSync(WORK, { recursive: true })
writeFileSync(join(WORK, 'other_style.jsonl'), other.map((r) => JSON.stringify(r)).join('\n') + '\n')
writeFileSync(join(WORK, 'sns_style.jsonl'), snsRows.map((r) => JSON.stringify(r)).join('\n') + '\n')
execFileSync('python', [MERGE, '--sns', join(WORK, 'sns_style.jsonl'), '--other', join(WORK, 'other_style.jsonl'), '--out', join(WORK, 'merged_style.jsonl')], { stdio: ['ignore', 'ignore', 'inherit'] })
const merged = new Map(rd(join(WORK, 'merged_style.jsonl')).map((m) => [m.key, m]))
const weightsVersion = JSON.parse(readFileSync('sns-crawler/research/weights.json', 'utf8')).version

// ── 조립 + 호환 검사(원형 충돌은 archetypesExcluded 로 옮기고, 대안 충돌은 버리고 적는다)
const styles = []
for (const r of [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const verdict = r.verdicts.reduce((v, [, x]) => strict(v, x), 'allow')
  const reasons = r.verdicts.map(([l, v, why]) => `${l} 레인 ${v}: ${why}`)
  if (new Set(r.verdicts.map(([, v]) => v)).size > 1) reasons.push(`판정이 갈려 엄격한 쪽(${verdict})을 쓴다`)
  const { axes, variants, notes, props, recipe } = r.parsed
  const s = {
    id: r.id, name: r.name, visualRules: r.visualRules, axes, axesVariants: [], axesNotes: [...notes], recipeFields: recipe,
    newAxisValues: [...props].filter((id) => id && !isImplemented(id, disk)).sort(), archetypes: [], archetypesExcluded: [], compatNote: r.compatNote,
    verdict, verdictReason: reasons.join(' / '), evidence: r.evidence, rank_score: merged.get(r.id)?.merged_score ?? 0.5,
    rank_parts: Object.fromEntries(Object.entries(merged.get(r.id)?.by_source ?? {}).map(([k, b]) => [k, { value: b.value, pct: b.pct, weight: b.weight }])),
    lanes: [...r.lanes].sort(), ...(r.note ? { note: r.note } : {}),
  }
  // 구현된 제안 값(Task 16a)이 기본 벌의 다른 축과 반경 계열로 부딪히면(예: 웹툰 컷 C8(0 계열) × B2·H1(중간)), 그 값이 스타일을 정의하는 값이므로
  // 부딪힌 축만 같은 축의 0 계열 값(B1·I3·C2·T4·H3·R0)으로 바꾼 벌을 기본 벌로 쓰고, 레인이 적은 원래 벌(제안 값 없이)은 변형 벌로 남긴다 — axesNotes 에 적는다.
  const baseBad = styleProblems({ id: s.id, axes: s.axes }, disk)
  const introduced = Object.values(s.axes).filter((v) => PROPOSALS.some((p) => p.id === v) && isImplemented(v, disk))
  if (baseBad.length && introduced.length && baseBad.every((m) => /반경 계열 충돌/.test(m))) {
    const ZERO = { button: 'B1', input: 'I3', surface: 'C2', table: 'T4', header: 'H3', radius: 'R0' }
    const fam = (v) => Object.keys(COMPAT_FAMILIES).find((f) => COMPAT_FAMILIES[f].includes(v))
    const target = fam(introduced[0])
    const swapped = Object.fromEntries(Object.entries(s.axes).map(([axis, v]) => [axis, introduced.includes(v) || !fam(v) || fam(v) === target ? v : (target === 'zero' ? ZERO[axis] ?? v : v)]))
    if (!styleProblems({ id: s.id, axes: swapped }, disk).length) {
      const original = Object.fromEntries(Object.entries(s.axes).filter(([, v]) => !introduced.includes(v)))
      s.axesNotes.push(`기본 벌: 구현된 ${introduced.join('·')}(${target} 계열)가 레인 벌의 ${Object.entries(s.axes).filter(([a, v]) => swapped[a] !== v).map(([a, v]) => `${a} ${v}`).join('·')} 와 반경 계열로 부딪혀 그 축을 ${target} 계열 값으로 바꿨다(Task 16a). 레인이 적은 벌은 ${introduced.join('·')} 없이 변형 벌로 남긴다`)
      variants.unshift(original)
      s.axes = swapped
    }
  }
  for (const v of variants) {
    const bad = styleProblems({ id: s.id, axes: v }, disk)
    if (bad.length) s.axesNotes.push(`변형 벌 ${JSON.stringify(v)} 버림 — ${bad[0].split(': ').slice(1).join(': ')}`)
    else s.axesVariants.push(v)
  }
  for (const a of [...r.archetypes].sort()) {
    const bad = styleProblems({ ...s, archetypes: [a] }, disk).filter((m) => m.startsWith(`${s.id} × ${a}`))
    if (bad.length) s.archetypesExcluded.push({ archetype: a, why: bad.map((m) => m.split(': ').slice(1).join(': ')).join(' / ') })
    else s.archetypes.push(a)
  }
  const left = styleProblems(s, disk)
  if (left.length) throw new Error(left.join('\n'))
  const z = StyleRef.safeParse(s)
  if (!z.success) throw new Error(`${s.id}: ${z.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
  styles.push(s)
}
// 구현된 제안은 proposals 에서 빼 implemented 에 남긴다(어느 스타일이 쓰는지 — 사전이 그 값을 axes 로 옮겼다).
const implemented = PROPOSALS.filter((p) => isImplemented(p.id, disk)).map(({ id, axis, name }) => ({ id, axis, name, task: 'P3-2 Task 16a (2026-09-29)',
  usedBy: styles.filter((s) => (id === 'K9' ? s.recipeFields.colorLogic?.includes('K9') : AXIS_OF_PROPOSAL[id] ? s.axes[AXIS_OF_PROPOSAL[id]] || s.axesVariants.some((v) => v[AXIS_OF_PROPOSAL[id]]) : Object.values(s.axes).includes(id) || s.axesVariants.some((v) => Object.values(v).includes(id)))).map((s) => s.id) }))
const proposals = PROPOSALS.filter((p) => !isImplemented(p.id, disk)).map(({ match, ...p }) => {
  const from = styles.filter((s) => s.newAxisValues.includes(p.id)).map((s) => s.id)
  const lanes = [...new Set(from.flatMap((id) => { const r = byId.get(id); return [...r.lanes] }))].sort()
  const descs = [...lane.flatMap((s) => s.newAxisValues), ...snsDefs.flatMap((s) => s.newAxisValues)].filter((t) => match.test(t))
  return { ...p, description: [...new Set(descs)].join(' / ') || p.name, from, lanes, status: 'not-implemented' }
}).filter((p) => p.from.length)
for (const p of proposals) { const z = Proposal.safeParse(p); if (!z.success) throw new Error(`${p.id}: ${z.error.message}`) }
const count = (f) => styles.filter(f).length
const doc = {
  $comment: 'UI 스타일 사전(P3-2 Task 15m, 접합면 J4). 만드는 곳 factory/scripts/build-styles.mjs, 모양·검사 styles-ref.mjs, 설명 README.md. 판정 allow·allow-with-rules·ban — ban 은 레시피에 쓰지 않는다. proposals 는 구현 안 된 새 축 값 제안이고, implemented 는 Task 16a 에서 구현돼 스타일 axes·recipeFields 로 옮긴 제안이다.',
  generatedAt: '2026-09-29',
  scorer: { sns: `sns-crawler/research score.py weights ${weightsVersion} (rescore_2026-09-29)`, merge: 'sns-crawler/research/merge_sources.py — (Σ w·p + 1×0.5) ÷ (Σ w + 1)', rowWeights: ROW_W },
  counts: { total: styles.length, byVerdict: Object.fromEntries(VERDICTS.map((v) => [v, count((s) => s.verdict === v)])), byLanes: { both: count((s) => s.lanes.length === 2), styles: count((s) => s.lanes.join() === 'styles'), sns: count((s) => s.lanes.join() === 'sns') }, proposals: proposals.length, implemented: implemented.length },
  styles, proposals, implemented,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n')
console.log(JSON.stringify(doc.counts))
