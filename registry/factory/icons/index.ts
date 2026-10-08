// 아이콘 정본 모듈. 부품 원천(ui-src)은 아이콘을 여기서만 부른다(lucide-react 등 라이브러리를 직접 부르지 않는다).
// 컴파일이 이 경로를 어댑터로 바꾼다: 기본 모양(ui/)은 ./lucide, 레시피(r/<id>/ui)는 icons.library·weight 가 고른 어댑터
// (compile-styles.mjs iconImports · recipe.mjs iconAdapter). 원천을 타입 검사할 때는 lucide 이름표로 읽는다.
export * from "./lucide"
