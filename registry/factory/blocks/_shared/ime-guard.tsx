import type * as React from "react"

// 한글 조합 중 Enter 가드(P3-2 Task 7a, 대장 A42). 한글은 조합 중인 글자를 Enter 로 확정하는데, 처리기가 그 keydown 을 그대로 받으면
// 조합 중인 글자가 전송·선택된다(cmdk 이슈 #348 꼴 — cmdk 1.1.1 은 안에서 막고 있다). Enter 로 전송·선택·다음 단계를 여는 처리기는 이 가드를 거친다:
//   onKeyDown={(e) => { if (e.key === "Enter" && !isComposingEnter(e)) go() }}
// 크롬은 조합 중 keydown 에 isComposing 을 켜고(key 는 "Process"), 사파리는 조합이 끝난 뒤 Enter 를 keyCode 229 로 다시 보낸다 — 둘 다 막는다.
// lint-ui `ime-enter` 가 "Enter" 키 비교가 있는 블록 원천에 이 함수 호출이 없으면 실패시킨다.
export function isComposingEnter(e: Pick<React.KeyboardEvent, "keyCode"> & { nativeEvent: { isComposing?: boolean } }): boolean {
  return e.nativeEvent.isComposing === true || e.keyCode === 229
}
