// P3-3 골든 복사본 6개와 원본의 관계(factory v1 Task 6.2) — 원본(briefs/*.json)은 14b 가 쓰므로 그대로 두고, 복사본(briefs/golden/*.json)은 빈 사실을 채웠다.
//   원본에 있던 사실은 ① 같은 값이거나 ② 원본 문장으로 시작하는 더 긴 문장(배송 사실에 도서산간 추가 비용을 덧붙인 것 …)이거나 ③ 아래 표의 값만 바뀐다.
//   바뀐 값 = 실존할 수 있는 도로명 번지·실제 지도 서비스 주소를 가상 값(예시로·example.com)으로 고친 것 — 실존 표지 금지(Task 6.2).
export const COPY_REPLACED = {
  'local-1': ['address', 'transit', 'naverMapUrl', 'kakaoMapUrl'],
  'detail-1': ['address'],
  'saas-1': ['address'],
}
// 사실 이야기가 바뀐 topic: 「못 받음」 문구를 뺀 복사본(원본 topic 은 그 말을 한다)
export const COPY_TOPIC_REWRITTEN = ['local-2']

/** 복사본 사실이 원본과 어긋난 사실 이름 목록 — 비면 규칙을 지킨 것. */
export function copyFactProblems(id, copyFacts, origFacts) {
  const bad = []
  for (const [k, v] of Object.entries(origFacts)) {
    const g = copyFacts[k]
    if (g === v) continue
    if ((COPY_REPLACED[id] ?? []).includes(k) && typeof g === 'string' && g.trim() !== '') continue
    if (typeof g === 'string' && g.startsWith(v)) continue
    bad.push(k)
  }
  return bad
}
