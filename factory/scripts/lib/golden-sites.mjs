// 골든 20 × 방향 3안의 06 출력(정적, install: false)을 만드는 시험 공용 재료(FINAL-WF6).
//   01~03 은 실제 찍어내기(runGolden --until 03 — 03 고름이 안마다 실제와 같다), 04 는 「스키마의 모든 칸이 찬 콘텐츠」(binding-audit maxContent) + 요청이 정한 문구 칸,
//   06 은 실제 generateSite 다. 빌드·Chrome 은 쓰지 않는다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { goldenSet, runGolden } from '../../stamp/golden.mjs'
import { contentRequest, PLACEHOLDER } from '../../stamp/content.mjs'
import { maxContent } from '../../stamp/binding-audit.mjs'
import { generateSite } from '../../stamp/gen-pages.mjs'
import { uiSlotTable } from '../../stamp/ui-copy.mjs'
import { archetypes, text } from './stamp-site-fixtures.mjs'

const readData = (dir, cand, step) => JSON.parse(readFileSync(join(dir, cand, `${step}.json`), 'utf8')).data

/**
 * 골든 하나의 후보 a·b·c 06 출력을 만든다. → [{ id, cand, siteDir }] (실패한 후보는 error 가 붙는다)
 * @param {string} tmp  실행 폴더를 만들 부모
 */
export async function goldenSites(tmp, id, { stamp, deps }) {
  mkdirSync(tmp, { recursive: true })
  const runDir = join(tmp, `g-${id}`)
  await runGolden(id, { until: '03', runDir, deps: { ...deps, doctor: async () => ({ ok: true, results: [] }) }, stamp })
  const g = goldenSet().find((e) => e.id === id)
  const out = []
  for (const c of ['a', 'b', 'c']) {
    const cand = readData(runDir, c, '01-direction')
    const sitemap = readData(runDir, c, '02-sitemap')
    const variants = readData(runDir, c, '03-variants')
    const uiSlots = await uiSlotTable(Object.values(variants))
    const request = contentRequest(cand, sitemap, { [c]: variants }, g.seed, { archetype: archetypes[g.archetype], brief: g.brief, uiSlots })
    writeFileSync(join(runDir, c, '04-content.request.json'), JSON.stringify(request))
    const content = maxContent(g.archetype, g.brief.locale)
    content.slots = { copy: request.slots.map((s) => ({ id: s.id, role: s.role, text: Array.from(text(s, PLACEHOLDER.ko)).slice(0, s.maxChars ?? 999).join('') })), images: [] }
    content.facts = { ...request.seedContent.facts }
    writeFileSync(join(runDir, c, '04-content.json'), JSON.stringify({ inputHash: 'golden-sites', producedAt: '', data: content }))
    try {
      const r = await generateSite(runDir, cand, { install: false })
      out.push({ id, cand: c, siteDir: r.siteDir })
    } catch (e) { out.push({ id, cand: c, siteDir: null, error: String(e.message).slice(0, 300) }) }
  }
  return out
}
