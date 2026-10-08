import { formatBizNo, formatPhoneKr } from "@/lib/phone"

// 입력 서식(P3-2 Task 7a, 대장 A43): 전화번호(입력 중 자동 하이픈·붙여넣은 여러 형식)·사업자등록번호(3-2-5)를 칸 값에 바로 적용하고 커서를 지킨다.
// 폼을 가진 블록의 글 칸(TextField·FormField)이 format prop 으로 부른다. 저장은 서식과 무관하다 — 전화번호는 normalizePhone 이 하이픈을 뗀다.
export type InputFormat = "phone" | "bizno"

/** 입력·붙여넣기 뒤(onInput)에 부른다. 한글 조합 중(IME)에는 건드리지 않는다. 값이 그대로면 아무것도 하지 않는다(커서 튐 없음). */
export function applyInputFormat(el: HTMLInputElement, kind: InputFormat, composing = false) {
  if (composing) return
  const next = (kind === "phone" ? formatPhoneKr : formatBizNo)(el.value, el.selectionStart ?? el.value.length)
  if (next.value === el.value) return
  el.value = next.value
  if (typeof document !== "undefined" && document.activeElement === el) el.setSelectionRange(next.caret, next.caret)
}
