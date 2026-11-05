// 예시 값이 든 칸을 자리 표시로 바꾼 사본(v0.2.6 T18) — JSON-LD·메타가 그 칸을 싣지 않게 한다(scrubNeedsCheck 는 자리 표시 글자를 뺀다).
// 경로는 gen-pages 가 content/site.json 의 sample.scrub 에 적는다(점 표기, 배열은 인덱스). 받은 값은 바꾸지 않고, 없는 경로는 건너뛴다.
export function scrubSamples<T>(content: T, paths: string[], mark: string): T {
  const copy = structuredClone(content) as Record<string, unknown>
  for (const path of paths) {
    const keys = path.split(".")
    const last = keys.pop() as string
    const holder = keys.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), copy)
    if (holder && typeof holder === "object" && last in (holder as object)) (holder as Record<string, unknown>)[last] = mark
  }
  return copy as T
}
