// 설치·빌드 실패 메시지(FINAL-WF P4) — 한 줄 요약 + 로그 마지막 20줄. 가벼운 모듈이라 stamp.mjs·site-install.mjs·gen-pages.mjs 가 함께 쓴다.
import { readFileSync } from 'node:fs'

/** 로그 파일의 마지막 n줄(없으면 빈 글). */
export function tailLog(log, n = 20) {
  try { return readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '').slice(-n).join('\n') } catch { return '' }
}

/** 설치·빌드 실패 메시지: 한 줄 요약 + 로그 마지막 20줄. */
export const failMessage = (what, code, log) => {
  const tail = tailLog(log, 20)
  return `도구 실패: ${what} 종료 ${code} — ${log}${tail ? `\n--- 로그 마지막 20줄 ---\n${tail}` : ''}`
}
