// 외부가 알려 준 주소를 받는 유일한 길(보안 E · WF-9). 공급자(Pexels·구글 서체) 응답 JSON·CSS 가 가리키는 2차 주소를 그대로 fetch 하면
// 목적지(엉뚱한 호스트·내부망·http)·리디렉션·크기가 검증되지 않고 전체가 메모리에 쌓인다 — 이 모듈이 그 셋을 막는다.
//   safeFetch(url, { allowHosts, maxBytes, timeoutMs?, headers?, fetch?, maxRedirects? }) → { buffer, status, url } 또는 던진다.
// 규칙:
//   · https 만, 주소 안 사용자 정보(user:pass@)·기본이 아닌 포트는 거절한다.
//   · 호스트는 allowHosts 에 정확히 있거나(「images.pexels.com」), 점으로 시작하는 항목(「.example.com」)의 하위여야 한다.
//   · redirect: 'manual' — 3xx 의 Location 을 우리가 따라가며(최대 maxRedirects 번) 매 단계 https·허용 호스트를 다시 검사한다.
//     호스트가 바뀌면 Authorization·Cookie 머리는 떼고 보낸다(키가 다른 호스트로 새지 않게).
//   · 응답 content-length 가 maxBytes 를 넘으면 본문을 읽지 않고 중단, 없거나 거짓이면 스트림을 세다가 넘는 순간 중단(cancel)한다.
//     성공(2xx) 아닌 응답은 상태만 필요하므로 최대 64 KB 까지만 읽고 자른다(오류 페이지가 커도 상태 코드를 돌려준다).
//   · 오류 문장에는 쿼리 문자열·조각·사용자 정보를 싣지 않는다(bareUrl — 호스트+경로만). 키는 호출자가 maskSecrets 로 한 번 더 가린다.
// DNS 로 허용 호스트가 사설 주소를 가리키게 되는 우회는 막지 않는다 — 허용 목록이 고정 공급자 CDN 몇 개뿐이라 위험이 낮다(PR 본문 「남는 위험」).
import { Buffer } from 'node:buffer'

const MB = 1024 * 1024
const ERROR_BODY_CAP = 64 * 1024
const REDIRECT = new Set([301, 302, 303, 307, 308])

/**
 * 받기 한도. 근거:
 *  photo 25 MB  — 요청은 compress(w=2400) 주소라 보통 1~5 MB 이고, 원본(src.original, 6000×4000 안팎 JPEG)도 20 MB 를 넘는 일이 드물다.
 *  video 200 MB — pickVideoDownload 는 폭 ≤ 1920 mp4 를 고른다(Pexels HD 1080p, 길이 ≤ 약 60초 ≈ 10~100 MB). 4K 만 있는 영상은 가장 작은 것을 받는데 그것이 넘으면 던지는 게 맞다.
 *  font 2 MB    — 쪽 글자 묶음 woff2(text= 로 줄인 것)는 수십 KB, 한글 전체 면도 2 MB 안이다.
 *  json 2 MB    — Pexels 검색·항목 응답(15건 + video_files)과 구글 css2 는 수십~수백 KB.
 */
export const LIMITS = Object.freeze({ photo: 25 * MB, video: 200 * MB, font: 2 * MB, json: 2 * MB })

/** 공급자별 허용 호스트(정확히 일치). 옛 Pexels 영상 링크는 player.vimeo.com 으로 간다. */
export const HOSTS = Object.freeze({
  pexelsApi: Object.freeze(['api.pexels.com']),
  pexelsPhoto: Object.freeze(['images.pexels.com']),
  pexelsVideo: Object.freeze(['videos.pexels.com', 'player.vimeo.com']),
  googleCss: Object.freeze(['fonts.googleapis.com']),
  googleFont: Object.freeze(['fonts.gstatic.com']),
})

/** 오류 문장용 주소: 호스트+경로만(쿼리·조각·사용자 정보 없음). */
export function bareUrl(u) {
  try {
    const x = new URL(String(u))
    return `${x.protocol}//${x.host}${x.pathname}`
  } catch {
    return '(읽을 수 없는 주소)'
  }
}

const hostAllowed = (host, allowHosts) => {
  const h = host.toLowerCase()
  return allowHosts.some((a) => {
    const rule = String(a).toLowerCase()
    return rule.startsWith('.') ? h.endsWith(rule) && h.length > rule.length : h === rule
  })
}

