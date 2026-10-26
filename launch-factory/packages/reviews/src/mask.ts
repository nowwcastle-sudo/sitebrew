// 작성자 이름 가리기(순수 함수). 저장하기 전에 한 번 거치고, 원래 이름은 어디에도 남기지 않는다.
//   한글·한 낱말: 첫 글자 + * (김민수 → 김**, Dana → D***)
//   여러 낱말 로마자: 이름 + 성의 첫 글자 (Dana Kim → Dana K.)
//   이메일·전화번호처럼 보이는 값(@·숫자): 첫 글자 + ***  — 그 밖의 글자는 새지 않는다
const MAX_CODEPOINTS = 40
const HANGUL = /^[\p{Script=Hangul}]+$/u

const first = (s: string) => Array.from(s)[0] ?? ""

export function maskName(raw: string): string {
  const name = Array.from(raw.trim().replace(/\s+/g, " ")).slice(0, MAX_CODEPOINTS).join("")
  if (!name) return ""
  const chars = Array.from(name)
  if (name.includes("@") || /\d/.test(name)) return `${chars[0]}***`
  const words = name.split(" ")
  if (words.length >= 2 && !HANGUL.test(words.join(""))) {
    const given = Array.from(words[0] as string).slice(0, 20).join("")
    return `${given} ${first(words[words.length - 1] as string).toUpperCase()}.`
  }
  const stars = HANGUL.test(name) ? Math.min(chars.length - 1, 4) : 3
  return `${chars[0]}${"*".repeat(Math.max(1, stars))}`
}
