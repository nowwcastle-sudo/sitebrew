/**
 * 표지 SVG 허용 목록 검사(보안 수정 F, daybreak svg-smil-href-bypasses-favicon-sanitizer).
 * 로고·파비콘 SVG 는 이 검사를 하나만 거친다: `favicon-kit` 의 `parseMark`(소비자 빌드)와 `factory/stamp/site-files.mjs` 의 `markSvg`(공장).
 *
 * 예전에는 거부 목록(`<script`·`on*=`·`href=`)이어서 `<animate attributeName="href">`·`<set>`·`<a>`·`<style>` 처럼 목록에 없는 활성 요소가
 * `app/icon.svg` 안으로 그대로 들어갔다. 이제는 허용한 요소·속성만 통과하고 나머지는 모두 거절한다.
 *   - 요소: svg·g·path·circle·ellipse·rect·line·polyline·polygon·defs·clipPath·mask·linearGradient·radialGradient·stop·title·desc
 *   - 속성: 아래 ATTRS 이름만. href 계열·on*·style·class 는 목록에 없다. `url(...)` 은 `#id` 만, `javascript:`·`data:` 는 거절한다.
 *   - 문법: 좁은 XML 부분집합만 받는다(큰따옴표·작은따옴표 속성, 엔티티 없음, DOCTYPE·CDATA·처리 명령 없음).
 *     문법이 어긋난 입력은 거절하므로 브라우저와 이 검사가 다르게 읽는 틈이 생기지 않는다.
 * 통과하면 입력 글자를 그대로 돌려준다(다시 쓰지 않는다 — 정상 로고의 출력이 바뀌지 않는다).
 * 의존이 없다(소비자 프로젝트에 이 파일 하나로 설치된다). 지우기만 하는 타입 문법만 쓴다(노드가 .ts 를 바로 읽는다).
 */

export type SvgCheck = { ok: true; viewBox: string; inner: string } | { ok: false; reason: string }

const ELEMENTS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "clipPath", "mask", "linearGradient", "radialGradient", "stop", "title", "desc"])

/** 속성 이름 허용 목록(모든 요소 공통). */
const ATTRS = new Set([
  // 모양·위치
  "d", "x", "y", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr", "width", "height", "x1", "y1", "x2", "y2", "points", "viewBox", "preserveAspectRatio", "transform", "pathLength",
  // 칠·선
  "fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "shape-rendering",
  // 그러데이션·클립·마스크
  "gradientUnits", "gradientTransform", "spreadMethod", "offset", "stop-color", "stop-opacity", "clipPathUnits", "maskUnits", "maskContentUnits", "clip-path", "mask",
  // 식별·접근성·문서
  "id", "role", "aria-label", "aria-labelledby", "aria-describedby", "aria-hidden", "xmlns", "xmlns:xlink", "version",
])

