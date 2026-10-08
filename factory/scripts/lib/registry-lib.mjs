// 레지스트리 생성기들이 함께 쓰는 도움 함수. gen-registry.mjs 가 다시 내보낸다(recipe.mjs 가 gen-registry 를 import 하면 순환이 생긴다).
const BUILTIN = new Set(['react', 'react-dom', 'next'])
// 모든 ui 부품이 기대는 전역 바닥 규칙 항목(reduced-motion·포커스 외곽선·본문 크기·keep-all).
export const BASE_ITEM = 'factory-base'

// 폰트 키트 항목의 CSS 변수 이름(T9-c2). 끝에 종결자 `-wf` 를 단다. shadcn 은 layout.tsx 에서 기존 next/font 선언을
// 「인자 글자에 변수 이름이 들어 있는가」(부분 문자열)로 찾는다. 그래서 --font-ibm-plex-sans 가 --font-ibm-plex-sans-kr 선언을
// 제 것으로 잡아 이름을 바꾸고, KR 을 다시 넣어 같은 const 가 두 번 생겼다(레시피를 두 번째 add 하면 빌드가 깨졌다).
// 종결자가 있으면 한 변수가 다른 변수의 부분 문자열이 되지 않는다(v0.0.3 의 종결자 없는 이름과도). 검사: gen-fonts `variable-overlap`.
export const FONT_VAR_END = '-wf'
export const fontVar = (item) => `--${item}${FONT_VAR_END}`

// 아이콘 키트 라이브러리 — 목록은 여기 하나다(최종 리뷰 M5). gen-kits(항목 icons-<라이브러리>)·recipe(YAML icons.library)·parseImports 가 읽는다.
export const ICON_LIBRARIES = ['lucide', 'phosphor', 'tabler']
const ICON_ADAPTER = new RegExp(`^@/registry/factory/icons/(${ICON_LIBRARIES.join('|')})(-[a-z]+)?$`)

export function parseImports(source) {
  const npm = new Set(), internal = new Set()
  for (const m of source.matchAll(/from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
    const spec = m[1] ?? m[2]
    // 아이콘 어댑터(@/registry/factory/icons/<라이브러리>[-<굵기>]) → 키트 항목 icons-<라이브러리>(T9-icons).
    const icon = spec.match(ICON_ADAPTER)
    if (icon) { internal.add(`icons-${icon[1]}`); continue }
    // 원형 스키마(@/registry/factory/content/schemas/<원형>) → 항목 content-<원형>(Task 11).
    const schema = spec.match(/^@\/registry\/factory\/content\/schemas\/([a-z]+)$/)
    if (schema) { internal.add(`content-${schema[1]}`); continue }
    // 레시피 컴파일본은 같은 레시피 폴더의 부품을 부른다(@/registry/factory/r/<id>/ui/<부품>, T7-c1) — 항목 이름은 부품 이름.
    const inner = spec.match(/^@\/registry\/factory\/[a-z]+\/([^/]+)$/) ?? spec.match(/^@\/registry\/factory\/r\/[a-z0-9-]+\/ui\/([^/]+)$/)
    if (inner) { internal.add(inner[1]); continue }
    // 하위 경로 import(@/registry/factory/ui/x/y)는 의존 이름으로 바꿀 수 없다 — 조용히 빼지 말고 멈춘다.
    if (spec.startsWith('@/registry/')) throw new Error(`레지스트리 하위 경로 import는 지원하지 않습니다: ${spec}`)
    if (spec.startsWith('.') || spec.startsWith('@/')) continue
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
    if (!BUILTIN.has(pkg) && !pkg.startsWith('node:')) npm.add(pkg)
  }
  return { npm: [...npm], internal: [...internal] }
}

// 'pkg' → 'pkg@<package.json 범위>'. 'pkg@1'·'@scope/pkg@^2' 처럼 이미 버전이 있으면 그대로.
export function pinDependency(dep, versions) {
  const hasVersion = dep.lastIndexOf('@') > 0
  if (hasVersion || !versions) return dep
  const v = versions[dep]
  if (!v) throw new Error(`package.json 에 없는 의존입니다: ${dep}`)
  return `${dep}@${v}`
}

// --ref v1 과 --ref=v1 둘 다 받는다. 값이 없거나 '-'로 시작하면 멈춘다(태그 없이 조용히 생성되는 것을 막는다).
export function parseRef(argv) {
  let ref
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref') { ref = argv[i + 1] ?? ''; i++ }
    else if (argv[i].startsWith('--ref=')) ref = argv[i].slice('--ref='.length)
    else continue
    if (!ref || ref.startsWith('-')) throw new Error('--ref 뒤에 태그가 필요합니다 (예: --ref v0.0.3)')
  }
  return ref
}

// 파일 안 생성 구역(begin·end 표시줄 사이)만 block 으로 바꾼다 — gen-ai(docs/agents/agent-guide.md §5)·gen-content-slots(원형 스키마)가 함께 쓴다(최종 리뷰 M5).
// 표시줄이 없으면 멈춘다(조용히 붙이지 않는다). 줄바꿈은 원본 것을 따른다. where 는 오류 문구에 들어갈 파일 이름.
export function applyRegion(source, block, { begin, end, where }) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const lines = source.split(/\r?\n/)
  const b = lines.indexOf(begin), e = lines.indexOf(end)
  if (b < 0 || e < b) throw new Error(`${where}에 생성 구역 표시줄(BEGIN/END)이 없다`)
  return [...lines.slice(0, b), ...block.split('\n'), ...lines.slice(e + 1)].join(eol)
}

// 주석을 지운 CSS →[{ sel, decls: [[prop, value]], children }] 트리. 이 저장소의 테마·바닥 CSS 정도(중첩 @layer·@media)만 다룬다.
export function parseCss(source) {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  const block = () => {
    const decls = [], children = []
    let buf = ''
    while (i < src.length) {
      const c = src[i++]
      if (c === '{') { const sel = buf.trim().replace(/\s+/g, ' '); buf = ''; children.push({ sel, ...block() }) }
      else if (c === '}') { pushDecl(buf, decls); return { decls, children } }
      else if (c === ';') { pushDecl(buf, decls); buf = '' }
      else buf += c
    }
    pushDecl(buf, decls)
    return { decls, children }
  }
  const pushDecl = (text, decls) => {
    const t = text.trim(); if (!t) return
    const k = t.indexOf(':'); if (k < 0) throw new Error(`CSS 선언을 읽을 수 없습니다: ${t}`)
    decls.push([t.slice(0, k).trim(), t.slice(k + 1).trim().replace(/\s+/g, ' ')])
  }
  return block().children
}
