// 무거운 시험의 임시 폴더 보존 도우미(계획 4 결함 9) — 시험 본문뿐 아니라 before 훅이 던져도 출력 폴더를 남겨야 같은 폴더에서 실패를 다시 볼 수 있다.
//   guardKeep(fn, onFail) → fn 과 같은 인자를 받는 함수. fn 이 던지면 onFail(err) 를 부른 뒤 같은 오류를 다시 던진다(삼키지 않는다).
export const guardKeep = (fn, onFail) => async (...args) => {
  try {
    return await fn(...args)
  } catch (err) {
    onFail(err)
    throw err
  }
}
