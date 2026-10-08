// 모양이 훅 밖에 남았는지 찾는 감사기. 사용:
//   node factory/scripts/hooks-audit.mjs [폴더|파일=registry/factory/ui-src]   → 훅 밖 모양 클래스 목록, 있으면 종료 코드 1
//   node factory/scripts/hooks-audit.mjs --equal <원본.tsx> <생성물.tsx>       → 클래스 토큰 다중집합이 같으면 0
// 모양(스타일이 바꿀 것)은 cn-* 훅으로, 규칙(포커스 링·히트 영역·색 의미)은 부품에 남긴다. 인라인 모양은 훅을 이긴다(twMerge).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// 모양 클래스 표 — 변형(prefix)을 떼어낸 유틸리티 이름에 건다.
const LAYOUT_SIZE = /^(full|auto|screen|fit|min|max|dvh|svh|lvh|0)$|^\(--|^\[.*(var\(|%|calc\()/
export const SHAPE = [
  /^rounded(-.+)?$/,
  (u) => { const m = u.match(/^(min-h|h|size)-(.+)$/); return !!m && !LAYOUT_SIZE.test(m[2]) },
  /^p[xytrblse]?-.+$/,
  /^gap(-[xy])?-.+$/,
  /^space-[xy]-.+$/,
  /^text-(xs|sm|base|lg|xl|[0-9]xl|\[[^\]]+\])(\/.+)?$/,
  /^font-(normal|medium|semibold|bold)$/,
  /^tracking-.+$/,
  /^leading-.+$/,
  /^border(-[xytrblse])?(-[0-9]+|-\[[0-9.]+[a-z]*\])?$/,
  /^ring(-[0-9]+|-\[[0-9.]+[a-z]*\])?$/,
  /^shadow(-.+)?$/,
  /^bg-transparent$/,
  /^bg-input\/.+$/,
  /^backdrop-.+$/,
  // Task 5: 부품 간격·칸 모양을 정하는 사용자 변수와 내비 뭉치 폭도 모양이다(인라인이면 훅을 이긴다 → 훅으로 옮겼다).
  /^\[--(card-spacing|cell-radius|cell-size):.+\]$/,
  // Task 16a: 질감 층(Texture)의 모양 변수 — 부품이 var() 기본값으로 층을 그리고 X 축 값이 변수만 정한다(site-shell 과 같은 방식).
  /^\[--wf-texture-[ab]-[a-z]+:.+\]$/,
  /^max-w-(max|none)$/,
]
// 이 변형이 붙은 클래스는 규칙이다: aria-invalid 색, disabled, 히트 영역(after/before), reduced-motion.
// pointer-coarse: 터치에서만 거는 44px 바닥(DESIGN §7 — 묶음 안 타깃은 (pointer: coarse)에서 44)도 히트 영역 규칙이다.
const RULE_VARIANT = /invalid|disabled|^after$|^before$|^motion-reduce$|^pointer-coarse$/
// 포커스 변형 아래에서는 포커스 표시(링·외곽선·테두리 색)만 규칙이다. focus-visible:rounded-* 같은 모양은 모양이다.
const FOCUS_VARIANT = /focus/
const FOCUS_RULE = /^(ring|ring-.+|outline|outline-.+|border-(?![xytrblse](-|$))(?!\d)(?!\[\d)[a-z].*)$/
// 선택·눌림 표시(T7-I2): 눌림·선택 변형 아래의 안쪽 링은 규칙이다(면 색만으로는 3:1 이 안 된다).
const SELECTED_VARIANT = /aria-pressed|data-pressed|data-active|aria-selected|data-\[state=on\]/
const SELECTED_RULE = /^inset-ring(-.+)?$/

// 'a:[&_x:y]:b' → ['a', '[&_x:y]', 'b'] — 괄호 안의 콜론은 자르지 않는다.
function splitVariants(token) {
  const parts = []
  let depth = 0, cur = ''
  for (const c of token) {
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    if (c === ':' && depth === 0) { parts.push(cur); cur = '' } else cur += c
  }
  parts.push(cur)
  return parts
}

// 히트 영역 바닥(규칙): min-h-[44px] 는 ::after 가 그려지지 않는 대체 요소(<input> 등)·입력 그룹의 44px 최소 높이,
// min-h-[24px] 는 조밀 줄(메뉴·목록 항목·accordion·menubar)의 WCAG 2.5.8 최소 24. 훅의 시각 토큰 min-h-N 과 섞이지 않게 [px]로 쓴다.
export const HIT_FLOOR = new Set(['min-h-[44px]', 'min-h-[24px]'])

export function isShape(token) {
  if (token.startsWith('cn-') || HIT_FLOOR.has(token)) return false
  const parts = splitVariants(token)
  const util = parts.pop().replace(/^!|!$/g, '').replace(/^-/, '')
  if (parts.some((v) => RULE_VARIANT.test(v))) return false
  if (parts.some((v) => FOCUS_VARIANT.test(v)) && FOCUS_RULE.test(util)) return false
  return SHAPE.some((r) => (typeof r === 'function' ? r(util) : r.test(util)))
}

const parse = (src) => ts.createSourceFile('x.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const isLiteral = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)

// 클래스 문자열이 사는 자리(컴파일러가 바꾸는 곳): JSX className, className 속성, cn()·cva() 호출 안.
function isClassContext(n) {
  if (ts.isJsxAttribute(n)) return n.name.getText() === 'className'
  if (ts.isPropertyAssignment(n)) return n.name.getText() === 'className'
  if (ts.isCallExpression(n)) return ts.isIdentifier(n.expression) && ['cn', 'cva'].includes(n.expression.text)
  return false
}

// 감사는 더 넓게 본다: classNames·containerClassName·…ClassName 속성, twMerge·clsx, x.cn() 같은 멤버 호출,
// className 자리에서 이름으로 불리는 문자열 변수. 컴파일러가 못 닿는 자리의 모양도 빠짐없이 잡으려는 것이다.
const CLASS_PROP = /^(className|classNames|[a-zA-Z]+ClassName)$/
const CLASS_FN = new Set(['cn', 'cva', 'twMerge', 'clsx', 'cx'])
function isWideClassContext(n) {
  if (ts.isJsxAttribute(n) || ts.isPropertyAssignment(n)) return CLASS_PROP.test(n.name.getText().replace(/["']/g, ''))
  if (ts.isCallExpression(n)) {
    const e = n.expression
    if (ts.isIdentifier(e)) return CLASS_FN.has(e.text)
    if (ts.isPropertyAccessExpression(e)) return CLASS_FN.has(e.name.text)
  }
  return false
}

// 넓은 클래스 자리 안에서 이름으로 불린 변수 → 그 변수의 초기값도 클래스 자리.
function classVariables(sf) {
  const names = new Set()
  const visit = (n, inClass) => {
    const here = inClass || isWideClassContext(n)
    if (here && ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !(ts.isCallExpression(n.parent) && n.parent.expression === n)) names.add(n.text)
    ts.forEachChild(n, (c) => visit(c, here))
  }
  visit(sf, false)
  return names
}

export function shapeOutsideHooks(tsxSource) {
  const sf = parse(tsxSource), hits = []
  const vars = classVariables(sf)
  const visit = (n, inClass) => {
    const here = inClass || isWideClassContext(n) || (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && vars.has(n.name.text))
    if (here && isLiteral(n)) {
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
      for (const cls of n.text.split(/\s+/).filter(Boolean)) if (isShape(cls)) hits.push({ cls, where: `${line}:${cls}` })
    }
    ts.forEachChild(n, (c) => visit(c, here))
  }
  visit(sf, false)
  return hits
}

// 클래스 자리(className·cn()·cva()) 문자열의 공백 단위 토큰. 비교식의 피연산자(x === "top")는 값이라 뺀다.
// 주석·생성물 머리줄·import 경로는 클래스 자리가 아니라 빠진다.
export function classTokens(tsxSource) {
  const sf = parse(tsxSource), out = []
  const CMP = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken])
  const isOperand = (n) => ts.isBinaryExpression(n.parent) && CMP.has(n.parent.operatorToken.kind)
  const visit = (n, inClass) => {
    const here = inClass || isClassContext(n)
    if (here && isLiteral(n) && !isOperand(n)) out.push(...n.text.split(/\s+/).filter(Boolean))
    ts.forEachChild(n, (c) => visit(c, here))
  }
  visit(sf, false)
  return out
}

// 규칙 클래스 집합 — 클래스 자리 토큰 중 훅(cn-*)도 모양도 아닌 것: 포커스 링·aria-invalid·disabled·히트 영역(after:*·바닥)·
// motion-reduce·data-* 상태·의미색·레이아웃. 스타일(훅 값)을 무엇으로 바꿔도 이 집합은 컴파일 전후가 같아야 한다.
export function ruleClasses(tsxSource) {
  return new Set(classTokens(tsxSource).filter((t) => !t.startsWith('cn-') && !isShape(t)))
}

// 규칙 자리 토큰인가 — 규칙 변형(invalid·disabled·after·before·motion-reduce), 포커스 표시(링·외곽선·테두리 색), 히트 바닥.
export function isRuleToken(token) {
  if (HIT_FLOOR.has(token)) return true
  const parts = splitVariants(token)
  const util = parts.pop().replace(/^!|!$/g, '').replace(/^-/, '')
  return parts.some((v) => RULE_VARIANT.test(v)) || (parts.some((v) => FOCUS_VARIANT.test(v)) && FOCUS_RULE.test(util)) ||
    (parts.some((v) => SELECTED_VARIANT.test(v)) && SELECTED_RULE.test(util))
}

// 스타일 축 값용 규칙 불변(Task 6 계약 ⊆): 원천의 규칙 클래스가 컴파일본에 모두 남고(missing 0),
// 훅이 규칙 자리 토큰을 끼워 넣어 부품 규칙과 다투지 않는다(fighting 0). 모양 밖 토큰(색·폭 등)은 extra 로 돌려줄 뿐 실패가 아니다.
export function rulesIntact(srcTsx, compiledTsx) {
  const want = ruleClasses(srcTsx), got = ruleClasses(compiledTsx)
  const missing = [...want].filter((t) => !got.has(t))
  const extra = [...got].filter((t) => !want.has(t))
  return { missing, fighting: extra.filter(isRuleToken), extra }
}

// shadcn transformStyle 이 값으로 바꾸지 않고 그대로 두는 표지 훅 — 생성물에도 남아야 한다.
// 목록을 손으로 두지 않고 설치된 shadcn(`dist/utils/index.js` 의 표지 Set)에서 읽는다(리뷰 M2 — 목록과 컴파일러가 어긋나지 않게).
export const KEPT_MARKERS = (() => {
  const dist = readFileSync(fileURLToPath(new URL('../../node_modules/shadcn/dist/utils/index.js', import.meta.url)), 'utf8')
  const found = dist.match(/new Set\(\[("cn-[^\]]+)\]\)/)?.[1].match(/cn-[\w-]+/g)
  if (!found?.length) throw new Error('shadcn dist/utils 에서 표지 훅 목록을 찾지 못했다 — shadcn 판을 확인한다')
  return new Set(found)
})()

// 원본(a)의 cn-* 훅은 컴파일러가 값으로 바꾸거나(CSS 가 없는 죽은 표지면) 지우므로 빼고 센다(예: 업스트림의 cn-input-otp).
// 다만 컴파일러가 남기는 표지(KEPT_MARKERS)는 생성물에도 있어야 하니 센다(Task 3 minor — 접두사 전체를 빼던 것을 좁혔다).
// 생성물(b)에 남은 cn-* 는 컴파일러가 못 닿은 훅이므로 extra 로 드러난다.
export function compareTokens(a, b) {
  const count = new Map()
  for (const t of classTokens(a)) if (!t.startsWith('cn-') || KEPT_MARKERS.has(t)) count.set(t, (count.get(t) ?? 0) + 1)
  for (const t of classTokens(b)) count.set(t, (count.get(t) ?? 0) - 1)
  const missing = [], extra = []
  for (const [t, c] of count) { for (let i = 0; i < c; i++) missing.push(t); for (let i = 0; i < -c; i++) extra.push(t) }
  return { missing, extra }
}

// 컴파일러는 cva 기본·변형 문자열과 mergeProps 의 className 에서 쓴 훅을 「사용됨」으로 표시하고,
// 같은 파일에서 그 이름이 다시 나오면 값을 넣지 않고 지운다. 그런 이름이 두 번 이상 나오면 돌려준다.
export function duplicateHooks(tsxSource) {
  const sf = parse(tsxSource)
  const once = new Set(), count = new Map(), firstLine = new Map()
  const hooks = (lit) => lit.text.split(/\s+/).filter((t) => t.startsWith('cn-'))
  const markOnce = (lit) => { if (lit && ts.isStringLiteral(lit)) for (const h of hooks(lit)) once.add(h) }
  const visit = (n, inClass) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'cva') {
      const [base, cfg] = n.arguments
      markOnce(base)
      const variants = cfg && ts.isObjectLiteralExpression(cfg) && cfg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'variants')
      if (variants && ts.isObjectLiteralExpression(variants.initializer))
        for (const axis of variants.initializer.properties)
          if (ts.isPropertyAssignment(axis) && ts.isObjectLiteralExpression(axis.initializer))
            for (const v of axis.initializer.properties) if (ts.isPropertyAssignment(v)) markOnce(v.initializer)
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'mergeProps')
      for (const o of n.arguments.filter(ts.isObjectLiteralExpression))
        for (const p of o.properties)
          if (ts.isPropertyAssignment(p) && p.name.getText() === 'className' && ts.isCallExpression(p.initializer)) p.initializer.arguments.forEach(markOnce)
    const here = inClass || isClassContext(n)
    if (here && isLiteral(n)) for (const h of hooks(n)) {
      count.set(h, (count.get(h) ?? 0) + 1)
      if (!firstLine.has(h)) firstLine.set(h, sf.getLineAndCharacterOfPosition(n.getStart()).line + 1)
    }
    ts.forEachChild(n, (c) => visit(c, here))
  }
  visit(sf, false)
  return [...once].filter((h) => count.get(h) > 1).map((name) => ({ name, where: `${firstLine.get(name)}:${name}` }))
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const a = process.argv.slice(2)
  if (a[0] === '--equal') {
    if (a.length !== 3) { console.error('사용: --equal <원본.tsx> <생성물.tsx>'); process.exit(2) }
    const { missing, extra } = compareTokens(readFileSync(a[1], 'utf8'), readFileSync(a[2], 'utf8'))
    if (missing.length) console.error(`missing ${missing.join(' ')}`)
    if (extra.length) console.error(`extra ${extra.join(' ')}`)
    console.log(`equal: ${missing.length || extra.length ? 'DIFF' : 'OK'} ${a[2]}`)
    process.exit(missing.length || extra.length ? 1 : 0)
  }
  const target = a[0] ?? 'registry/factory/ui-src'
  const files = statSync(target).isDirectory() ? readdirSync(target).filter((f) => f.endsWith('.tsx')).sort().map((f) => join(target, f)) : [target]
  let n = 0
  for (const f of files) for (const h of shapeOutsideHooks(readFileSync(f, 'utf8'))) { n++; console.error(`${f}:${h.where}`) }
  console.log(`hooks-audit: ${files.length} files, ${n} shape classes outside hooks`)
  process.exit(n ? 1 : 0)
}
