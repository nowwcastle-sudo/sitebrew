// keep — 템플릿 것이 이긴다. 시안 파일은 출력에 가져가지 않고, 가져가지 않은 목록만 남긴다
export const id = "keep"

export function run(state) {
  state.kept.push(...state.plan.filter((p) => p.rule.kind === "keep").map((p) => p.file))
  return state
}
