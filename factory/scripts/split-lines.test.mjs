// 대장 FB9(운영자 판정 10-03 「가마 글자가 줄바꿈이 되는데 맞아?」): 글자·낱말 쪼개기(SplitText — splitReveal·kineticType)가 줄바꿈을 바꾸지 않는다.
// 원인(실측): 쪼갠 낱말·글자가 inline-block(원자 요소)이 되면 text-wrap: balance 가 꺼져 줄이 앞에서부터 채워진다 → 쪼갰다 되돌릴 때 낱말이 줄을 넘나든다(「가마를」).
// 고침: gsap-techniques.ts splitKeepLines — 쪼개기 전 줄 구성을 재고 쪼갠 뒤 줄 첫 낱말 앞에 <br> 를 넣는다.
// 이 시험은 진짜 함수(원천 TS 를 transpile 해 그대로)를 Chrome 에 넣어, 한국어·영어 제목 × 폭 여럿에서
//   ① 쪼갠 상태(글자+마스크·글자·낱말)의 줄 구성 = 안 쪼갠 상태의 줄 구성, ② 낱말 중간 줄바꿈 0, ③ revert 뒤 <br> 가 남지 않는다 를 잰다.
// 음성 대조: 같은 표에서 고침 없이 SplitText.create 만 쓰면 줄 구성이 어긋나는 칸이 있어야 한다(없으면 이 표가 아무것도 못 재는 것이라 실패).
// 실행: node --test --test-force-exit --test-timeout=180000 factory/scripts/split-lines.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { startChrome, connect, navigateAndWait } from '../qa/cdp.mjs'
import { root } from './lib/stamp-site-fixtures.mjs'

