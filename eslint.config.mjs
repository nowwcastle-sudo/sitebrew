import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // react-hooks 7.1.1 의 set-state-in-effect(「effect 안에서 setState 를 곧바로 부르지 않는다」, 규칙 설명 — 설치본
  // cjs/eslint-plugin-react-hooks.production.js)는 아래 세 원천에만 경고로 낮춘다(리뷰 M1). 나머지 파일은 권장값(error) 그대로다.
  //  - carousel(onSelect 로 버튼 상태 맞추기)·use-mobile(matchMedia 첫 값): 업스트림 shadcn 모양 그대로. 컴파일본 사본도 같다.
  //  - /qa/recipes 페이지: ?r= 를 정적 렌더 뒤에 읽는다(useSearchParams 는 페이지를 클라이언트 렌더로 떨어뜨린다).
  // immutability 는 낮추지 않는다 — 걸리던 useMergedRef(dialog·alert-dialog)를 assignRef 로 고쳤다.
  {
    files: [
      "registry/factory/ui-src/carousel.tsx",
      "registry/factory/ui/carousel.tsx",
      "registry/factory/r/*/ui/carousel.tsx",
      "app/qa/shrunk/ui/carousel.tsx",
      "registry/factory/hooks/use-mobile.ts",
      "app/qa/recipes/page.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 저장소 밖으로 나가지 않는 것: 갤러리 빌드 사본(.tmp, gitignore)·동기화 사본·일부러 틀리게 쓴 검수 fixture·참고 자료
    ".tmp/**",
    ".ds-sync/**",
    "factory/qa/fixtures/**",
    // 찍어낸 사이트 뼈대(P3-3 Task 9): 레시피·블록을 설치한 사이트 안에서만 import 가 풀린다 — 그 사이트의 next build 가 검사한다
    "factory/stamp/site-template/**",
    "references/**",
    // Sitebrew holds more than web-factory: the other parts have their own tools and checks
    "launch-factory/**",
    "packages/**",
    "plugins/**",
  ]),
]);

export default eslintConfig;
