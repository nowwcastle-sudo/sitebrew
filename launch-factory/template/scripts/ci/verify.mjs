#!/usr/bin/env node
// 제품 `npm run ci:verify` — 제품 저장소에서 CI 와 로컬이 같이 도는 검사. launch-factory 템플릿이 실어 준다(template:check 가 지킨다).
//   타입 검사(설치돼 있을 때) + 보안 단계(actionlint · zizmor · gitleaks 트리·범위 · osv-scanner · 도구 양성 대조) + 빌드 스모크(smoke — 빌드·장면×쪽·axe·live 켜짐).
// 제품 고유 검사는 이 목록 뒤에 제품이 더한다 — 보안 단계 목록(SECURITY_STEPS)과 smoke 는 지우지 않는다.
import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { npm, ROOT, run, runSteps, SECURITY_STEPS } from "./run-steps.mjs"

export const STEPS = [
  {
    id: "typecheck",
    title: "타입 검사",
    run: () => (existsSync(join(ROOT, "node_modules")) ? npm("typecheck")() : "skip:npm ci 를 안 했다(node_modules 없음)"),
  },
  ...SECURITY_STEPS,
  // 빌드 스모크(LFSMOKE): 제품을 실제로 빌드해 띄우고 Playwright 로 본다(scripts/ci/smoke.mjs). CI 는 이 단계를 verify 작업에서 건너뛰고(--skip smoke) build-smoke 작업이 따로 돈다.
  {
    id: "smoke",
    title: "빌드 스모크: mock 장면×쪽 200·오류 경계·axe 경고 + live 켜짐",
    run: () => {
      if (!existsSync(join(ROOT, "node_modules"))) return "skip:npm ci 를 안 했다(node_modules 없음)"
      const c = run(process.execPath, ["scripts/ci/smoke.mjs"])
      return c === 3 ? "skip:브라우저 없음 — Chrome·Edge 설치 또는 npx playwright install chromium" : c
    },
  },
]

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exitCode = runSteps(STEPS, "ci:verify")
