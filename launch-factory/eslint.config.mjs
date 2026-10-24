import js from "@eslint/js"
import tseslint from "typescript-eslint"
import globals from "globals"

export default tseslint.config(
  // src/web-factory 는 web-factory 원본을 그대로 실은 것이다(원본 쪽 lint 대상). 고치지 않으므로 여기서 보지 않는다.
  { ignores: ["**/node_modules/**", "packages/*/src/web-factory/**", "template/.next/**", ".tmp/**", "**/.tmp/**", ".vercel/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  // 서비스 워커는 브라우저 워커 전역(self·clients·registration)을 쓴다
  { files: ["**/public/sw.js"], languageOptions: { globals: { ...globals.serviceworker } } },
)
