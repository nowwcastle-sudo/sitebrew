import { StateScreenNotFound } from "@/components/blocks/state-screen/not-found"
import { ProductFooter } from "@/components/product/product-footer"
import { ProductHeader } from "@/components/product/product-header"
import { notFoundCopy } from "@/content/copy.shell.en"
import { errorCopy } from "@/content/copy.ux.en"

export const metadata = { title: errorCopy.notFound.title }

// 없는 주소. Next 기본 404 쪽은 style 속성을 서버에서 그려 엄격 CSP(style-src)에 걸리므로 우리 쪽을 둔다(대장 D14).
// 화면은 web-factory v0.0.10 블록 `state-screen/not-found`(H02·H04·L04)다: 「처음으로」 + 갈 만한 곳 링크 + 지원 경로, 뿌리의 data-error-code="not_found". 서버 컴포넌트·style 속성 없음.
// 위 띠(내비)·바닥글은 제품 화면과 같은 것이다 — 로그인 상태를 보이고(H02), 되돌아갈 길(시작 쪽·문의)과 사업자·약관 링크를 둔다. 쪽 제목은 metadata 가 정한다(제목 템플릿 「쪽 · 제품」).
// 쪽에 다른 h1 이 없으므로 headingLevel 1. 틀은 제품 화면과 같은 세로 칸(min-h-dvh·main flex-1)이다 — 이유는 product-shell.tsx(쿠키 띠가 짧은 쪽의 바닥글을 가리지 않게).
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ProductHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <StateScreenNotFound copy={notFoundCopy} headingLevel={1} />
      </main>
      <ProductFooter />
    </div>
  )
}
