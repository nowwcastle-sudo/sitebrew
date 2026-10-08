// 격자 열 수(FINAL-WF3 — 공유 조각 block-shared-grid-cols). 항목 수에 맞는 열을 고른다 — 4개가 3열 + 1개(고아 한 칸)·3개가 4열 + 빈 칸으로 그려지지 않게.
// 순수 함수뿐이다(React·DOM 없음). 블록은 결과를 data-cols 로 달고, 열 수에 따른 모양은 CSS(data-[cols=N])가 정한다.

/**
 * 항목 n 개에 쓸 열 수.
 *  · 1~3개는 항목 수 그대로(한 줄, 빈 칸 없음).
 *  · 그 밖에는 prefer 순서대로 첫 열 수 c 가 마지막 줄을 1개로 남기지 않는 것(n % c !== 1)이다 — 4개는 2열(2×2), 7개는 4열(4+3).
 *  prefer 의 기본은 큰 카드 격자용 [3, 2, 4], 작은 타일 격자는 [4, 3, 2]. max 보다 큰 열은 쓰지 않는다.
 */
export function gridCols(n: number, { prefer = [3, 2, 4], max = 4 }: { prefer?: number[]; max?: number } = {}): number {
  if (n <= 1) return 1
  if (n <= 3) return n
  const options = prefer.filter((c) => c <= max)
  for (const c of options) if (n % c !== 1) return c
  return options[0] ?? 3
}
