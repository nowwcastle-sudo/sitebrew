#!/usr/bin/env node
// npm run ci:verify — PR/푸시 CI 작업이 도는 것과 똑같은 검사 묶음. 병합 전에 컨트롤러가 로컬에서 같은 명령을 돌린다(로컬 병합 관문).
// ci.yml 은 이 명령 한 줄만 부른다. 그래서 로컬과 CI 가 같은 것을 본다.
//   node scripts/ci/verify.mjs [--list] [--only a,b] [--skip a,b]
// 한 단계가 실패해도 끝까지 돌고 마지막에 표로 모은다(고칠 것을 한 번에 본다). 종료 코드 0 = 모두 통과(또는 도구 건너뜀만 있음) · 1 = 실패 있음.
// 외부 도구 단계(actionlint·zizmor·gitleaks·osv-scanner)는 CI 에서는 반드시 있어야 한다(없으면 실패). 이 PC 처럼 설치하지 않은 곳에서는
// 「SKIP(도구 없음)」으로 표시하고 통과로 세지 않는다 — 요약 줄에 건너뛴 이름이 남는다. LF_CI_REQUIRE_TOOLS=1 이면 로컬에서도 실패로 센다.
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { IN_CI, npm, ROOT, run, runSteps, SECURITY_STEPS } from "./run-steps.mjs"
import { runTests } from "./run-tests.mjs"

const TAP = join(ROOT, ".tmp", "test-results.tap")

function skippedRatchet() {
  if (!existsSync(TAP)) {
    console.log(`${TAP} 가 없다 — test 단계가 먼저 돌아야 한다`)
    return 1
  }
  const baseline = JSON.parse(readFileSync(join(ROOT, "ci", "baselines", "skipped-tests.json"), "utf8"))
  const count = readFileSync(TAP, "utf8").split("\n").filter((l) => /# SKIP/.test(l)).length
  console.log(`건너뛴 시험 ${count}개 · 기준선 최대 ${baseline.max}개`)
  if (count > baseline.max) {
    console.log(`새로 건너뛰는 시험이 ${count - baseline.max}개 늘었다 — 건너뛰지 말고 고치거나, 이유를 달아 기준선(ci/baselines/skipped-tests.json)을 올린다`)
    return 1
  }
  if (IN_CI && count < baseline.max) {
    console.log(`건너뛴 시험이 기준선보다 줄었다(${count} < ${baseline.max}) — ci/baselines/skipped-tests.json 의 max 를 ${count} 로 낮춘다(되돌리지 않게)`)
    return 1
  }
  return 0
}

export const STEPS = [
  { id: "lint", title: "ESLint", run: npm("lint") },
  { id: "ux-static", title: "화면 없는 액션·글의 약속·메일 링크(baseline 래칫)", run: npm("check:ux-static") },
  { id: "typecheck", title: "타입 검사", run: npm("typecheck") },
  { id: "test", title: "단위 시험(lockfile 규칙·서버 액션 인증·마이그레이션 일치 포함)", run: () => runTests({ tap: TAP }) },
  { id: "skipped-tests", title: "건너뛴 시험 수 래칫", run: skippedRatchet },
  { id: "contract", title: "계약 잠금 일치", run: npm("contract:check") },
  { id: "template", title: "템플릿 잠금 일치(CI 파일 포함)", run: npm("template:check") },
  { id: "registry", title: "레지스트리 최신", run: npm("registry:check") },
  { id: "readme", title: "README 가 현재 버전·명령·필요 환경과 맞다", run: npm("readme:check") },
  { id: "env-check", title: "환경 이름 점검(오프라인)", run: npm("env:check") },
  { id: "hangul", title: "한글 리터럴 검사(Task 18)", run: () => run(process.execPath, ["--test", "--test-name-pattern=한글 (문자열 )?리터럴", "packages/i18n/test/i18n.test.mjs"]) },
  ...SECURITY_STEPS,
  // 빌드 스모크(LFSMOKE): 템플릿을 실제로 빌드해 띄우고 Playwright 로 본다. 느려서(로컬 약 3~4분) 맨 뒤에 둔다. CI 는 이 단계를 verify 작업에서 건너뛰고(--skip smoke) build-smoke 작업이 따로 돈다 —
  // 브라우저 설치와 분 단위 청구를 작업별로 나누려는 것이고, 두 작업을 합치면 이 목록 전체다(scripts/test/smoke.test.mjs 가 맞춰 본다). 브라우저가 없는 PC 에서만 이유를 적고 건너뛴다.
  {
    id: "smoke",
    title: "빌드 스모크: mock 장면×쪽 200·오류 경계·axe 경고 + live 켜짐",
    run: () => {
      const c = run(process.execPath, ["template/scripts/ci/smoke.mjs"])
      return c === 3 ? "skip:브라우저 없음 — Chrome·Edge 설치 또는 npx playwright install chromium" : c
    },
  },
]

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) process.exitCode = runSteps(STEPS, "ci:verify")