function checkUrl(raw, allowHosts) {
  let u
  try {
    u = new URL(String(raw))
  } catch {
    throw new Error(`safeFetch: 주소를 읽을 수 없다 — ${bareUrl(raw)}`)
  }
  if (u.protocol !== 'https:') throw new Error(`safeFetch: https 만 받는다(${u.protocol.replace(':', '')}) — ${bareUrl(u)}`)
  if (u.username || u.password) throw new Error(`safeFetch: 주소에 사용자 정보가 있다 — ${bareUrl(u)}`)
  if (u.port) throw new Error(`safeFetch: 기본이 아닌 포트는 받지 않는다 — ${bareUrl(u)}`)
  if (!hostAllowed(u.hostname, allowHosts)) throw new Error(`safeFetch: 허용 목록에 없는 호스트 ${u.hostname} — ${bareUrl(u)}`)
  return u
}

const dropAuth = (headers) => (headers ? Object.fromEntries(Object.entries(headers).filter(([k]) => !/^(authorization|cookie|proxy-authorization)$/i.test(k))) : headers)

class TooBig extends Error {}

async function readBody(res, cap, where, truncate) {
  const len = res.headers.get('content-length')
  if (!truncate && len && /^\d+$/.test(len) && Number(len) > cap) {
    await res.body?.cancel().catch(() => {})
    throw new TooBig(`safeFetch: 응답이 한도(${cap} 바이트)보다 크다(content-length ${len}) — ${where}`)
  }
  if (!res.body) return Buffer.alloc(0)
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > cap) {
        await reader.cancel().catch(() => {})
        if (truncate) break
        throw new TooBig(`safeFetch: 응답이 한도(${cap} 바이트)를 넘었다 — ${where}`)
      }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof TooBig) throw e
    throw new Error(`safeFetch: 본문 읽기 실패(${e?.message ?? e}) — ${where}`)
  }
  return Buffer.concat(chunks)
}

/**
 * @param {string|URL} url
 * @param {{ allowHosts: readonly string[], maxBytes: number, timeoutMs?: number, headers?: Record<string,string>, fetch?: typeof fetch, maxRedirects?: number }} opts
 * @returns {Promise<{ buffer: Buffer, status: number, url: string }>}
 */
export async function safeFetch(url, { allowHosts, maxBytes, timeoutMs = 60_000, headers, fetch: fetchImpl = globalThis.fetch, maxRedirects = 5 } = {}) {
  if (!Array.isArray(allowHosts) || !allowHosts.length) throw new Error('safeFetch: allowHosts 가 비었다')
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('safeFetch: maxBytes 는 양수여야 한다')
  const signal = AbortSignal.timeout(timeoutMs)
  let cur = checkUrl(url, allowHosts)
  let hdrs = headers
  for (let hop = 0; ; hop++) {
    let res
    try {
      res = await fetchImpl(cur.href, { headers: hdrs ?? {}, redirect: 'manual', signal })
    } catch (e) {
      throw new Error(`safeFetch: 요청 실패(${e?.message ?? e}) — ${bareUrl(cur)}`)
    }
    if (REDIRECT.has(res.status)) {
      await res.body?.cancel().catch(() => {})
      if (hop >= maxRedirects) throw new Error(`safeFetch: 리디렉션이 ${maxRedirects}번을 넘었다 — ${bareUrl(cur)}`)
      const loc = res.headers.get('location')
      if (!loc) throw new Error(`safeFetch: 리디렉션에 Location 이 없다 — ${bareUrl(cur)}`)
      let target
      try {
        target = new URL(loc, cur)
      } catch {
        throw new Error(`safeFetch: 리디렉션 주소를 읽을 수 없다 — ${bareUrl(cur)}`)
      }
      const next = checkUrl(target.href, allowHosts) // 매 단계 https·허용 호스트 재검사
      if (next.host !== cur.host) hdrs = dropAuth(hdrs)
      cur = next
      continue
    }
    const ok = res.status >= 200 && res.status < 300
    const buffer = await readBody(res, ok ? maxBytes : Math.min(maxBytes, ERROR_BODY_CAP), bareUrl(cur), !ok)
    return { buffer, status: res.status, url: cur.href }
  }
}
