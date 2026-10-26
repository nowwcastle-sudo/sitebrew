// 런북 장 글 파서 시험(오프라인). 3b 장 글 원본을 그대로 복사한 고정물과 규약을 하나씩 어긴 작은 고정물을 읽는다.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { actions, envTokens, parseChapterFile } from "../runbook/parse.mjs"

const FIX = join(import.meta.dirname, "fixtures", "runbook")
const read = (name) => readFileSync(join(FIX, name), "utf8")
const parse = (name) => parseChapterFile(read(name), name)
const chapter = (parsed, gid) => parsed.chapters.find((c) => c.gid === gid)

test("3b 원본: 장 셋, 제목 둘 다, 공유 절 둘은 장 본문에 섞이지 않는다", () => {
  const parsed = parse("booking-notify-push.md")
  assert.deepEqual(parsed.chapters.map((c) => c.gid), ["G-booking", "G-notify", "G-push"])
  const notify = chapter(parsed, "G-notify")
  assert.deepEqual(notify.title, { ko: "카카오 알림톡 · 문자 (Solapi)", en: "Kakao Alimtalk and text (Solapi)" })
  assert.match(notify.body.ko, /^- 등록 1 — Solapi 계정/)
  assert.match(notify.body.en, /^- Register 1 — Solapi account/)
  // 장 본문은 자기 `##` 줄과 다음 `##` 전까지만 — 영어 G-booking 에 G-notify 글이 새지 않는다
  assert.ok(!chapter(parsed, "G-booking").body.en.includes("Solapi"))
  assert.match(parsed.shared.ko, /^## 0\. mock 과 live[\s\S]*## 1\. 환경 변수/)
  assert.match(parsed.shared.en, /^## 0\. mock vs live[\s\S]*## 1\. Environment variables/)
  // 첫 `##` 앞 머리말은 공유 절이 아니다
  assert.ok(!parsed.shared.ko.includes("확인일"))
  assert.ok(!chapter(parsed, "G-booking").body.ko.includes("BOOKING_OWNER_EMAIL` | 개인정보"))
})

test("영어 제목 생략 · 영어에 없는 장은 던지지 않고 남긴다 · 공유 절 없는 파일", () => {
  const parsed = parse("en-no-title.md")
  assert.deepEqual(chapter(parsed, "G-one").title, { ko: "하나", en: "" })
  assert.ok(chapter(parsed, "G-one").body.en.startsWith("- Register 1"))
  assert.deepEqual(Object.keys(chapter(parsed, "G-two").body), ["ko"])
  assert.deepEqual(parsed.shared, {})
})

test("구분선 없음 → noRule, 같은 파일 안 id 중복 → dupGid (파일 이름과 줄)", () => {
  assert.throws(() => parse("no-rule.md"), (e) => e.code === "noRule" && e.message.includes("no-rule.md"))
  assert.throws(() => parse("dup-gid.md"), (e) => e.code === "dupGid" && /dup-gid\.md:7\b/.test(e.message))
})

test("표의 |---| 와 코드 블록 안의 --- · ## 은 구분선·절로 오인되지 않는다", () => {
  const parsed = parse("table-rule.md")
  assert.deepEqual(parsed.chapters.map((c) => c.gid), ["G-table"])
  assert.match(chapter(parsed, "G-table").body.ko, /\| `TABLE_KEY` \| 키 \|[\s\S]*## 제목이 아니다/)
  assert.equal(chapter(parsed, "G-table").title.en, "Table")
  assert.deepEqual(parsed.shared, {})
})

test("`## G-` 로 시작하는데 모양이 틀린 제목은 공유 절로 새지 않고 던진다", () => {
  assert.throws(() => parseChapterFile("## G-Bad title\n\n---\n", "x.md"), (e) => e.code === "badHeading" && e.message.includes("x.md:1"))
})

test("envTokens: 백틱 안 UPPER_SNAKE 만, 코드 블록 안은 낱말로, 정렬·중복 제거", () => {
  const text = "`RESEND_API_KEY` 와 `npm run dev`, `Pro`, `KA01PF…`, `NOTIFY_TEMPLATES.alimtalkId`, `LF_MODE=mock`, 다시 `RESEND_API_KEY`, 맨 글 DATABASE_URL\n```sh\nvercel env add CRON_SECRET\n```\n`A_B`"
  assert.deepEqual(envTokens(text), ["A_B", "CRON_SECRET", "RESEND_API_KEY"])
})

test("actions: 「등록」·「설정」 행동 줄을 세고, 「없음」 줄은 세지 않는다", () => {
  const notify = chapter(parse("booking-notify-push.md"), "G-notify")
  assert.deepEqual([actions(notify.body.ko), actions(notify.body.en)], [5, 5])
  const push = chapter(parse("booking-notify-push.md"), "G-push")
  assert.deepEqual([actions(push.body.ko), actions(push.body.en)], [1, 1])
  assert.equal(actions(chapter(parse("en-no-title.md"), "G-two").body.ko), 0)
  // `### 설정` 아래 번호 줄은 하나씩 센다
  const table = chapter(parse("table-rule.md"), "G-table")
  assert.deepEqual([actions(table.body.ko), actions(table.body.en)], [3, 2])
})
