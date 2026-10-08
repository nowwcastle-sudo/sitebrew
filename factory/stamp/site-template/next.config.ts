import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

import { securityHeaders } from "./security-headers.mjs"

// 찍어낸 사이트는 저장소 안(.tmp)에서도 밖(out/)에서도 만들어진다 — 위쪽 폴더의 잠금 파일을 뿌리로 잘못 잡지 않게 이 폴더를 뿌리로 못 박는다.
// WF_STATIC_EXPORT=1 이면 정적 내보내기다(P3-3 Task 13 단일 HTML): output "export" 는 distDir 로 내보낸 폴더를 정한다(Next 16 「Static Exports」 가이드).
// 기본 이미지 로더는 정적 내보내기에서 쓸 수 없으므로 unoptimized 로 둔다. 평소 빌드(06-pages)에는 이 환경 변수를 주지 않는다.
// 보안 헤더(대장 C171): 평소 빌드만 headers() 를 싣는다(Next 는 output "export" 에서 headers 를 무시하고 경고한다). CSP 의 인라인 script 해시는 빌드 뒤 scripts/csp-hashes.mjs 가 붙인다.
const staticExport = process.env.WF_STATIC_EXPORT === "1"
// 빌드 병렬도(P3-4 골든 실행 — 메모리가 모자란 머신): WF_BUILD_CPUS=<양의 정수> 일 때만 `experimental.cpus`(페이지 데이터 수집·정적 생성 작업자 수, 기본 코어 수 − 1)를 그 값으로 낮춘다.
// 이 변수는 06-pages 빌드를 돌리는 쪽이 환경 변수로 줄 때만 켜진다 — 없으면 설정이 예전과 똑같고 출력도 같다(근거: Next.js 문서 「Memory Usage」·staticGeneration, experimental.cpus 기본값 cores − 1 에는 환경 변수가 없다).
const buildCpus = Number(process.env.WF_BUILD_CPUS)
const limitCpus = Number.isInteger(buildCpus) && buildCpus > 0
// 타입 검사 분리(06-pages 빌드만): WF_BUILD_SKIP_TYPECHECK=1 이면 `typescript.ignoreBuildErrors` 로 next build 의 내장 타입 검사(별도 작업자 ~0.6GB)를 건너뛴다. 이 변수는 빌드를 돌리는 쪽(site-install.mjs nextBuild)이
// WF_BUILD_SPLIT_TYPECHECK=1 일 때 `next typegen && tsc --noEmit` 이 통과한 뒤에만 준다 — 타입 검사는 따로 먼저 강제된다(Next.js 문서 next.config 「typescript」 ignoreBuildErrors · CLI 「next typegen」).
const skipTypecheck = process.env.WF_BUILD_SKIP_TYPECHECK === "1"
// 변환 작업자 줄이기(P3-4 골든 실행 — saas-2/c 빌드 피크에 Turbopack 변환 자식 node 466MB 가 겹쳐 가드 정지 5회): WF_BUILD_LOWMEM=1 이면
// `experimental.turbopackPluginRuntimeStrategy: "workerThreads"` 로 PostCSS·로더를 자식 프로세스 풀 대신 작업자 스레드에서 돌린다(Next 16.3 config-shared.d.ts — "should use less memory and CPU", 기본 childProcesses).
// 없으면 설정이 예전과 똑같다. 출력(빌드 산출물)은 바뀌지 않고 변환이 도는 자리만 바뀐다.
const lowMem = process.env.WF_BUILD_LOWMEM === "1"
const experimental = {
  ...(limitCpus ? { cpus: buildCpus } : {}),
  ...(lowMem ? { turbopackPluginRuntimeStrategy: "workerThreads" as const } : {}),
}

const nextConfig: NextConfig = {
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  ...(Object.keys(experimental).length ? { experimental } : {}),
  ...(skipTypecheck ? { typescript: { ignoreBuildErrors: true } } : {}),
  ...(staticExport
    ? { output: "export", distDir: ".next-export", images: { unoptimized: true } }
    : {
        async headers() {
          return [{ source: "/(.*)", headers: securityHeaders({ dev: process.env.NODE_ENV !== "production" }) }]
        },
      }),
}

export default nextConfig
