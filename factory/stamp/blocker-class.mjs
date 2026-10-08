// 공개 불가 사유 두 갈래(factory v1 Task 6.1 · 합의안 D19) — 순수 모듈(import 없음). 07-qa(qa.mjs)와 방향 보드(direction-board/build.mjs)가 이것 하나를 부른다.
//   input   = 대표 입력을 기다리는 사유: 실제 사진 필요 · 사이트 주소 미정 · 확인 필요 사실 · 예시 연락처 · 법률 검토 미완(검토 파일 없음) + 운영 점검의 facts-empty 줄(확인 필요 사실이 비어서 생긴다, FV1 5.2)
//   quality = 그 밖 전부(접두가 없는 문장 포함). 기계 기준은 quality 0 이다 — input 은 운영자가 채우면 풀리고 quality 는 공장이 고친다.
// 접두 표는 세 곳에 있다: gen-pages.mjs BLOCKER(14) · qa.mjs QA_PREFIX(7) · sitemap.mjs BLOCKER_PREFIX(1). 표에 접두를 더하면 아래 두 목록 중 한 곳에도 더한다 —
// 빼먹으면 factory/scripts/blocker-class.test.mjs 가 실패한다(표의 모든 접두가 정확히 한 목록에 있는지 · 소스의 「공개 불가 — 」 글자 상수가 전부 목록에 있는지 본다).
// 이 모듈이 표를 import 하지 않는 이유: gen-pages·qa 는 무거워서(Next·Chrome 도구를 끌어온다) 보드 빌더가 이 함수 때문에 그것들을 읽으면 안 된다.

/**
 * product 완성(saas·pwa) 후보를 미리보기로 배포할 때(FINAL-WF E6) — 인증·결제는 mock 어댑터라 공개 주소에서 실제 가입·결제가 안 된다.
 * 사유는 입력 대기가 아니라 품질 갈래다(대표 자료로 안 풀리고 launch-factory 연결이 풀어 준다). 표지(NOTICE)는 08-board.json 과 CLI 출력에 싣는다.
 */
export const MOCK_PREVIEW_BLOCKER = '공개 불가 — 인증·결제 미연결(launch-factory 연결 필요)'
export const MOCK_PREVIEW_NOTICE = 'mock 인증·결제 — 실제 가입·결제 안 됨'

/** 07-qa 결과에 미리보기 사유를 더한 새 값(받은 값은 바꾸지 않는다). 이미 있으면 그대로. */
export function withMockPreviewBlocker(qa) {
  if (!qa || (qa.blockers ?? []).includes(MOCK_PREVIEW_BLOCKER)) return qa
  return { ...qa, publishable: false, blockers: [...(qa.blockers ?? []), MOCK_PREVIEW_BLOCKER] }
}

/** 대표 입력을 기다리는 접두 — 다섯 가지. */
export const INPUT_PREFIXES = [
  '공개 불가 — 실제 사진 필요: ', // gen-pages BLOCKER.photo (「이미지 준비 중」 꼬리표가 붙어도 같은 접두)
  '공개 불가 — 사이트 주소 미정', // gen-pages BLOCKER.site
  '공개 불가 — 확인 필요 사실: ', // gen-pages BLOCKER.fact
  '공개 불가 — 예시 연락처(예약 도메인): ', // gen-pages BLOCKER.reserved
  '공개 불가 — 법률 검토 미완: ', // qa QA_PREFIX.legalPending
]

/** 품질 접두 — 입력을 받아도 안 풀리는 사유(공장이 고친다). 목록은 분류가 빠지지 않았음을 시험이 확인하는 자리이고, 함수는 이 목록을 보지 않는다(input 이 아니면 quality). */
export const QUALITY_PREFIXES = [
  '공개 불가 — 자료 연결 안 됨: ', // gen-pages BLOCKER.unbound
  '공개 불가 — 예시 문구 남음: ', // example
  '공개 불가 — 구조 데이터 만들지 못함: ', // jsonld
  '공개 불가 — 법정 링크가 이어질 쪽 없음: ', // link
  '공개 불가 — 없는 쪽·앵커로 가는 링크: ', // deadLink (FINAL-WF2 AB1·AB3·AB15)
  '공개 불가 — 메타 설명이 자리표시: ', // metaPlaceholder (FINAL-WF2 AB4)
  '공개 불가 — 필수 섹션 그리지 않음: ', // undrawn
  '공개 불가 — 법정 초안이 콘텐츠와 다름: ', // legalStale
  '공개 불가 — 사업자 정보 표시 없음: ', // bizInfo
  '공개 불가 — 다른 언어·다른 사업의 화면 문구 남음: ', // foreign
  '공개 불가 — 관문 실패: ', // qa QA_PREFIX.gate
  '공개 불가 — 관문 도구 실패(측정 못 함): ', // tool
  '공개 불가 — 법률 검토 실패: ', // legalFail
  '공개 불가 — 운영 점검 실패: ', // ops
  '공개 불가 — 원형 엄격 기준: ', // strict
  '공개 불가 — 대담안 안전 기준: ', // bold
  '공개 불가 — 필수 섹션 블록 없음: ', // sitemap BLOCKER_PREFIX
  MOCK_PREVIEW_BLOCKER, // qa QA_PREFIX.mockPreview (stamp.mjs 가 product 후보의 --deploy-preview 때 더한다)
]

/**
 * 운영 점검 줄 중 검사 id 가 facts-empty 인 것은 input 이다 — 콘텐츠에 「확인 필요」 자리 표시가 남아서 생긴 줄이라 확인 필요 사실과 같은 뜻이다(FV1 5.2).
 * 줄 모양은 `<접두><[레시피 쪽] 이름표><검사 id> <값> — <까닭>` (ops-gate.mjs describeCheck). 검사 id 는 낱말 경계로 읽어 facts-empty-extra 같은 다른 id 는 품질이다.
 */
const OPS_INPUT_LINE = /^공개 불가 — 운영 점검 실패: (?:\[[^\]]*\]\s*)?facts-empty(?![\w-])/

/** 사유 한 줄 → "input" | "quality". 줄의 첫머리가 input 접두이거나 facts-empty 운영 점검 줄일 때만 input 이다(접두 없는 문장·문자열이 아닌 값은 quality). */
export function blockerClass(line) {
  return typeof line === 'string' && (INPUT_PREFIXES.some((p) => line.startsWith(p)) || OPS_INPUT_LINE.test(line)) ? 'input' : 'quality'
}

/** 사유 줄들 → { input, quality } (순서 유지, 입력은 바꾸지 않는다). */
export function splitBlockers(lines) {
  const out = { input: [], quality: [] }
  for (const l of lines ?? []) out[blockerClass(l)].push(l)
  return out
}
