// 가짜 모드 발송함 — JSONL 파일에 한 줄씩. 본문과 전화번호 전체는 쓰지 않는다(끝 4자리·템플릿·채널·시각뿐).
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

export interface OutboxLine {
  at: string
  template: string
  channel: "alimtalk" | "sms" | "lms"
  purpose: "transactional" | "marketing"
  toLast4: string
}

/** 한 줄을 덧붙인다. 쓰지 못하면 던진다(부르는 쪽이 값으로 바꾼다) */
export function appendOutbox(path: string, line: OutboxLine): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(line)}\n`)
}
