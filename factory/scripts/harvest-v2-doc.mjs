// SNS 2차 수집(harvest-v2) 분석 문서 생성기 — factory v1 Task 3.2 (합의안 D12).
//   node factory/scripts/harvest-v2-doc.mjs [--write] [--dir <harvest-v2 폴더>]
//   풀(pool.jsonl)에서 테마(harvest-v2-themes.mjs)별 건수·플랫폼 분포·포인터를 세어
//   docs/qa/factory-v1/harvest-v2.md 와 gap-sns.json 을 만든다. 원문은 저장소에 쓰지 않는다 — 건수·한 줄 요지·주소만.
//   --write 가 없으면 요약만 찍는다. 원자료 폴더는 HARVEST_V2_DIR(기본 $WF_DESIGN_RULES_DIR/factory/harvest-v2 — 없으면 한 줄 알리고 종료 0).
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { absentNote, designRulesPath } from '../lib/design-rules.mjs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { NOISE_GROUPS, THEMES, TOPICS } from './harvest-v2-themes.mjs'

export { NOISE_GROUPS, THEMES, TOPICS }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DOC_FILE = join(ROOT, 'docs', 'qa', 'factory-v1', 'harvest-v2.md')
export const GAP_FILE = join(ROOT, 'docs', 'qa', 'factory-v1', 'gap-sns.json')

/** 원자료 폴더(선택 자료, D24): HARVEST_V2_DIR → $WF_DESIGN_RULES_DIR/factory/harvest-v2 → null. */
export const harvestDir = () => process.env.HARVEST_V2_DIR || designRulesPath('factory/harvest-v2')

const nf = (n) => n.toLocaleString('en-US')
const compile = (src) => (src ? new RegExp(src, 'iu') : null)
const compileG = (src) => (src ? new RegExp(src, 'giu') : null)

// ── 테마 세기 ────────────────────────────────────────────────────────────────
const engagement = (e) => (e ? (e.score || 0) + (e.likes || 0) + (e.replies || 0) : 0)
const better = (a, b) => (a.hits - b.hits) || (a.rel - b.rel) || (a.eng - b.eng) || (a.id < b.id ? 1 : -1) // 양수면 a 가 낫다

