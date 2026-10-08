// LFRUNFIX(template:screens 첫 전체 실행의 발견 F1·F2·F5·F6·F7) 정적 시험 — 빌드·서버 없이 돈다. 브라우저 판정은 npm run template:screens 가 한다(docs/qa/template-screens.md §6).
// F6(mock 이름)은 runner.test.mjs 에 있다(실제 목 어댑터를 돌려야 해서).
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const T = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(T, p), "utf8")

test("F1 위 띠: 스크롤해도 붙는다(sticky + 불투명 배경) · 노치 안쪽 여백 · 높이를 알려 포커스가 가려지지 않는다", () => {
  // LFADA: 위 띠는 web-factory 블록 nav/account-bar 다 — 붙는 띠 속성은 블록 뿌리에, 노치 안쪽 여백은 product-header.tsx 의 className 에, 높이 알림은 session-sync.tsx 에 있다
  const h = read("components/blocks/nav/account-bar.tsx")
  const tag = /<header [^>]*>/.exec(h)[0]
  assert.match(tag, /\bsticky\b/)
  assert.match(tag, /\btop-0\b/)
  assert.match(tag, /\bbg-background\b/, "배경이 비면 아래 글이 비친다")
  assert.match(read("components/product/product-header.tsx"), /className="pt-\[env\(safe-area-inset-top\)\]"/)
  assert.match(tag, /data-sticky-nav/, "web-factory 의 붙는 띠 표지 — scroll-padding 규칙이 이것을 본다")
  assert.doesNotMatch(tag, /\bfixed\b/, "fixed 는 자리를 비워 본문이 띠 밑으로 밀려 들어간다 — sticky 로 밀림이 없다")
  const sync = read("components/product/session-sync.tsx")
  assert.match(sync, /--site-header-h/)
  assert.match(sync, /new ResizeObserver\(set\)/, "좁은 화면에서 띠 줄이 바뀌면 높이를 다시 알린다")
  const css = read("app/globals.css")
  assert.match(css, /html:has\(\[data-sticky-nav\]\)\s*\{\s*scroll-padding-top:\s*var\(--site-header-h, 5rem\)/)
})

test("F1 404 도 같은 위 띠를 쓴다(붙는 띠가 한 곳에서만 정해진다)", () => {
  assert.match(read("app/not-found.tsx"), /<ProductHeader \/>/)
})

test("F2 법정 쪽: 제품과 같은 틀(위 띠·본문·바닥글) 안에 있고 제품으로 돌아가는 링크가 있다", () => {
  const legal = read("app/(legal)/layout.tsx")
  assert.match(legal, /<ProductShell backLink>\{children\}<\/ProductShell>/)
  const shell = read("components/product/product-shell.tsx")
  assert.match(shell, /<ProductHeader \/>/)
  assert.match(shell, /<main /)
  assert.match(shell, /<ProductFooter \/>/, "바닥글은 web-factory 블록 footer/product-legal(LFADA)")
  assert.match(shell, /backLink \? \(\s*<Link href="\/"/)
  assert.match(shell, /min-h-11/, "돌아가는 링크도 눌릴 크기")
  // 제품 쪽 묶음도 같은 틀 — 두 곳이 갈라지지 않는다
  assert.match(read("app/(product)/layout.tsx"), /<ProductShell>\{children\}<\/ProductShell>/)
  // 법정 본문은 main 의 안쪽 여백을 한 번만 쓴다(이중 여백 없음)
  assert.doesNotMatch(read("components/product/legal-page.tsx"), /<article className="[^"]*\bpx-6\b/)
  for (const slug of ["privacy", "terms", "refund"]) assert.ok(existsSync(join(T, "app", "(legal)", slug, "page.tsx")))
})

test("F5 한글 낱말은 lang=ko 로 표시한다 — 글은 그대로, 언어만 알린다(영어 쪽의 「(광고)」)", async () => {
  const src = read("components/product/legal-page.tsx")
  assert.match(src, /<span key=\{i\} lang="ko">/)
  // 같은 식을 실제로 돌려 본다: 한글 낱말 둘레만 갈라지고(양성), 영어 글은 그대로다(음성)
  const m = /const HANGUL_RUN = (\/.*\/)\n/.exec(src)
  const re = new RegExp(m[1].slice(1, -1))
  const parts = 'the subject starts with "(광고)" (Korean for "advertisement") and 수신 거부 too'.split(re)
  assert.deepEqual(parts.filter((_, i) => i % 2 === 1), ["광고", "수신 거부"])
  assert.equal(parts.join(""), 'the subject starts with "(광고)" (Korean for "advertisement") and 수신 거부 too', "글이 바뀌지 않는다")
  assert.equal("only English here.".split(re).length, 1)
  // 법률 뜻: 처리방침 본문 문장은 건드리지 않았다
  assert.match(read("content/legal/privacy.json"), /In Korea the subject starts with \\"\(광고\)\\" \(Korean for \\"advertisement\\"\)/)
})

test("F7 /account: 로그아웃이면 다른 보호된 쪽처럼 돌아올 곳(next)을 단 로그인 안내", () => {
  const page = read("app/(product)/account/page.tsx")
  assert.match(page, /if \(!\(await currentSession\(\)\)\) return <SignInRequired next="\/account" \/>/)
  assert.match(page, /return <AccountArea \/>/)
})
