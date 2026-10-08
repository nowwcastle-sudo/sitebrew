// 히어로 블록의 LCP 후보 규칙(P3-4 perf, 대장 C173): 첫 화면의 글·그림은 등장 연출이 숨기지 않는다.
//
// 왜: 모션 키트의 MotionBoot 는 `[data-enter]` 를 하이드레이션(장면 시작) 때까지 visibility:hidden 으로 가린다. 글·그림이 이 안에 있으면
//     LCP 가 JS 가 돈 뒤로 밀린다 — 실측 local × r1-measure 홈: LCP 요소 `p.gw-caption[data-enter]` 의 렌더 지연 5.2 s, 모바일 모의 LCP 12.7 s.
//     `data-enter="keep"` 은 첫 칠부터 보이고, 서버 HTML 로 이미 칠해진 구획의 등장 연출은 끝 상태로 둔다(use-gsap-scene settleKept).
// 규칙: hero 블록의 JSX 에서 글자나 그림(img·Image·ImageSlot·VideoSlot·video·picture)을 품은 요소는 자기 자신에 숨기는 data-enter 를 달지 못한다.
//       (조상이 숨기면 자손 글이 함께 숨으므로 조상 요소도 같은 규칙을 받는다 — 요소마다 자기 자손을 본다.) svg 안은 LCP 후보가 아니라 예외다.
//       숨기지 않는 값: data-enter="keep" · data-enter 없음 · {cond ? "keep" : undefined} 꼴.
import ts from 'typescript'

const MEDIA_TAGS = new Set(['img', 'Image', 'ImageSlot', 'VideoSlot', 'video', 'picture'])
const isTsx = ts.ScriptKind.TSX

const openingOf = (node) => (ts.isJsxElement(node) ? node.openingElement : node)
const tagName = (el) => openingOf(el).tagName.getText()
const isJsx = (n) => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)

/** 초기값이 「숨기는」 data-enter 인가. keep 과 undefined 만 숨기지 않는다. */
function hiding(init) {
  if (!init) return true // <x data-enter /> — true
  if (ts.isStringLiteral(init)) return init.text !== 'keep'
  if (!ts.isJsxExpression(init) || !init.expression) return true
  const soft = (e) => (ts.isStringLiteral(e) && e.text === 'keep') || (ts.isIdentifier(e) && e.text === 'undefined')
  const walk = (e) => {
    if (ts.isParenthesizedExpression(e)) return walk(e.expression)
    if (soft(e)) return false
    if (ts.isConditionalExpression(e)) return walk(e.whenTrue) || walk(e.whenFalse)
    return true // 식별자·호출 등 — 무엇이 되는지 정적으로 알 수 없어 숨긴다고 본다
  }
  return walk(init.expression)
}

// Face·DarkZone(_shared/hero-parts)는 enter prop 을 data-enter 로 바꿔 단다(true → "", "keep" → keep) — 같은 규칙을 받는다.
const ENTER_PROP_TAGS = new Set(['Face', 'DarkZone'])
function dataEnterAttr(el) {
  const tag = tagName(el)
  for (const a of openingOf(el).attributes.properties) if (ts.isJsxAttribute(a) && (a.name.getText() === 'data-enter' || (a.name.getText() === 'enter' && ENTER_PROP_TAGS.has(tag)))) return a
  return null
}

/** 요소 하나의 자손(svg 안 제외)에 글자·그림이 있는가. */
// 제목·문단 태그는 자식이 컴포넌트(SplitChars 등)여도 글을 그린다 — 자식을 안 들여다보고 글을 품은 것으로 본다(P3-4 PERF2: vertical-title-slides 의 `<h1 data-enter={split ? "" : undefined}><SplitChars/></h1>` 가 규칙을 빠져나갔다).
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'p'])
function contentBearing(el) {
  if (TEXT_TAGS.has(tagName(el))) return true
  let found = false
  const visit = (n) => {
    if (found) return
    if (isJsx(n)) {
      const t = tagName(n)
      if (t === 'svg') return
      if (MEDIA_TAGS.has(t)) { found = true; return }
    }
    if (ts.isJsxText(n) && n.text.trim() !== '') { found = true; return }
    if (ts.isJsxExpression(n) && n.expression && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) { found = true; return }
    ts.forEachChild(n, visit)
  }
  if (ts.isJsxElement(el)) for (const c of el.children) visit(c)
  return found
}

/** 원천 → [{ tag, line, className, attrStart, attrEnd }] — 글·그림을 품고도 숨기는 data-enter 를 단 요소. */
export function heroLcpViolations(source, fileName = 'hero.tsx') {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, isTsx)
  const out = []
  const visit = (n, inSvg) => {
    if (isJsx(n)) {
      const tag = tagName(n)
      const svg = inSvg || tag === 'svg'
      if (!svg) {
        const attr = dataEnterAttr(n)
        if (attr && hiding(attr.initializer) && contentBearing(n)) {
          const cls = openingOf(n).attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'className')
          out.push({
            tag,
            line: sf.getLineAndCharacterOfPosition(attr.getStart()).line + 1,
            className: cls?.initializer ? cls.initializer.getText().slice(0, 80) : '',
            attrStart: attr.getStart(),
            attrEnd: attr.getEnd(),
            name: attr.name.getText(),
            init: attr.initializer,
          })
        }
      }
      ts.forEachChild(n, (c) => visit(c, svg))
      return
    }
    ts.forEachChild(n, (c) => visit(c, inSvg))
  }
  visit(sf, false)
  return out
}

/** blocks:check 규칙 — 문제 문장 목록. */
export function heroLcpProblems(at, source) {
  return heroLcpViolations(source).map((v) => `${at} — 히어로의 글·그림 요소 <${v.tag}${v.className ? ` className=${v.className}` : ''}> (줄 ${v.line})이 ${v.name} 로 숨는다 — 첫 화면 글·그림이 하이드레이션 뒤에야 보여 LCP 가 밀린다. ${v.name}="keep" 으로 두거나 ${v.name} 를 떼라(대장 C173)`)
}

/** 위반 요소의 data-enter 값을 keep 으로 바꾼 원천(조건식이면 「"" → "keep"」 갈래만 바꾼다). 자동 수정용. */
export function fixHeroLcp(source) {
  const list = heroLcpViolations(source).sort((a, b) => b.attrStart - a.attrStart)
  let out = source
  for (const v of list) {
    const init = v.init
    let repl
    if (!init) repl = `${v.name}="keep"`
    else if (ts.isStringLiteral(init)) repl = `${v.name}="keep"`
    else if (v.name === 'enter' && ts.isJsxExpression(init) && init.expression && !ts.isConditionalExpression(init.expression)) repl = `enter={${init.expression.getText()} ? "keep" : undefined}` // Face·DarkZone 의 enter 는 불리언 — 참이면 keep
    else {
      // {cond ? "" : undefined} → {cond ? "keep" : undefined} — 숨기는 문자열 갈래만 keep 으로
      const exprText = init.getText()
      const fixed = exprText.replace(/(\?\s*)(["'])[^"']*\2/, '$1"keep"')
      if (fixed === exprText) throw new Error(`자동 수정할 수 없는 data-enter 식(줄 ${v.line}): ${exprText}`)
      repl = `${v.name}=${fixed}`
    }
    out = out.slice(0, v.attrStart) + repl + out.slice(v.attrEnd)
  }
  return out
}
