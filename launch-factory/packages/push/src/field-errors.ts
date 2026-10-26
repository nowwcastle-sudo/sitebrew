// zod 이슈를 블록 계약의 칸 오류 모양(`fieldErrors`)으로 바꾼다. 같은 칸의 같은 문구는 한 번만.
export type FieldErrors = Partial<Record<string, string[]>>
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors }

/** `flatten` 에 든 경로 조각(예: "keys")은 칸 이름에서 뺀다. 경로가 비면 `form` */
export function fieldErrorsFrom(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>, flatten: readonly string[] = []): FieldErrors {
  const fieldErrors: FieldErrors = {}
  for (const issue of issues) {
    const path = issue.path.filter((p) => !flatten.includes(String(p)))
    const key = path.length ? String(path[0]) : "form"
    const list = (fieldErrors[key] ??= [])
    if (!list.includes(issue.message)) list.push(issue.message)
  }
  return fieldErrors
}
