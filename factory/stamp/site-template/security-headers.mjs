// 찍어낸 정적 사이트의 보안 헤더(P3-4 perf, 대장 C171 — 컨트롤러 결정: completion "site" 는 정적으로 두고 nonce 없이 헤더만).
// Next 16 「Content Security Policy」 가이드: nonce 는 모든 쪽을 동적 렌더로 만들어 정적 최적화·CDN 캐시를 잃는다. 그래서 여기서는
//   ① next.config.ts headers() 가 CSP(script-src 'self' — 인라인 script 는 해시로만)와 nosniff·Referrer-Policy·Permissions-Policy 를 싣고,
//   ② 빌드 뒤 scripts/csp-hashes.mjs 가 .next/server/app 의 HTML 마다 실제 인라인 script(Next 의 RSC 흐름·MotionBoot 등)의 sha256 을 모아
//      .next/routes-manifest.json 의 CSP script-src 에 주입한다(headers() 는 HTML 이 만들어지기 전에 평가되므로 해시를 못 안다).
// 해시를 주입하지 않은 빌드는 script-src 'self' 뿐이라 인라인 script 를 브라우저가 막는다 — 조용히 느슨해지지 않고 눈에 띄게 깨진다(ops-gate 가 잡는다).
// 이 파일은 순수 함수만 둔다(next.config.ts·scripts/csp-hashes.mjs·factory 시험이 함께 쓴다). 스타일은 인라인(React style 속성·MotionBoot·next/font)이 있어 'unsafe-inline' 을 둔다 — 스크립트가 아니라 XSS 위험이 낮다.
import { createHash } from "node:crypto"

const CSP_KEY = "Content-Security-Policy"

/** 운영 CSP(해시 주입 전). script-src 는 'self' 하나다. */
export const BASE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  // 폼은 같은 출처로만 보낸다(FINAL-WF E4). 정적 어댑터 문의 폼의 mailto: 은 JS 가 window.location.assign 으로 여는 이동이라 form-action 이 아니다 — 막히지 않는다(시험 stamp-csp).
  "form-action 'self'",
].join("; ")

/** headers() 에 물리는 [{ key, value }]. dev(next dev)는 HMR·eval 때문에 CSP 를 싣지 않는다. */
export function securityHeaders({ dev = false } = {}) {
  return [
    ...(dev ? [] : [{ key: CSP_KEY, value: BASE_CSP }]),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ]
}

const EXEC_TYPE = /^(?:module|text\/javascript|application\/javascript)$/i
const attrOf = (attrs, name) => attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))

/** HTML 의 실행되는 인라인 script(src 없음·데이터 블록 아님·글자 있음) → sha256 토큰. 해시는 태그 사이 글자 통째(브라우저와 같다). */
export function inlineScriptHashes(html) {
  const out = []
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attrOf(m[1], "src")) continue
    const type = attrOf(m[1], "type")
    if (type && !EXEC_TYPE.test(type[1] ?? type[2])) continue
    if (m[2] === "") continue
    out.push(`'sha256-${createHash("sha256").update(m[2], "utf8").digest("base64")}'`)
  }
  return out
}

/** CSP 문자열의 script-src 에 해시 토큰을 더한다(중복 없이 정렬 — 다시 돌려도 같다). script-src 가 없으면 던진다. */
export function withScriptHashes(csp, hashes) {
  const dirs = csp.split(";").map((d) => d.trim()).filter(Boolean)
  const i = dirs.findIndex((d) => /^script-src(?:\s|$)/i.test(d))
  if (i < 0) throw new Error("CSP 에 script-src 가 없다 — 해시를 넣을 자리가 없다")
  const [name, ...tokens] = dirs[i].split(/\s+/)
  const plain = tokens.filter((t) => !/^'sha(?:256|384|512)-/i.test(t))
  const all = [...new Set([...tokens.filter((t) => /^'sha(?:256|384|512)-/i.test(t)), ...hashes])].sort()
  dirs[i] = [name, ...plain, ...all].join(" ")
  return dirs.join("; ")
}

/** routes-manifest 의 headers[].headers[] 중 CSP 값마다 해시를 주입한다 → 바꾼 값의 수. CSP 를 싣는 항목이 없으면 던진다. */
export function patchRoutesManifest(manifest, hashes) {
  let n = 0
  for (const rule of manifest?.headers ?? []) {
    for (const h of rule.headers ?? []) {
      if (h.key.toLowerCase() === CSP_KEY.toLowerCase()) { h.value = withScriptHashes(h.value, hashes); n++ }
    }
  }
  if (!n) throw new Error(`routes-manifest 의 headers 에 ${CSP_KEY} 가 없다 — next.config.ts headers() 가 securityHeaders() 를 싣는지 확인한다`)
  return n
}
