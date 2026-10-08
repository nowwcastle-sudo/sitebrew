// CSV 내보내기 도우미(대장 D90 — 첫 소비자는 관리자 사용자 목록, v0 Task 16).
// 1. UTF-8 BOM: 엑셀(Windows)이 BOM 없는 UTF-8 CSV를 시스템 코드 페이지(CP949)로 읽어 한글이 깨진다.
// 2. 수식 무력화(OWASP CSV Injection): `=`·`+`·`-`·`@`·탭·CR 로 시작하는 칸 앞에 작은따옴표를 붙인다 —
//    엑셀·구글 시트가 그 칸을 수식으로 실행하지 않고 글자로 보인다. 숫자 -5 도 '-5 가 된다(OWASP 권고 그대로, 글자 칸이라 문제없다).
// 3. RFC 4180: 쉼표·큰따옴표·줄바꿈이 있는 칸은 큰따옴표로 감싸고 안의 큰따옴표는 두 번 쓴다. 줄 끝은 CRLF.
// 4. 시각은 서울 시각 `YYYY-MM-DD HH:mm:ss`(엑셀이 날짜로 읽는 모양).

export const CSV_BOM = "﻿"
/** 이 문자로 시작하는 칸은 스프레드시트가 수식으로 읽는다(OWASP CSV Injection) */
export const FORMULA_PREFIXES: readonly string[] = ["=", "+", "-", "@", "\t", "\r"]

export type CsvValue = string | number | boolean | Date | null | undefined
export interface CsvColumn<T> {
  header: string
  value: (row: T) => CsvValue
}

/** 서울 시각 `YYYY-MM-DD HH:mm:ss`. 한국은 일광 절약 시간이 없어 UTC+9 로 고정이다 */
export function seoulDateTime(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ")
}

/** 칸 하나: 글자로 바꾸고 → 수식 무력화 → 따옴표 */
export function csvCell(value: CsvValue): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? seoulDateTime(value) : String(value)
  if (s && FORMULA_PREFIXES.includes(s[0])) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** BOM + 머리 줄 + 행. 행이 없어도 머리 줄은 있다 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")]
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","))
  return CSV_BOM + lines.join("\r\n") + "\r\n"
}