/** `url(#id)` 를 쓸 수 있는 속성(칠·선·클립·마스크). */
const PAINT = new Set(["fill", "stroke", "clip-path", "mask"])
/** 사람이 읽는 글을 담는 속성 — 글자 범위만 거른다. */
const TEXT = new Set(["role", "aria-label", "aria-labelledby", "aria-describedby", "aria-hidden"])
const NS: Record<string, string> = { xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink" }

const ID = /^[A-Za-z_][-\w.:]*$/
const URL_REF = /url\(\s*#[A-Za-z_][-\w.:]*\s*\)/g
const PLAIN = /^[A-Za-z0-9\s.,#%()+\-/]*$/
const WS = "[ \\t\\r\\n]"
const MAX_DEPTH = 32

const fail = (reason: string): SvgCheck => ({ ok: false, reason })

function badAttr(name: string, value: string): string | null {
  if (/^on/i.test(name)) return `이벤트 속성 ${name}`
  if (/(^|:)href$/i.test(name)) return `링크 속성 ${name}`
  if (!ATTRS.has(name)) return `허용 목록에 없는 속성 ${name}`
  const squeezed = value.replace(/[\s\u0000-\u001f]/g, "")
  if (/(?:javascript|vbscript|data)\s*:/i.test(squeezed)) return `속성 ${name} 에 스크립트·데이터 주소`
  if (name in NS) return value === NS[name] ? null : `속성 ${name} 의 값이 표준 이름공간이 아님`
  if (name === "id") return ID.test(value) ? null : "id 값 모양"
  if (TEXT.has(name)) return /^[^<>&"\\\u0000-\u001f]{0,200}$/.test(value) ? null : `속성 ${name} 의 글자 범위`
  const rest = PAINT.has(name) ? value.replace(URL_REF, "") : value
  if (/url/i.test(rest)) return `속성 ${name} 의 url() 은 #id 만 가능`
  return PLAIN.test(rest) ? null : `속성 ${name} 의 값에 허용되지 않는 글자`
}

/** 표지 SVG 를 검사한다. 통과하면 바깥 <svg> 의 viewBox 와 안쪽 내용(입력 그대로)을, 아니면 거절 이유 한 줄을 돌려준다. */
export function inspectMarkSvg(svg: string): SvgCheck {
  const s = svg.trim()
  const prolog = s.match(new RegExp(`^(?:<\\?xml${WS}[^<>]*\\?>${WS}*)?`))![0]
  const stack: string[] = []
  let i = prolog.length
  let rootOpenEnd = -1, rootCloseStart = -1, rootAttrs: Record<string, string> | null = null, rootDone = false

  while (i < s.length) {
    if (s[i] !== "<") {
      const end = s.indexOf("<", i), text = s.slice(i, end < 0 ? s.length : end)
      const top = stack[stack.length - 1]
      if (/[>]/.test(text)) return fail("글 안에 > 가 있음")
      if (top === "title" || top === "desc") {
        if (/&(?!(?:amp|lt|gt|quot|apos);)/.test(text)) return fail("글 안에 허용되지 않는 엔티티")
      } else if (!/^[ \t\r\n]*$/.test(text)) return fail(stack.length ? `요소 <${top}> 안의 글` : "<svg> 밖의 글")
      i += text.length
      continue
    }
    if (s.startsWith("<!--", i)) {
      const end = s.indexOf("-->", i + 4)
      if (end < 0) return fail("닫히지 않은 주석")
      if (/--/.test(s.slice(i + 4, end)) || s[end - 1] === "-") return fail("주석 안에 --")
      i = end + 3
      continue
    }
    if (s[i + 1] === "!" || s[i + 1] === "?") return fail("DOCTYPE·CDATA·처리 명령")
    if (s[i + 1] === "/") {
      const m = new RegExp(`<\\/([A-Za-z][A-Za-z0-9]*)${WS}*>`, "y")
      m.lastIndex = i
      const r = m.exec(s)
      if (!r) return fail("닫는 태그 모양")
      if (stack.pop() !== r[1]) return fail(`닫는 태그 </${r[1]}> 가 짝이 맞지 않음`)
      if (stack.length === 0) { rootCloseStart = i; rootDone = true }
      i += r[0].length
      continue
    }
    // 여는 태그
    const nm = /<([A-Za-z][A-Za-z0-9]*)/y
    nm.lastIndex = i
    const n = nm.exec(s)
    if (!n) return fail("여는 태그 모양")
    const name = n[1]
    if (!ELEMENTS.has(name)) return fail(`허용 목록에 없는 요소 <${name}>`)
    if (rootDone) return fail("<svg> 가 둘 이상")
    if (stack.length === 0 && name !== "svg") return fail("바깥 요소가 <svg> 가 아님")
    let p = i + n[0].length
    const attrs: Record<string, string> = {}
    const at = new RegExp(`${WS}+([A-Za-z_:][-A-Za-z0-9_:.]*)${WS}*=${WS}*(?:"([^"<&]*)"|'([^'<&]*)')`, "y")
    for (;;) {
      at.lastIndex = p
      const a = at.exec(s)
      if (!a) break
      const value = a[2] ?? a[3]
      const bad = badAttr(a[1], value)
      if (bad) return fail(`<${name}> 의 ${bad}`)
      if (Object.hasOwn(attrs, a[1])) return fail(`<${name}> 의 속성 ${a[1]} 가 겹침`)
      attrs[a[1]] = value
      p = at.lastIndex
    }
    const end = new RegExp(`${WS}*(\\/?)>`, "y")
    end.lastIndex = p
    const e = end.exec(s)
    if (!e) return fail(`<${name}> 태그 모양(허용되지 않는 속성 문법)`)
    p += e[0].length
    if (stack.length === 0) {
      if (e[1]) return fail("<svg> 가 비어 있음")
      rootAttrs = attrs
      rootOpenEnd = p
    }
    if (!e[1]) {
      if (stack.length >= MAX_DEPTH) return fail("요소 중첩이 너무 깊음")
      stack.push(name)
    }
    i = p
  }
  if (!rootAttrs || !rootDone) return fail("<svg>…</svg> 하나로 된 표지가 아님")
  if (s.slice(rootCloseStart).replace(/^<\/svg\s*>/, "").replace(/<!--[\s\S]*?-->/g, "").trim() !== "") return fail("</svg> 뒤에 내용이 있음")
  return { ok: true, viewBox: rootAttrs.viewBox ?? "", inner: s.slice(rootOpenEnd, rootCloseStart) }
}
