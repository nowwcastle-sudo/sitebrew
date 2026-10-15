// (Sitebrew: 기본은 저장소 뿌리의 지금 파일을 읽는다. 아래 고정 커밋은 공개 이력에 없는 스냅샷이라 LF_WF_CONFORMANCE_COMMIT 로 다른 커밋을 따로 요청할 때만 git 으로 읽는다.)
// web-factory 적합성 묶음 네 개(billing·auth·analytics·notify)를 **한 커밋에 고정해** 임시 폴더로 꺼내 불러온다.
// 계약 잠금(packages/contract/contract.lock.json)에는 적합성 묶음 파일이 아직 없다(sync-contract 의 가져올 목록에 conformance/ 가 없다). 영구 가져오기는 대장 D45 에서 하고 그때 이 파일을 지운다.
// 묶음 파일은 태그 v0.1.0(a7d27ad)에 고정한다. v0.0.11(94c6d9e)에서 v0.1.0 까지는 묶음 파일(conformance/*·lib/retention-offer.ts)과 계약 4파일이 바뀌지 않았다(검사 수 173 그대로 — docs/qa/lfpin-v012.md §2). v0.0.10(8f199e4)에서 v0.0.11 까지 바뀐 것: 묶음 옵션 `requireConfirmation`(P3-7 AXC, G11(d)) — 켜면 `*.confirmation.*` 검사 8개(billing 4·auth 3·notify 1)가 더 돌고 기존 검사의 승인 행동 호출에 confirmed: true 가 자동으로 실린다. 기본(끔)은 v0.0.10 과 같은 165개다. LF 는 billing-paddle·consent/notify 만 켠다(docs/qa/lfpin-v011.md §3). v0.0.9(b4d3f23)에서 v0.0.10 까지는 묶음 파일(conformance/*·lib/retention-offer.ts)이 바뀌지 않았다(계약 쪽은 block-contract.ts 의 ActionFailureCode 에 signInRequired·AsyncState error 에 code? 가 늘었을 뿐 — 검사 수 165 그대로). v0.0.8(391778d)에서 v0.0.9 까지 바뀐 것: conformance/auth.ts 에 resetPassword 시나리오 둘(reset-password-unknown-token·reset-password-empty-token — 선택 메서드라 없는 어댑터는 통과, D236)·ports.ts 에 선택 AuthPort.resetPassword·lib/retention-offer.ts 는 그대로. v0.0.7(30ae7d5)에서 v0.0.8 까지는 묶음 파일이 바뀌지 않았다. b2fb648(P3-3 Task 15)에서 v0.0.7 까지 바뀐 것: analytics.ts SAMPLE_EVENTS 에 web_vital·app_install 예시 둘(4febd6e·840924e), lib/retention-offer.ts 문구 — 검사 수는 그대로다.
// 저장소는 환경 변수로 바꾼다: LF_WF_REPO(기본 <sitebrew checkout>), LF_WF_CONFORMANCE_COMMIT(기본 아래 고정값 — 커밋 해시나 태그).
// 적합성 묶음을 꺼내는 곳은 여기 하나다(대장 D195 — 결제·인증·계측·알림 시험과 일괄이 모두 이 로더를 부른다). 패키지 시험 안에 자기 로더를 다시 만들지 않는다.
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// web-factory is the root of this repository (launch-factory/scripts/lib -> three folders up)
const WF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
export const WF_CONFORMANCE_COMMIT = "a7d27ad1a6e1f1f7ee7004f20b418cc4b9e155f1"
const BASE = "registry/factory/contract/conformance"
const FILES = {
  "billing.ts": `${BASE}/billing.ts`,
  "auth.ts": `${BASE}/auth.ts`,
  "analytics.ts": `${BASE}/analytics.ts`,
  "notify.ts": `${BASE}/notify.ts`,
  "conformance-core.ts": `${BASE}/conformance-core.ts`,
  "retention-offer.ts": "registry/factory/lib/retention-offer.ts",
}

/**
 * 불러올 수 없으면 { skip: 이유 } — 조용히 넘기지 않는다(호출한 쪽이 종료 코드로 알린다).
 * 되돌려 주는 것: { billing, auth, analytics, notify, retention, commit, cleanup } — 각각 그 모듈의 export 모음.
 */
export async function loadWfConformance({ repo = process.env.LF_WF_REPO ?? WF_ROOT, commit = process.env.LF_WF_CONFORMANCE_COMMIT ?? WF_CONFORMANCE_COMMIT } = {}) {
  if (!existsSync(repo)) return { skip: `web-factory 체크아웃 없음(${repo}) — LF_WF_REPO 로 알려 준다. 후속: 대장 D10·D45(적합성 묶음을 계약 가져오기로)` }
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 })
  let sha
  let fromTree = false
  if (commit === WF_CONFORMANCE_COMMIT && existsSync(join(repo, BASE))) {
    sha = "working-tree"
    fromTree = true
  } else try {
    sha = git("rev-parse", `${commit}^{commit}`).trim()
  } catch {
    return { skip: `web-factory 커밋 ${commit.slice(0, 7)} 을 찾지 못함(${repo}) — 후속: 대장 D10·D45` }
  }
  const dir = mkdtempSync(join(tmpdir(), "lf-conformance-all-"))
  const cleanup = () => rmSync(dir, { recursive: true, force: true })
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }))
    for (const [name, path] of Object.entries(FILES)) {
      let src = fromTree ? readFileSync(join(repo, path), "utf8") : git("show", `${sha}:${path}`)
      // 런타임 import 는 conformance-core 와 lib retention-offer 둘뿐이다. `import type` 은 타입 제거로 사라진다.
      src = src.replace(/from "\.\/conformance-core"/g, 'from "./conformance-core.ts"')
      src = src.replace(/from "@\/registry\/factory\/lib\/retention-offer"/g, 'from "./retention-offer.ts"')
      writeFileSync(join(dir, name), src)
    }
    const load = (name) => import(pathToFileURL(join(dir, name)).href)
    const [billing, auth, analytics, notify, retention] = await Promise.all(["billing.ts", "auth.ts", "analytics.ts", "notify.ts", "retention-offer.ts"].map(load))
    return { billing, auth, analytics, notify, retention, commit: sha.slice(0, 7), cleanup }
  } catch (e) {
    cleanup()
    return { skip: `web-factory 적합성 묶음을 불러오지 못함(${sha.slice(0, 7)}): ${e instanceof Error ? e.message : String(e)}` }
  }
}