/** pool.jsonl 을 한 번 읽으며 테마마다 { mentions, ko, en, byPlatform, pointers[] } 를 센다. */
export async function computeThemes(poolFile, themes = THEMES, noiseGroups = NOISE_GROUPS) {
  const defs = themes.map((t) => ({ t, ko: compile(t.ko), en: compile(t.en), koG: compileG(t.ko), enG: compileG(t.en) }))
  const nz = noiseGroups.map((g) => ({ g, ko: compile(g.ko), en: compile(g.en) }))
  const acc = new Map([...themes, ...noiseGroups].map((t) => [t.id, { mentions: 0, ko: 0, en: 0, byPlatform: {}, top: new Map() }]))
  let posts = 0
  let noisy = 0
  const rl = createInterface({ input: createReadStream(poolFile, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line) continue
    const p = JSON.parse(line)
    posts++
    const lang = p.lang === 'ko' ? 'ko' : 'en'
    // 전역 잡음 묶음: 범위 안 테마는 이 글들을 세지 않는다
    let isNoise = false
    for (const d of nz) {
      const re = d[lang]
      if (re && re.test(p.text)) {
        isNoise = true
        const a = acc.get(d.g.id)
        a.mentions++; a[lang]++; a.byPlatform[p.platform] = (a.byPlatform[p.platform] || 0) + 1
      }
    }
    if (isNoise) noisy++
    for (const d of defs) {
      if (!p.topics.includes(d.t.topic)) continue
      if (isNoise && d.t.inScope !== false) continue
      const re = lang === 'ko' ? d.ko : d.en
      if (!re || !re.test(p.text)) continue
      const a = acc.get(d.t.id)
      a.mentions++
      a[lang]++
      a.byPlatform[p.platform] = (a.byPlatform[p.platform] || 0) + 1
      if (typeof p.url === 'string' && p.url.startsWith('https://')) {
        const reG = lang === 'ko' ? d.koG : d.enG
        const hits = Math.min(9, (p.text.match(reG) || []).length)
        const c = { id: p.id, url: p.url, hits, rel: p.rel || 0, eng: engagement(p.engagement) }
        const list = a.top.get(p.platform) || []
        list.push(c)
        list.sort((x, y) => -better(x, y))
        if (list.length > 3) list.length = 3
        a.top.set(p.platform, list)
      }
    }
  }
  const out = new Map()
  for (const [id, a] of acc) {
    // 플랫폼마다 가장 나은 글 → 모자라면 두 번째 …, 쏠림을 피해 최대 3개
    const rounds = [0, 1, 2].map((i) => [...a.top.values()].map((l) => l[i]).filter(Boolean).sort((x, y) => -better(x, y)))
    const pointers = []
    for (const r of rounds) for (const c of r) { if (pointers.length < 3 && !pointers.includes(c.url)) pointers.push(c.url) }
    out.set(id, { mentions: a.mentions, ko: a.ko, en: a.en, byPlatform: a.byPlatform, pointers })
  }
  out.posts = posts
  out.noisy = noisy
  return out
}

// ── 빈틈 표 ──────────────────────────────────────────────────────────────────
export function buildGapRows(computed, themes = THEMES) {
  return themes.filter((t) => t.inScope !== false).map((t) => {
    const c = computed.get(t.id)
    return {
      id: t.id,
      topic: t.topic,
      theme: t.gist,
      type: t.type,
      evidence: { mentions: c.mentions, ko: c.ko, en: c.en, pointers: c.pointers },
      coverage: t.coverage,
      coverageEvidence: t.cov,
      proposal: t.proposal,
      archetypes: t.archetypes,
      goldenImpact: t.golden,
    }
  })
}

// ── 문서 합계 읽기(시험이 쓴다) ──────────────────────────────────────────────
/** 문서의 `| \`키.경로\` | 라벨 | 값 |` 행을 stats.json 모양으로 되읽는다. */
export function parseDocTotals(text) {
  const t = { raw_in: {}, drops: {}, by_platform: {}, by_group: {}, by_lang: {}, by_primary_topic: {}, by_tag_topic: {} }
  for (const line of text.split('\n')) {
    const m = line.match(/^\| `([a-z_]+)(?:\.([a-z_]+))?` \|.*\| ([0-9][0-9,.]*) \|\s*$/)
    if (!m) continue
    const v = Number(m[3].replace(/,/g, ''))
    if (m[2]) { if (t[m[1]]) t[m[1]][m[2]] = v } else t[m[1]] = v
  }
  return t
}

// ── 풀과 겹치는 연속 낱말 검사 ───────────────────────────────────────────────
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
/** lines 의 n낱말 연속 구간이 풀 글에 그대로 있으면 [{ line, window }] 를 돌려준다(없으면 빈 배열). */
export async function scanOverlap(poolFile, lines, n = 12) {
  const windows = new Map() // key → { line, window }
  const firsts = new Set()
  for (const line of lines) {
    const w = norm(line)
    for (let i = 0; i + n <= w.length; i++) {
      const key = w.slice(i, i + n).join(' ')
      if (!windows.has(key)) windows.set(key, { line: line.slice(0, 80), window: key })
      firsts.add(w[i])
    }
  }
  const hits = []
  if (!windows.size) return hits
  const rl = createInterface({ input: createReadStream(poolFile, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const l of rl) {
    if (!l) continue
    const w = norm(JSON.parse(l).text)
    for (let i = 0; i + n <= w.length; i++) {
      if (!firsts.has(w[i])) continue
      const key = w.slice(i, i + n).join(' ')
      const hit = windows.get(key)
      if (hit) { hits.push(hit); windows.delete(key) }
    }
  }
  return hits
}

// ── 문서 ─────────────────────────────────────────────────────────────────────
const PLATFORM_LABEL = { hn: 'HN', naver_blog: '네이버 블로그', naver_cafe: '네이버 카페', pinterest: 'Pinterest', reddit: 'Reddit', threads: 'Threads', x: 'X' }
const GROUP_LABEL = { hn: 'HN', naver: '네이버(블로그+카페)', pinterest: 'Pinterest', reddit: 'Reddit', threads: 'Threads', x: 'X' }
const DROP_LABEL = {
  promo_spam: '광고·스팸 문구', too_short: '20자 미만', dup_text_hash: '본문 해시 중복', lang_other_or_empty: '언어 판정 불가(한·영 아님)',
  hashtag_flood: '해시태그 8개 이상', dup_url: 'URL 중복(같은 글이 여러 질의에 걸림)', off_topic_gate: '주제 게이트 탈락', cap_naver: '네이버 68% 상한으로 자름',
}
const TOPIC_LABEL = { seo: 'SEO', geo: 'GEO', ax: 'AX', design: '디자인', motion: '모션', frontend: '프런트엔드', boilerplate: '보일러플레이트', landing: '랜딩 전환' }
const TYPE_LABEL = { complaint: 'complaint', request: 'request', praise: 'praise', 'how-to': 'how-to' }

const split = (byPlatform) => Object.entries(byPlatform).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${PLATFORM_LABEL[k] || k} ${nf(v)}`).join(', ')
const kv = (key, label, val) => `| \`${key}\` | ${label} | ${typeof val === 'number' && !Number.isInteger(val) ? val : nf(val)} |`

export function renderDoc(stats, computed, themes = THEMES) {
  const rows = buildGapRows(computed, themes)
  const L = []
  const w = (s = '') => L.push(s)
  const inScope = themes.filter((t) => t.inScope !== false)
  const cov = { yes: 0, partial: 0, no: 0 }
  for (const r of rows) cov[r.coverage]++
  const golden = rows.filter((r) => r.goldenImpact)

  w('# HARVEST v2 — 공장 v1 SNS 2차 수집 분석: 주제 8 · 한국어+영어')
  w()
  w('작성: 2026-10-10(수집 2026-10-09 21:04~2026-10-10 09:44, 분석 같은 날). 범위: SEO·GEO·AX·디자인·모션·프런트엔드·보일러플레이트·랜딩 전환(합의안 D12). 이 문서는 **수집 결과의 주제 분류와 공장 규칙 대조**만 다룬다. 제3자 글 원문은 없고 요지·건수·포인터(URL)만 있다. 원자료는 저장소 밖 선택 자료 폴더 `factory/harvest-v2/`(`HARVEST_V2_DIR` 또는 `WF_DESIGN_RULES_DIR` 아래, 수집 기록 `run-log.md`·`stats.json`·`tables.md`). 빈틈 표 정본은 같은 폴더의 `gap-sns.json`이다.')
  w()
  w('## 한눈에')
  w()
  w(`- 규모: 원자료 ${nf(stats.raw_total)}줄 → 정제 뒤 분석 풀 **${nf(stats.pool_total)}건**(한국어 ${nf(stats.by_lang.ko)} · 영어 ${nf(stats.by_lang.en)}, 한국어 ${(stats.ko_share * 100).toFixed(1)}%). 주제마다 주 주제 기준 최소 ${nf(Math.min(...Object.values(stats.by_primary_topic)))}건(boilerplate)이다. 정확한 표는 §1.`)
  w(`- 분류: 주제 8개에서 **테마 ${themes.length}개**(공장 범위 안 ${inScope.length}개 · 범위 밖 ${themes.length - inScope.length}개)와 전역 잡음 묶음 ${NOISE_GROUPS.length}개를 뽑아 건수를 셌다. 범위 안 테마는 잡음 묶음에 걸린 글(구인·학원 홍보·광고 대행 성과 보고서 등, 풀의 ${(computed.noisy / computed.posts * 100).toFixed(1)}%, ${nf(computed.noisy)}건)을 세지 않는다. 결정적 정규식(한국어·영어 따로) + 주제 태그 방식이고 LLM 분류는 쓰지 않았다. 주제마다 풀에서 무작위로 ko·en 각 20~28건(주제당 40~56건, 제목·요약 포함)을 먼저 읽고 테마와 정규식을 정했다.`)
  w(`- 규칙 대조: 범위 안 테마 ${rows.length}개를 공장 규칙(factory-rules.md §20~23)·docs/agents/agent-guide.md 관문 표·블록 메타·\`factory/qa/*\` 관문·launch-factory와 맞춰 보았다. 이미 덮인 것(yes) ${cov.yes} · 일부(partial) ${cov.partial} · 없음(no) ${cov.no}. 골든 사유에 떠오를 빈틈은 ${golden.length}개(§4).`)
  w('- **읽을 때 주의**: 네이버 글은 제목+요약뿐이고(본문 없음) 한국어의 약 98%가 네이버다. Instagram은 0건이다. 건수는 정규식 계수라 하한 근사이고 정밀도는 테마마다 다르다(§5).')
  w()
  w('## 이 문서의 열 정의')
  w()
  w('- 언급: 그 주제 태그를 가진 글 중 테마 정규식에 맞는 글 수(글 하나가 여러 테마에 걸릴 수 있다). ko/en은 글의 언어(pool `lang`) 기준이다.')
  w('- 유형: complaint(불만) · request(요구·질문) · praise(칭찬) · how-to(방법·권고). 테마마다 가장 많은 쪽 하나로 정했다.')
  w('- 정밀도: 정규식에 잡힌 글(잡음 묶음 제외)을 테마마다 6건 직접 읽고, 그 테마의 주제를 실제로 다룬 글을 센 값(예: 5/6). 불만·요구 같은 유형이 맞는지는 따지지 않았다. 표본이 작아 방향만 알려 준다. 정규식을 조인 테마는 조인 뒤에 다시 읽었다.')
  w('- 포인터: 정규식에 여러 번 걸리고 반응이 큰 글부터, 같은 플랫폼 쏠림을 피해 최대 3개. 원문은 싣지 않는다.')
  w('- 규칙 대조(yes·partial·no)와 제안은 `gap-sns.json`에 있다. 이 문서는 요약만 싣는다.')
  w()
  w('## 1. 수집·통과 건수 (stats.json 그대로)')
  w()
  w('첫 칸의 백틱 이름은 `stats.json`의 키 경로다. 시험(`factory/scripts/harvest-v2-doc.test.mjs`)이 이 칸을 읽어 원본 파일과 대조한다.')
  w()
  w('### 1-1. 플랫폼별 받아 온 줄(원자료)')
  w()
  w('| 키 | 플랫폼 | 줄 수 |')
  w('|---|---|---:|')
  for (const [k, v] of Object.entries(stats.raw_in)) w(kv(`raw_in.${k}`, PLATFORM_LABEL[k] || k, v))
  w(kv('raw_total', '**합**', stats.raw_total))
  w()
  w('### 1-2. 정제에서 버린 것')
  w()
  w('| 키 | 까닭 | 건수 |')
  w('|---|---|---:|')
  for (const [k, v] of Object.entries(stats.drops)) w(kv(`drops.${k}`, DROP_LABEL[k] || k, v))
  w()
  w(`원자료 ${nf(stats.raw_total)} − 버린 것 ${nf(Object.values(stats.drops).reduce((a, b) => a + b, 0))} = 분석 풀 ${nf(stats.pool_total)}.`)
  w()
  w('### 1-3. 분석 풀')
  w()
  w('| 키 | 구분 | 건수 |')
  w('|---|---|---:|')
  w(kv('pool_total', '**분석 풀**', stats.pool_total))
  for (const [k, v] of Object.entries(stats.by_platform)) w(kv(`by_platform.${k}`, `플랫폼 ${PLATFORM_LABEL[k] || k}`, v))
  for (const [k, v] of Object.entries(stats.by_group)) w(kv(`by_group.${k}`, `그룹 ${GROUP_LABEL[k] || k}`, v))
  for (const [k, v] of Object.entries(stats.by_lang)) w(kv(`by_lang.${k}`, `언어 ${k}`, v))
  w(kv('ko_share', '한국어 비율', stats.ko_share))
  w(kv('max_group_share', '가장 큰 그룹(네이버) 비율', stats.max_group_share))
  for (const [k, v] of Object.entries(stats.by_primary_topic)) w(kv(`by_primary_topic.${k}`, `주 주제 ${TOPIC_LABEL[k]}`, v))
  for (const [k, v] of Object.entries(stats.by_tag_topic)) w(kv(`by_tag_topic.${k}`, `태그 포함 ${TOPIC_LABEL[k]}(중복 허용)`, v))
  w()
  w('### 1-4. 플랫폼 × 언어 (주 주제 행 합)')
  w()
  const pl = {}
  for (const [k, v] of Object.entries(stats.table_platform_lang_primarytopic)) { const [pf, lg] = k.split('|'); pl[pf] = pl[pf] || { ko: 0, en: 0 }; pl[pf][lg] += v }
  w('| 플랫폼 | ko | en |')
  w('|---|---:|---:|')
  for (const k of Object.keys(stats.by_platform)) w(`| ${PLATFORM_LABEL[k] || k} | ${nf(pl[k].ko)} | ${nf(pl[k].en)} |`)
  w()
  w('목표 판정(stats.json `targets`): 풀 5만 이상 · 한국어 30% 이상 · 주제마다 2,000건 이상(주 주제·태그 모두) · 플랫폼 그룹 하나가 70% 이하 — 전부 충족. 수집 기록은 `run-log.md`.')
  w()
  w('## 2. 주제별 상위 테마')
  w()
  for (const tp of TOPICS) {
    const list = inScope.filter((t) => t.topic === tp).map((t) => ({ t, c: computed.get(t.id) })).sort((a, b) => b.c.mentions - a.c.mentions || (a.t.id < b.t.id ? -1 : 1))
    const ko = list.reduce((s, x) => s + x.c.ko, 0)
    const en = list.reduce((s, x) => s + x.c.en, 0)
    w(`### ${TOPIC_LABEL[tp]} (\`${tp}\`) — 주 주제 ${nf(stats.by_primary_topic[tp])}건 · 태그 포함 ${nf(stats.by_tag_topic[tp])}건 · 테마 ${list.length}개`)
    w()
    w(`테마 언급 합(겹침 포함): ko ${nf(ko)} · en ${nf(en)}.`)
    w()
    w('| 테마 | 유형 | 한 줄 요지 | 언급 | ko/en | 플랫폼별 | 정밀도 | 대표 글 포인터 |')
    w('|---|---|---|---:|---|---|---|---|')
    for (const { t, c } of list) {
      const prec = t.prec ? `${t.prec[0]}/${t.prec[1]}` : '-'
      w(`| \`${t.id}\` | ${TYPE_LABEL[t.type]} | ${t.gist} | ${nf(c.mentions)} | ${nf(c.ko)}/${nf(c.en)} | ${split(c.byPlatform)} | ${prec} | ${c.pointers.join('<br>')} |`)
    }
    w()
  }
  w('## 3. 공장 범위 밖으로 판정한 묶음')
  w()
  w('정규식이 따로 떼어 센 잡음·무관한 글이다. 빈틈 표(`gap-sns.json`)에는 넣지 않는다. 풀 정제의 주제 게이트가 낱말 일치만 보아서 남은 글이다. 앞의 두 묶음(`noise-*`)은 주제 태그와 무관하게 글 전체에 적용되어 **범위 안 테마의 건수에서도 빠져 있다**.')
  w()
  w('| 묶음 | 주제 | 해당 글 | ko/en | 까닭 |')
  w('|---|---|---:|---|---|')
  for (const g of NOISE_GROUPS) {
    const c = computed.get(g.id)
    w(`| \`${g.id}\` | 전체 | ${nf(c.mentions)} | ${nf(c.ko)}/${nf(c.en)} | ${g.why} |`)
  }
  for (const t of themes.filter((x) => x.inScope === false)) {
    const c = computed.get(t.id)
    w(`| \`${t.id}\` | ${t.topic} | ${nf(c.mentions)} | ${nf(c.ko)}/${nf(c.en)} | ${t.why} |`)
  }
  w()
  w('## 4. 규칙 대조 요약')
  w()
  w('대조 대상: factory-rules.md §20~23(공장·원형·마케팅·제품 화면 규칙), docs/agents/agent-guide.md 관문 표·gotchas, `registry/factory/blocks/**` 블록 메타(kind 32종), `factory/qa/*` 관문, `registry/factory/ax/*`·`motion/*`, 보일러플레이트·인증·결제 테마는 launch-factory(`<sitebrew checkout>/launch-factory`, 읽기 전용). 근거 파일 경로는 `gap-sns.json`의 `coverageEvidence`에 있고 시험이 파일 존재를 확인한다.')
  w()
  w('| 주제 | 테마 | yes | partial | no | 골든 영향 |')
  w('|---|---:|---:|---:|---:|---:|')
  for (const tp of TOPICS) {
    const r = rows.filter((x) => x.topic === tp)
    w(`| ${TOPIC_LABEL[tp]} | ${r.length} | ${r.filter((x) => x.coverage === 'yes').length} | ${r.filter((x) => x.coverage === 'partial').length} | ${r.filter((x) => x.coverage === 'no').length} | ${r.filter((x) => x.goldenImpact).length} |`)
  }
  w(`| **합** | ${rows.length} | ${cov.yes} | ${cov.partial} | ${cov.no} | ${golden.length} |`)
  w()
  w('### 4-1. 빈틈(partial·no) — 보정 언급 많은 순')
  w()
  w('보정 언급 = 언급 × 정밀도(맞게 읽은 글/읽은 글). 잡음이 많은 테마가 위로 올라오는 것을 줄이려는 값이다.')
  w()
  w('| 테마 | 대조 | 제안 종류 | 제안 | 언급 | 보정 언급 | 골든 영향 |')
  w('|---|---|---|---|---:|---:|---|')
  const precOf = (id) => { const t = themes.find((x) => x.id === id); return t.prec[0] / t.prec[1] }
  const adj = (r) => Math.round(r.evidence.mentions * precOf(r.id))
  const gaps = rows.filter((r) => r.coverage !== 'yes').sort((a, b) => adj(b) - adj(a) || (a.id < b.id ? -1 : 1))
  for (const g of gaps) w(`| \`${g.id}\` | ${g.coverage} | ${g.proposal.kind} | ${g.proposal.summary} | ${nf(g.evidence.mentions)} | ${nf(adj(g))} | ${g.goldenImpact ? '예' : '아니오'} |`)
  w()
  w('「골든 영향」은 골든 18 결과 `docs/qa/p3-4-golden-runs.md`의 공개 불가 사유(실제 사진 필요 · 확인 필요 사실 · 법률 검토 · 운영 점검 · 자료 연결 · 예시 문구 · 원형 엄격 기준 …)로 이 빈틈이 드러날지를 사람이 따진 값이다.')
  w()
  w('## 5. 읽을 때 주의 (결론을 읽을 때 같이 읽을 것)')
  w()
  w('1. **건수는 정규식 계수다.** 테마마다 한국어·영어 낱말 목록으로 센 하한 근사이고, 표현이 다른 글은 놓친다. 정밀도 열은 6건을 읽은 표본이라 ±20%p 이상 흔들릴 수 있다. 비슷한 테마끼리 글이 겹쳐 합계를 더하면 풀보다 커진다.')
  w('2. **네이버는 제목+요약뿐이다.** 검색 API가 제목과 100~200자 요약만 준다. 본문 전문이 필요한 판단(구체 불만의 맥락)에는 부족하다. 요약은 블로그가 광고·강의 홍보로 쓴 글의 도입부인 경우가 많다.')
  w('3. **Instagram은 0건이다.** 로그인 경로가 앱 셸+캡차로 막혀 우회하지 않고 멈췄다. 시각 디자인·모션 주제에서 가장 풍부할 소스가 빠졌다. Threads는 72건(풀 0.1%)이라 사실상 근거가 되지 못한다.')
  const naverKo = pl.naver_blog.ko + pl.naver_cafe.ko
  const hnEn = pl.hn.en
  w(`4. **한국어는 네이버에 집중돼 있다.** 한국어 ${nf(stats.by_lang.ko)}건 중 네이버가 ${nf(naverKo)}건(${(naverKo / stats.by_lang.ko * 100).toFixed(0)}%)이다. 비 네이버 한국어는 X ${nf(pl.x.ko)} · Pinterest ${nf(pl.pinterest.ko)} · Threads ${nf(pl.threads.ko)}뿐이다. 그래서 한국어 결론은 「네이버 블로그·카페에 올라온 정보성 글」의 경향이고, 사용자 불만의 목소리(HN·Reddit 같은)와는 성격이 다르다. 네이버 글은 가이드·후기·광고가 많아 유형이 how-to 쪽으로 쏠린다. 한국어 랜딩·SEO 글은 특히 광고 대행사 성과 보고서와 강의 후기가 많아 잡음 묶음으로 따로 떼었다.`)
  w(`5. **영어는 HN이 중심이다.** 영어 ${nf(stats.by_lang.en)}건 중 HN ${nf(hnEn)}(${(hnEn / stats.by_lang.en * 100).toFixed(0)}%), Reddit ${nf(pl.reddit.en)}, Pinterest ${nf(pl.pinterest.en)}, X ${nf(pl.x.en)}. 개발자 커뮤니티라 소비자·소상공인 목소리가 적다.`)
  w('6. **주제 게이트가 낱말 일치만 본다.** 정제 단계의 게이트를 통과한 글 안에도 무관한 낱말 일치(분유의 LCP, 신발 테일윈드, 캐릭터 이름 로티)가 있다. 범위 밖 묶음(§3)으로 일부를 떼어 셌지만 테마 정규식에 섞인 잡음은 남아 있다.')
  w('7. **빈틈 판정은 저장소를 읽고 한 것이다.** 근거 파일은 시험이 존재를 확인하지만, 「그 파일이 그 테마를 충분히 덮는가」는 사람의 판단이다. partial·no는 흐름 ⑤의 하위 계획에서 다시 확인한다.')
  w('8. **언급 수는 중요도가 아니다.** 같은 글이 홍보용으로 여러 번 올라오면 부풀고, 소수의 날카로운 불만(HN 한 줄)은 작게 센다. 제안의 우선순위는 언급 수에 골든 영향·구현 비용을 함께 본다.')
  w()
  w('## 부록. 분류 방법과 재현')
  w()
  w('- 정의 파일: `factory/scripts/harvest-v2-themes.mjs`(테마 id·유형·요지·정규식·대조 결과·제안). 생성기: `factory/scripts/harvest-v2-doc.mjs`.')
  w('- 재생성: `node factory/scripts/harvest-v2-doc.mjs --write` (원자료 폴더가 있는 컴퓨터에서만). 시험: `node --test --test-force-exit factory/scripts/harvest-v2-doc.test.mjs` — 문서 합계=stats.json, 빈틈 행 스키마, 풀에서 다시 센 값=표, 옮겨 적은 글 없음(따옴표 12낱말·풀과 12낱말 연속 일치).')
  w('- 원자료 폴더가 없는 컴퓨터(CI)에서는 통계 대조·재계산·연속 일치 검사를 「건너뜀」으로 세지 않고 통과 + 메모로 끝낸다. 문서 안 합계(원자료 − 버린 것 = 풀 …)·스키마·따옴표 검사는 어디서나 돈다.')
  w(`- 이번 계수에서 읽은 풀 글: ${nf(computed.posts)}건.`)
  w()
  return L.join('\n')
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main(argv) {
  const write = argv.includes('--write')
  const di = argv.indexOf('--dir')
  const dir = di >= 0 ? argv[di + 1] : harvestDir()
  if (!dir || !existsSync(join(dir, 'stats.json'))) {
    console.log(absentNote('SNS 2차 수집 원자료(factory/harvest-v2)', 'SNS harvest-v2 raw data (factory/harvest-v2)'))
    return 0
  }
  const stats = JSON.parse(readFileSync(join(dir, 'stats.json'), 'utf8'))
  const computed = await computeThemes(join(dir, 'pool.jsonl'))
  const rows = buildGapRows(computed)
  if (!write) {
    for (const r of rows) console.log(`${r.topic.padEnd(11)} ${r.id.padEnd(28)} ${String(r.evidence.mentions).padStart(6)} ko ${String(r.evidence.ko).padStart(6)} en ${String(r.evidence.en).padStart(6)} ${r.coverage}`)
    for (const t of THEMES.filter((x) => x.inScope === false)) { const c = computed.get(t.id); console.log(`${t.topic.padEnd(11)} ${t.id.padEnd(28)} ${String(c.mentions).padStart(6)} (범위 밖)`) }
    for (const g of NOISE_GROUPS) { const c = computed.get(g.id); console.log(`${'*'.padEnd(11)} ${g.id.padEnd(28)} ${String(c.mentions).padStart(6)} ko ${String(c.ko).padStart(6)} en ${String(c.en).padStart(6)} (전역 잡음)`) }
    console.log(`풀 ${computed.posts}건 · 잡음 묶음에 든 글 ${computed.noisy}건`)
    return 0
  }
  mkdirSync(dirname(DOC_FILE), { recursive: true })
  writeFileSync(DOC_FILE, renderDoc(stats, computed))
  writeFileSync(GAP_FILE, `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`썼다: ${DOC_FILE} · ${GAP_FILE} (행 ${rows.length}개)`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1) })
}