const SRC = readFileSync(join(root, 'registry', 'factory', 'motion', 'gsap-techniques.ts'), 'utf8')
const start = SRC.indexOf('const wordTops')
assert.ok(start >= 0 && SRC.indexOf('export function splitKeepLines') > start, 'wordTops·splitKeepLines 를 못 찾았다')
const end = SRC.indexOf('\n}\n', SRC.indexOf('export function splitKeepLines')) + 2
const FN = ts.transpileModule(SRC.slice(start, end).replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

const TITLES = [
  ['ko', '다음 썰물에 가마를 함께 열어요'],
  ['ko', '다음 썰물에는 가마를 함께 열고 첫 그릇을 꺼내 보세요'],
  ['ko', '바다가 정한 시간에만 가마에 불을 넣고 굽습니다'],
  ['ko', '견적서를 가장 빠르게 보내는 방법을 알려 드려요'],
  ['en', 'Twelve blends from our two family gardens'],
  ['en', 'Extraordinarily handcrafted infusions poured daily'],
]
const WIDTHS = [260, 300, 335, 375, 420, 480, 560, 640, 760, 900, 1100, 1376]
const SIZES = [44, 72, 115]

const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
html:lang(ko),:lang(ko){word-break:keep-all;overflow-wrap:anywhere}
body{margin:0;font-family:"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR",sans-serif}
.wrap{display:flex;flex-direction:column;align-items:flex-start;box-sizing:border-box}
h2{margin:0;max-width:100%;line-height:.95;letter-spacing:-.03em;text-wrap:balance}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
</style></head><body><div class="wrap" id="wrap"><h2 id="h"><span class="sr-only"></span><span aria-hidden="true" data-wf-split id="t"></span></h2></div>
<script src="${pathToFileURL(join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js'))}"></script>
<script src="${pathToFileURL(join(root, 'node_modules', 'gsap', 'dist', 'SplitText.min.js'))}"></script>
<script>${FN}
gsap.registerPlugin(SplitText)
// 가장자리: ① 평소엔 br 가 들어간다 ② 글꼴이 아직 오는 중이면 안 넣는다 ③ 고정한 뒤 창 폭이 바뀌면 풀린다 ④ revert 가 끝나면 리스너가 남지 않는다
window.edge = async () => { try { return await edgeRun() } catch (e) { return JSON.stringify({ error: String(e.stack || e) }) } }
window.edgeRun = async () => {
  const wrap = document.getElementById('wrap'), h = document.getElementById('h'), node = document.getElementById('t')
  h.lang = 'ko'; wrap.style.width = '760px'; h.style.fontSize = '72px'; h.style.fontFamily = ''
  const title = '다음 썰물에는 가마를 함께 열고 첫 그릇을 꺼내 보세요'
  const fresh = () => { node.textContent = title; h.firstChild.textContent = title }
  const brs = () => node.querySelectorAll('br[data-wf-br]').length
  const out = {}
  fresh(); let sp = splitKeepLines(node, { type: 'words,chars', aria: 'none' }); out.normal = brs()
  window.dispatchEvent(new Event('resize')); out.afterResize = brs(); sp.revert()
  fresh(); sp = splitKeepLines(node, { type: 'words,chars', aria: 'none' }); out.again = brs(); sp.revert(); out.afterRevert = brs()
  const slow = new FontFace('SlowProbe', 'url(about:blank)'); document.fonts.add(slow)
  h.style.fontFamily = 'SlowProbe, sans-serif'; fresh()
  slow.load().catch(() => {}); out.slowCheck = document.fonts.status === 'loading'
  sp = splitKeepLines(node, { type: 'words,chars', aria: 'none' }); out.unsettled = brs(); await document.fonts.ready.catch(() => {}); await new Promise((r) => setTimeout(r, 50)); out.afterSettle = brs(); sp.revert(); document.fonts.delete(slow)
  return JSON.stringify(out)
}
window.run = (cases) => {
  const wrap = document.getElementById('wrap'), h = document.getElementById('h'), node = document.getElementById('t')
  const rows = (items) => { const m = new Map(); for (const i of items) (m.get(i.top) || m.set(i.top, []).get(i.top)).push(i.word); return [...m.values()].map((v) => v.join(' ')) }
  const out = []
  for (const [lang, title, width, size] of cases) {
    h.lang = lang; wrap.style.width = width + 'px'; h.style.fontSize = size + 'px'
    node.textContent = title; h.firstChild.textContent = title
    // 안 쪼갠 상태: 낱말마다 첫 글자 Range 의 top
    const words = []
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode(); t; t = w.nextNode()) for (const m of t.data.matchAll(/\\S+/g)) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + 1); words.push({ word: m[0], top: Math.round(r.getBoundingClientRect().top) }) }
    const base = rows(words)
    const measure = (sp) => {
      const ws = sp.words.map((el) => ({ word: el.textContent, top: Math.round(el.getBoundingClientRect().top) }))
      const mid = sp.chars ? sp.words.filter((el) => new Set(sp.chars.filter((c) => el.contains(c)).map((c) => Math.round((c.parentElement.style.overflow === 'clip' ? c.parentElement : c).getBoundingClientRect().top))).size > 1).map((el) => el.textContent) : []
      return { lines: rows(ws), mid }
    }
    const variants = { 'chars+mask': { type: 'words,chars', mask: 'chars' }, chars: { type: 'words,chars' }, words: { type: 'words' } }
    const rec = { lang, title, width, size, base, fixed: {}, plain: {} }
    for (const [name, vars] of Object.entries(variants)) {
      const a = splitKeepLines(node, { ...vars, aria: 'none' }); rec.fixed[name] = measure(a); a.revert()
      rec.leftoverBr = (rec.leftoverBr || 0) + node.querySelectorAll('br').length
      const b = SplitText.create(node, { ...vars, aria: 'none' }); rec.plain[name] = measure(b); b.revert()
    }
    out.push(rec)
  }
  return JSON.stringify(out)
}
</script></body></html>`

test('쪼개기(splitKeepLines): 한국어·영어 제목 × 폭 × 글자 크기에서 쪼갠 줄 구성 = 안 쪼갠 줄 구성, 낱말 중간 줄바꿈 0, revert 뒤 <br> 0 — 음성 대조: 고침 없는 SplitText 는 어긋나는 칸이 있다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'split-lines-'))
  const chrome = await startChrome([], { prefix: 'split-lines-' })
  let recs, edge
  try {
    const page = join(dir, 'page.html')
    writeFileSync(page, PAGE)
    const c = await connect(chrome.wsUrl)
    await c.send('Page.enable')
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false })
    await navigateAndWait(c.send, c.ev, pathToFileURL(page).href)
    await c.ev('document.fonts.ready.then(() => 1)')
    const cases = []
    for (const [lang, title] of TITLES) for (const width of WIDTHS) for (const size of SIZES) { const longest = Math.max(...title.split(' ').map((w) => w.length)); if (longest * size * (lang === 'ko' ? 1 : 0.62) < width - 8) cases.push([lang, title, width, size]) } // 가장 긴 낱말이 한 줄에 들어가는 칸만 — 안 들어가면 안 쪼갠 글도 낱말 가운데서 갈린다(overflow-wrap: anywhere)
    recs = JSON.parse(await c.ev(`window.run(${JSON.stringify(cases)})`))
    edge = JSON.parse(await c.ev('window.edge()'))
    assert.equal(edge.error, undefined, edge.error)
    c.ws.close()
  } finally {
    await chrome.close()
    rmSync(dir, { recursive: true, force: true })
  }
  assert.ok(recs.length >= 150, `칸이 너무 적다 ${recs.length}`)
  const bad = []
  let plainDiff = 0
  let multiLine = 0
  for (const r of recs) {
    if (r.base.length > 1) multiLine++
    for (const name of ['chars+mask', 'chars', 'words']) {
      const f = r.fixed[name], p = r.plain[name]
      if (JSON.stringify(f.lines) !== JSON.stringify(r.base) || f.mid.length) bad.push(`${r.lang} ${r.width}px/${r.size}px ${name} ${JSON.stringify(r.title)}: 안 쪼갠 ${JSON.stringify(r.base)} ≠ 쪼갠 ${JSON.stringify(f.lines)} mid=${JSON.stringify(f.mid)}`)
      if (JSON.stringify(p.lines) !== JSON.stringify(r.base) || p.mid.length) plainDiff++
    }
    if (r.leftoverBr) bad.push(`${r.lang} ${r.width}px ${JSON.stringify(r.title)}: revert 뒤 <br> ${r.leftoverBr}개`)
  }
  assert.deepEqual(bad.slice(0, 8), [], `어긋난 칸 ${bad.length}개`)
  assert.ok(multiLine >= 60, `줄이 둘 이상인 칸이 너무 적다(${multiLine}) — 표가 줄바꿈을 못 잰다`)
  assert.ok(plainDiff >= 5, `음성 대조: 고침 없는 SplitText 가 어긋난 칸이 ${plainDiff}개뿐이다 — 표가 이 결함을 못 잡는다`)
  assert.ok(edge.normal > 0, `평소에는 줄을 고정한다(br ${edge.normal})`)
  assert.equal(edge.afterResize, edge.normal, '창 폭이 바뀌면 다시 잰다(같은 폭이라 같은 자리)')
  assert.equal(edge.slowCheck, true, '시험 준비: 글꼴이 오는 중(status loading)이어야 한다')
  assert.equal(edge.unsettled, 0, '글꼴이 아직 오는 중이면 줄을 고정하지 않는다')
  assert.equal(edge.afterSettle, edge.normal, '글꼴이 도착(또는 실패)하면 그때 고정한다')
  assert.ok(edge.again > 0 && edge.afterRevert === 0, `revert 뒤 br 0(다시 ${edge.again} → ${edge.afterRevert})`)
  console.log(`split-lines: 칸 ${recs.length} · 줄이 여럿인 칸 ${multiLine} · 고침 없는 쪼개기가 어긋난 (칸×변형) ${plainDiff}`)
})

test('쪼개기 호출 자리: SplitText 를 만드는 곳은 splitKeepLines 하나뿐이다 — splitReveal·kineticType(rise·wave·scrub)·히어로 SplitText 가 모두 이 길을 지난다', () => {
  const walk = (d, out = []) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '_compiled' || e.name === 'r' || e.name === 'node_modules') continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, out)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
    }
    return out
  }
  const hits = []
  for (const f of walk(join(root, 'registry', 'factory'))) {
    for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
      if (/SplitText\.create\(|new SplitText\(/.test(line) && !/^\s*\/\//.test(line)) hits.push(`${f.slice(root.length + 1).split('\\').join('/')}:${i + 1}`)
    }
  }
  assert.equal(hits.length, 1, `SplitText 직접 호출: ${hits}`)
  assert.match(hits[0], /motion\/gsap-techniques\.ts/)
  assert.equal((SRC.match(/splitKeepLines\(node, /g) ?? []).length, 4, 'splitReveal 1 + kineticType rise·wave·scrub 3')
})
