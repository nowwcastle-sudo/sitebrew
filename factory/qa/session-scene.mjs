// 세션 장면(UXGATE1 · G1) — 모든 CDP 관문이 「로그인한 화면」을 같은 말로 잰다.
// 쓰는 법: 어느 관문이든 `--session <장면>` 을 붙인다(환경 변수 WF_SESSION 도 같다. 인자가 앞선다).
//   signed-out                      세션 없음(쿠키를 지운다)
//   signed-in                       로그인 · 이메일 확인됨 · 구독은 앱 기본값
//   signed-in:sub=<상태>            로그인 + 구독 상태. 상태 = none|trialing|active|past_due|paused|canceled|expired|pending-price-change
//   signed-in:unverified            로그인 · 이메일 확인 전
//   (뒤 두 가지는 이어 붙일 수 있다: signed-in:unverified:sub=trialing)
// 어떻게 닿나 — 두 길을 같이 쓴다. 기본값(인자 없음)은 코드가 한 줄도 달라지지 않는다.
//   ① 쿠키 `wf_session`(값 = 정규화한 장면 문자열을 encodeURIComponent 한 것)을 CDP Network.setCookie 로 그 주소의 출처에 심는다.
//      조립한 앱(launch-factory mock 모드)은 이 쿠키를 읽어 세션을 만들어야 한다 — 계약은 docs/qa/p3-6-uxgates.md §계약.
//   ② 블록 갤러리(`/qa/blocks`)는 이미 `?auth=` `?sub=` 장면 쿼리가 있다 — 주소에 그 키가 없을 때만 덧붙인다(주소에 적은 값이 이긴다).
// 이 모듈은 Chrome 이 필요 없다(순수 함수) — cdp.mjs 가 불러 쓴다.

export const COOKIE_NAME = 'wf_session'
// adapter-mock.ts MOCK_SUBS + MOCK_SUB_SCENARIOS 와 같아야 한다(session-scene.test.mjs 가 소스와 맞는지 본다).
export const SUBS = ['none', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired', 'pending-price-change']

// 장면 문자열 → { signedIn, sub, unverified, canonical }. 모르는 장면이면 던진다(인자 오류).
export function parseScene(raw) {
  const text = String(raw ?? '').trim()
  const [head, ...mods] = text.split(':')
  if (head === 'signed-out') {
    if (mods.length) throw new Error(`signed-out 에는 덧붙일 수 없다: ${text}`)
    return { signedIn: false, sub: null, unverified: false, canonical: 'signed-out' }
  }
  if (head !== 'signed-in') throw new Error(`모르는 세션 장면: ${JSON.stringify(text)} (signed-out · signed-in · signed-in:sub=<상태> · signed-in:unverified)`)
  let sub = null
  let unverified = false
  for (const m of mods) {
    if (m === 'unverified') { unverified = true; continue }
    const mm = /^sub=(.+)$/.exec(m)
    if (mm) {
      if (!SUBS.includes(mm[1])) throw new Error(`모르는 구독 상태: ${JSON.stringify(mm[1])} (${SUBS.join('|')})`)
      sub = mm[1]
      continue
    }
    throw new Error(`모르는 세션 장면 조각: ${JSON.stringify(m)} (sub=<상태> · unverified)`)
  }
  const canonical = ['signed-in', ...(unverified ? ['unverified'] : []), ...(sub ? [`sub=${sub}`] : [])].join(':')
  return { signedIn: true, sub, unverified, canonical }
}

// argv 에서 `--session <장면>` · `--session=<장면>` 을 떼어 낸다(제자리 수정 — 관문마다 위치 인자를 세는 방식이 달라서 flag 가 남으면 깨진다).
// 돌려주는 값: 장면 문자열 | null. 환경 변수 WF_SESSION 이 있고 인자가 없으면 그것. 비어 있는 값이면 던진다.
export function extractSessionArg(argv, env = {}) {
  let found = null
  for (let i = 2; i < argv.length; ) {
    const a = argv[i]
    if (a === '--session') {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error('--session 에 장면이 없다')
      found = argv[i + 1]
      argv.splice(i, 2)
    } else if (a.startsWith('--session=')) {
      found = a.slice('--session='.length)
      argv.splice(i, 1)
    } else i++
  }
  const raw = found ?? (env.WF_SESSION ? env.WF_SESSION : null)
  return raw === null || raw === '' ? null : raw
}

// 쿠키 계획: signed-out 은 지운다(null), 아니면 { name, value }.
export function sceneCookie(raw) {
  const s = parseScene(raw)
  return s.signedIn ? { name: COOKIE_NAME, value: encodeURIComponent(s.canonical) } : null
}

// 갤러리 장면 쿼리. unverified 는 갤러리 목(mockAuth)에 없는 사용자라 쿼리로 옮길 수 없다 — 쿠키만 간다(문서 §한계).
export function sceneQuery(raw) {
  const s = parseScene(raw)
  const q = { auth: s.signedIn ? 'signed-in' : 'signed-out' }
  if (s.sub) q.sub = s.sub
  return q
}

// 주소에 갤러리 장면 쿼리를 덧붙인다. 갤러리(`/qa/blocks`)가 아니면 그대로, 주소가 이미 가진 키는 건드리지 않는다.
export function sceneUrl(url, raw) {
  let u
  try { u = new URL(url) } catch { return url }
  if (!/^https?:$/.test(u.protocol) || !(u.pathname === '/qa/blocks' || u.pathname.startsWith('/qa/blocks/'))) return url
  for (const [k, v] of Object.entries(sceneQuery(raw))) if (!u.searchParams.has(k)) u.searchParams.set(k, v)
  return u.href
}

// Chrome 에 장면을 건다: 쿠키를 심거나 지우고, 갤러리 쿼리를 덧붙인 주소를 돌려준다. file:·about: 주소는 쿠키를 둘 출처가 없어 그대로 둔다.
// send 는 cdp.mjs 의 send(호출마다 기한). 쿠키가 실제로 들어갔는지 응답을 본다 — 못 심으면 「로그인 안 한 화면」을 잰 채 통과하므로 도구 실패다.
export async function applyScene(send, url, raw) {
  const cookie = sceneCookie(raw)
  let origin = null
  try { const u = new URL(url); if (/^https?:$/.test(u.protocol)) origin = u.origin + '/' } catch {}
  if (origin) {
    // Network 도메인을 켠 뒤에만 쿠키 호출이 답한다 — 켜지 않으면 headless Chrome 에서 Network.setCookie 가 끝내 답하지 않았다(UXGATE1 실측: 45초 기한까지 멈춤, 켠 뒤 2ms).
    // 켜 두기만 한다(끄지 않는다 — 도구가 이미 켠 Network 를 꺼 버리지 않게). 장면이 없으면 이 함수를 부르지 않으므로 기본 동작은 그대로다.
    await send('Network.enable')
    if (cookie) {
      const r = await send('Network.setCookie', { name: cookie.name, value: cookie.value, url: origin, path: '/', sameSite: 'Lax' })
      if (r?.error || r?.result?.success === false) throw new Error(`세션 쿠키를 심지 못했다(${origin}): ${r?.error?.message ?? 'success=false'}`)
    } else {
      const r = await send('Network.deleteCookies', { name: COOKIE_NAME, url: origin })
      if (r?.error) throw new Error(`세션 쿠키를 지우지 못했다(${origin}): ${r.error.message}`)
    }
  }
  return sceneUrl(url, raw)
}
