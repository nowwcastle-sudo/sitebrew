// 뒤로 가기 캐시(bf-cache) 복원 시험(factory v1 Task 5.10 · 골든 12.8 — dashboard-1 `/privacy`·public-1 `/`·public-2 `/` 가 「복원 도중 이동이 취소됨」으로 실패).
//   measureBfCache(url, { chrome? }) → { restored, reasons[{ type, reason }], persisted, marker }
//
// Lighthouse bf-cache 감사와 같은 순서로 재되, 이유를 Chrome 이 직접 알려 주는 CDP 이벤트 `Page.backForwardCacheNotUsed` 에서 읽는다:
//   쪽 열기 → 표지를 심는다 → about:blank 로 떠난다 → 기록에서 뒤로 간다 → 복원됐는가.
//   복원됨 = 뒤로 온 문서에 표지가 그대로 있다(새 문서면 사라진다) · `pageshow.persisted` 도 함께 읽는다.
//   복원 안 됨 = 이벤트의 `notRestoredExplanations[].reason`(예: UnloadHandlerExistsInMainFrame · NavigationCancelledWhileRestoring · MainResourceHasCacheControlNoStore).
// leaveUrl·leavePauseMs: 떠나는 쪽과 머무는 시간 — Lighthouse 는 chrome://terms 로 떠나 load 뒤 100ms 만 머문다(node_modules/lighthouse/core/gather/gatherers/bf-cache-failures.js).
// 브라우저는 부르는 쪽이 준다(`chrome` — startChrome 결과). 주지 않으면 이 함수가 하나 띄웠다 트리째 닫는다.
import { closeChrome, connect, navigateAndWait, startChrome } from './cdp.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** `Page.backForwardCacheNotUsed` 이벤트 → 이유 목록(트리의 하위 프레임 이유도 평평하게). */
export function reasonsOf(params) {
  const out = []
  const walk = (list) => { for (const e of list ?? []) out.push({ type: e.type, reason: e.reason, ...(e.context ? { context: e.context } : {}) }) }
  walk(params?.notRestoredExplanations)
  const tree = (node) => { if (!node) return; walk(node.explanations); for (const c of node.children ?? []) tree(c) }
  tree(params?.notRestoredExplanationsTree)
  const seen = new Set()
  return out.filter((r) => { const k = `${r.type}/${r.reason}/${r.context ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true })
}

export async function measureBfCache(url, { chrome: given, settleMs = 1500, restoreWaitMs = 4000, leaveUrl = 'about:blank', leavePauseMs = 500, onStage = () => {} } = {}) {
  const chrome = given ?? (await startChrome([], { prefix: 'bfcache-' }))
  let cdp
  try {
    const events = []
    cdp = await connect(chrome.wsUrl, { onEvent: (d) => { if (d.method === 'Page.backForwardCacheNotUsed') events.push(d.params) } })
    await cdp.send('Page.enable')
    onStage('open')
    const nav = await navigateAndWait(cdp.send, cdp.ev, url, { timeoutMs: 20000 })
    if (nav?.result?.errorText) throw new Error(`도구 실패: ${url} 를 열지 못했다(${nav.result.errorText})`)
    await sleep(settleMs) // 하이드레이션·글꼴·지연 스크립트가 끝나게 — Lighthouse 도 load 뒤에 떠난다
    await cdp.ev(`window.__wfBfMarker = "alive-" + Math.random().toString(36).slice(2); window.__wfPersisted = null; addEventListener("pageshow", (e) => { window.__wfPersisted = e.persisted }); window.__wfBfMarker`)
    const marker = await cdp.ev('window.__wfBfMarker')
    onStage('leave')
    await navigateAndWait(cdp.send, cdp.ev, leaveUrl, { timeoutMs: 20000 })
    await sleep(leavePauseMs)
    const hist = (await cdp.send('Page.getNavigationHistory')).result
    const back = hist.entries[hist.currentIndex - 1]
    if (!back || new URL(back.url).href !== new URL(url).href) throw new Error(`도구 실패: 기록에서 뒤로 갈 쪽을 못 찾았다(${back?.url ?? '없음'})`)
    onStage('back')
    await cdp.send('Page.navigateToHistoryEntry', { entryId: back.id })
    // 복원이면 표지가 살아 있다. 아니면 새 문서 — 이벤트가 오거나 표지가 사라지는 것으로 안다.
    const deadline = Date.now() + restoreWaitMs
    let state = { alive: null, persisted: null }
    while (Date.now() < deadline) {
      await sleep(150)
      state = { alive: await cdp.ev('window.__wfBfMarker ?? null').catch(() => null), persisted: await cdp.ev('window.__wfPersisted ?? null').catch(() => null) }
      if (events.length || state.alive === marker) break
    }
    const restored = state.alive === marker
    return { restored, persisted: state.persisted, marker: state.alive, reasons: restored ? [] : events.flatMap(reasonsOf) }
  } finally {
    try { cdp?.ws.close() } catch {}
    if (!given) await closeChrome(chrome)
  }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const url = process.argv[2]
  const times = Number(process.argv[3] ?? 1)
  const lh = process.argv[4] === 'lighthouse' // Lighthouse 와 같은 떠남(chrome://terms, 100ms)
  if (!url) { console.error('사용: node factory/qa/bfcache.mjs <url> [횟수]'); process.exit(2) }
  const chrome = await startChrome([], { prefix: 'bfcache-' })
  try {
    for (let i = 0; i < times; i++) {
      const r = await measureBfCache(url, { chrome, ...(lh ? { leaveUrl: 'chrome://terms', leavePauseMs: 100, restoreWaitMs: 1500 } : {}) })
      console.log(`${i + 1}/${times} ${r.restored ? '복원됨' : '복원 안 됨'} ${r.reasons.map((x) => x.reason).join(', ')}`)
    }
  } finally { await closeChrome(chrome) }
}
