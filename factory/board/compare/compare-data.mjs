// 보드 자료 → 대시보드 자료(v0.2.6 T4). 순수 함수: 파일·프로세스를 만지지 않는다(그건 serve.mjs). page.mjs 의 CompareData 를 만든다.
// 칸마다 「있는 것만」 싣는다 — 사실이 없는 칸은 비워 두고 지어내지 않는다. 에이전트가 쓰는 notes.json({ "<id>": { name?, kind?, thesis?, msg?, act?, sig?, logo?, risk? } })이 있으면 그것이 이긴다.
import { splitBlockers } from '../../stamp/blocker-class.mjs'

const SLOT_LABEL = { safe: '무난한 안', new: '새 조합 안', bold: '과감한 안' }
const SOURCE_LABEL = { library: '검증된 레시피', generated: '생성 레시피', brand: '브랜드 레시피' }
const ROW_KEYS = ['msg', 'act', 'sig', 'logo', 'risk']
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** 레시피 머리의 라이트 색에서 칩 셋(바탕·주색·강조)을 #hex 로. toHex 는 oklch → #hex 변환(주입). 읽지 못하면 빈 배열. */
export function swatchesOf(head, toHex) {
  const light = head?.color?.light
  if (!light) return []
  return ['background', 'primary', 'accent'].flatMap((k) => {
    const v = light[k]
    if (typeof v !== 'string') return []
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return [v]
    try { return [toHex(v)] } catch { return [] }
  })
}

const fontsLabel = (f) => (f ? [f.display, f.body].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · ') : undefined)

/**
 * @param {{ board: object, notes?: object, origins: Record<string,string>, fallbackImgs?: Record<string,string>, routes: {path:string,label:string}[],
 *           heads?: Record<string,object|null>, extras?: Record<string,{aiTell?:number|null}>, toHex: (v:string)=>string, sampleLeft?: number }} o
 *   board = loadBoardData 결과 · origins = 띄운 후보의 중계 출처 · fallbackImgs = 못 띄운 후보의 사진 주소(대시보드 기준 상대 주소)
 */
export function buildCompareData({ board, notes = {}, origins, fallbackImgs = {}, routes, heads = {}, extras = {}, toHex, sampleLeft }) {
  const candidates = board.cands.map((c) => {
    const n = notes[c.id] ?? {}
    const { quality, input } = splitBlockers(c.blockers)
    const ai = extras[c.id]?.aiTell
    const row = Object.fromEntries(ROW_KEYS.flatMap((k) => (text(n[k]) ? [[k, text(n[k])]] : [])))
    return {
      id: c.id,
      name: text(n.name) ?? `${c.id.toUpperCase()} · ${SLOT_LABEL[c.slot] ?? SOURCE_LABEL[c.source] ?? c.source}`,
      kind: text(n.kind) ?? (c.aiPick ? `${SOURCE_LABEL[c.source]} · AI 추천` : SOURCE_LABEL[c.source]),
      ...(origins[c.id] ? { origin: origins[c.id] } : {}),
      ...(fallbackImgs[c.id] ? { fallbackImg: fallbackImgs[c.id] } : {}),
      head: {
        thesis: text(n.thesis) ?? text(c.head?.thesis) ?? text(c.why),
        palette: swatchesOf(heads[c.id], toHex),
        fonts: fontsLabel(c.fonts),
        colorStrategy: text(c.head?.colorStrategy) ?? text(heads[c.id]?.colorLogic),
      },
      badges: { ...(Number.isInteger(ai) ? { aiTell: ai } : {}), qualityN: quality.length, inputN: input.length },
      blockers: { quality, input },
      row,
    }
  })
  return {
    run: board.run,
    title: `${board.run} · 시안 ${candidates.length}개 비교`,
    briefLine: board.brief ? `주제: ${board.brief}${board.archetype ? ` · 원형: ${board.archetype}` : ''}` : undefined,
    routes, candidates, scaleNote: true, ...(Number.isInteger(sampleLeft) ? { sampleLeft } : {}),
  }
}

/** 02-sitemap 쪽 목록 → 버튼용 쪽 목록. 법정 쪽은 뺀다(너무 길어진다). labelOf(id) 로 이름표를 얻고 없으면 id. 후보마다 쪽이 다르면 모두에 있는 쪽만. */
export function commonRoutes(sitemaps, labelOf = (id) => id, { max = 8 } = {}) {
  const lists = sitemaps.filter(Boolean).map((s) => (s.pages ?? []).filter((p) => !p.legal && typeof p.route === 'string' && p.route.startsWith('/')))
  if (!lists.length) return [{ path: '/', label: labelOf('home') }]
  const [first, ...rest] = lists
  const keep = first.filter((p) => rest.every((l) => l.some((q) => q.route === p.route)))
  const out = (keep.length ? keep : [{ id: 'home', route: '/' }]).slice(0, max)
  return out.map((p) => ({ path: p.route, label: labelOf(p.id) }))
}
