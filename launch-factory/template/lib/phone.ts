const DOMESTIC = /^(0\d{8,10}|1\d{7})$/
const INTERNATIONAL = /^\+\d{8,15}$/

/**
 * 전화번호 → tel: 주소의 숫자(정본). 전각 숫자(NFKC)·여러 대시(‐‑–—−)·공백·점·괄호를 정리하고, +82 뒤의 (0)·0 을 뗀다.
 * 적은 모양을 따른다: 국내로 적은 번호는 국내 숫자(「02-123-4567」 → 「021234567」), +82 로 적은 번호는 E.164(「+82 (0)10-1234-5678」
 * → 「+821012345678」), 다른 나라 번호도 E.164 로 받는다. 틀리면 null.
 * tel: 링크는 누가 만들든 이 값 하나로 만든다(SiteShell·telLink) — 같은 설정값이면 같은 링크다.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.normalize("NFKC").replace(/[\s\-.‐-―−]/g, "")
  s = s.replace(/^\+82\(0\)/, "+82").replace(/[()]/g, "")
  if (s.startsWith("+820")) s = "+82" + s.slice(4)
  return INTERNATIONAL.test(s) || DOMESTIC.test(s) ? s : null
}

/**
 * 한국 전화번호 → 국내 숫자열(+82 는 앞 0 으로). 콘텐츠 원천(화면에 보이는 값)을 검사할 때 쓴다. 형식이 틀리면 null.
 * normalizePhone 을 거친 뒤 한국 번호만 남기는 더 좁은 범위다:
 *   - 글자: ASCII 숫자와 공백·괄호·점·하이픈, 맨 앞 + 만(화면 값이라 전각 숫자·다른 대시는 받지 않는다). 어디 있든 「(0)」은 뗀다.
 *   - 번호: 0으로 시작하는 9~11자리(02·031·010 …, 지역번호 괄호 허용), 전국대표번호 15xx~19xx(8자리), +82(0) 형식.
 *   - 받지 않는다: 다른 나라 번호, 1[0-4]xx 로 시작하는 8자리, 3자리 특수번호(110·120 등 — public 스키마의 civilPhone 이 따로 받는다).
 * 여기서 받는 값은 normalizePhone 도 받고, 두 결과의 숫자는 앞 0 ↔ +82 만 다르다(JSON-LD 는 toIntlPhone 으로 +82 를 싣는다).
 */
export function phoneDigits(v: string): string | null {
  if (!/^\s*\+?[\d\s().-]+$/.test(v)) return null
  const n = normalizePhone(v.replace(/\(0\)/g, ""))
  if (!n) return null
  if (n.startsWith("+") && !n.startsWith("+82")) return null
  const d = n.startsWith("+82") ? "0" + n.slice(3) : n
  return /^0\d{8,10}$/.test(d) || /^1[5-9]\d{6}$/.test(d) ? d : null
}

// ── 입력 서식(P3-2 Task 7a, 대장 A43) ──────────────────────────────────────────────
// KRDS 「개인 식별 정보 입력」: 자동 서식을 허용·권장한다. 입력 중에 하이픈을 넣어 주고, 붙여넣은 여러 형식(+82 10 1234 5678 · 010.1234.5678 · (02) 123-4567 · 전각 숫자)도 받는다.
// 저장은 그대로 normalizePhone 이다 — 이 함수는 화면 값만 만든다(하이픈은 normalizePhone 이 뗀다). 커서는 「커서 앞 숫자 개수」를 지켜 옮긴다(가운데를 고쳐도 끝으로 튀지 않는다).
// 규칙: 02 → 2-3|4-4 · 010 → 3-4-4 · 050x → 4-3-4 · 그 밖의 0xx → 10자리 3-3-4, 11자리 3-4-4 · 15xx~19xx 대표번호 → 4-4. +82 는 국내(0…)로 바꾸고, 다른 나라 번호(+82 아님)는 손대지 않는다.
export type Formatted = { value: string; caret: number }

const digitsOf = (s: string) => s.normalize("NFKC").replace(/\D/g, "")

// 숫자열을 자릿수 분할로 자른 뒤 하이픈으로 잇는다(끝 조각은 남는 만큼). caret 은 「숫자 caretDigits 개를 지난 문자 위치」.
function join(digits: string, cuts: number[], caretDigits: number): Formatted {
  const parts: string[] = []
  let at = 0
  for (const c of cuts) {
    if (at >= digits.length) break
    parts.push(digits.slice(at, at + c))
    at += c
  }
  if (at < digits.length) parts.push(digits.slice(at))
  const value = parts.join("-")
  let seen = 0
  let pos = 0
  for (const part of parts) {
    if (seen + part.length >= caretDigits) return { value, caret: pos + caretDigits - seen }
    seen += part.length
    pos += part.length + 1
  }
  return { value, caret: value.length }
}

function domesticCuts(d: string): number[] {
  if (/^1[5-9]/.test(d)) return [4, 4]
  if (d.startsWith("02")) return [2, d.length > 9 ? 4 : 3, 4]
  if (d.startsWith("010")) return [3, 4, 4]
  if (/^050\d/.test(d)) return [4, 3, 4]
  return [3, d.length > 10 ? 4 : 3, 4]
}

export function formatPhoneKr(raw: string, caret: number = raw.length): Formatted {
  const t = raw.normalize("NFKC").trim()
  const plus = t.startsWith("+")
  // +82 는 국내 형식으로(맨 앞 82 를 0 으로 — (0)·0 이 이미 붙어 있으면 그대로). 다른 나라 번호는 건드리지 않는다.
  if (plus && !/^\+\s*82/.test(t)) return { value: raw, caret }
  const conv = (s: string) => (plus ? digitsOf(s).replace(/^82(0)?/, "0") : digitsOf(s))
  const d = conv(t).slice(0, 11)
  return join(d, domesticCuts(d), Math.min(conv(raw.slice(0, caret)).length, d.length))
}

// 사업자등록번호 3-2-5(예: 123-45-67890) — 10자리까지
export function formatBizNo(raw: string, caret: number = raw.length): Formatted {
  const d = digitsOf(raw).slice(0, 10)
  return join(d, [3, 2, 5], Math.min(digitsOf(raw.slice(0, caret)).length, d.length))
}
