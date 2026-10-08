// 흔한 비밀번호 거르개(A03·U5 — NIST SP 800-63B: 길이 규칙 위에 흔한·유출 목록 대조). 가입·새 비밀번호 블록의 `isWeakPassword` 로 넘긴다.
// 블록이 직접 부른다(지연 래퍼 없음 — web-factory v0.0.12 의 port-form 이 마우스 제출 경주를 고쳤다, LFPIN12). 길이(8자)는 블록이 먼저 본다 — 여기서는 길이를 채운 뒤에도 흔한 값(상위 목록·한 글자 반복·연속 글자)만 막는다. 빈 값은 필수 검사가 맡는다.
// ponytail: 짧은 내장 목록 + 규칙만 쓴다. 유출 목록(HIBP k-익명 조회 등)이 필요해지면 이 함수를 비동기로 바꿔 거기에 묻는다(블록이 Promise 를 받는다). 서버는 막지 않는다(자기 계정만 약해진다).
const COMMON = new Set(
  (
    "password password1 password12 password123 passw0rd p@ssw0rd 12345678 123456789 1234567890 12341234 123123123 11111111 00000000 87654321 987654321 " +
    "qwerty123 qwertyui qwertyuiop qwer1234 asdf1234 asdfghjk zxcvbnm1 1q2w3e4r 1q2w3e4r5t q1w2e3r4 1qaz2wsx zaq12wsx 1234qwer abc12345 abcd1234 a1234567 a123456789 aa123456 " +
    "iloveyou welcome1 letmein1 admin123 monkey123 dragon123 trustno1 sunshine princess football baseball superman"
  ).split(" "),
)

/** 앞 글자에서 뒤 글자로 한 칸씩 늘기만 하거나(abcdefgh, 12345678) 줄기만 하는(87654321) 값 */
function isRun(s: string): boolean {
  const c = [...s].map((ch) => ch.codePointAt(0)!)
  const step = c[1]! - c[0]!
  return Math.abs(step) === 1 && c.every((v, i) => i === 0 || v - c[i - 1]! === step)
}

export function isWeakPassword(password: string): boolean {
  if (!password) return false
  const p = password.toLowerCase()
  return COMMON.has(p) || /^(.)\1+$/u.test(p) || isRun(p)
}
