// 종류별 정책 표와 순수 검사 — 거절 표(크기·형식·종류·avatar 비로그인)와 키 만들기.
import assert from "node:assert/strict"
import { test } from "node:test"
import { checkUpload, MAX_PRESIGN_SECONDS, PENDING_TTL_MS, STORAGE_KINDS, STORAGE_POLICY } from "../src/policy.ts"
import { buildKey, contentTypeFromName, extensionOf, isStorageKey } from "../src/key.ts"

const MB = 1024 * 1024

test("정책 표: avatar 2MB 공개 · image 5MB 공개 · attachment 10MB 비공개 보유 365일", () => {
  assert.deepEqual([...STORAGE_KINDS], ["avatar", "image", "attachment"])
  assert.deepEqual(STORAGE_POLICY.avatar, { maxBytes: 2 * MB, contentTypes: ["image/png", "image/jpeg", "image/webp"], public: true, signInRequired: true })
  assert.deepEqual(STORAGE_POLICY.image, { maxBytes: 5 * MB, contentTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"], public: true, signInRequired: false })
  assert.equal(STORAGE_POLICY.attachment.maxBytes, 10 * MB)
  assert.equal(STORAGE_POLICY.attachment.public, false)
  assert.equal(STORAGE_POLICY.attachment.retentionDays, 365)
  for (const t of ["application/pdf", "image/jpeg", "image/png"]) assert.ok(STORAGE_POLICY.attachment.contentTypes.includes(t), t)
  assert.equal(MAX_PRESIGN_SECONDS, 900)
  assert.equal(PENDING_TTL_MS, 24 * 3600_000)
})

test("거절 표: 크기·형식·종류·avatar 비로그인", () => {
  const ok = { kind: "image", contentType: "image/png", size: 1000 }
  assert.deepEqual(checkUpload(ok, false), { ok: true, kind: "image", contentType: "image/png", size: 1000 })
  const cases = [
    [{ ...ok, size: 5 * MB }, false, { ok: true }, "정확히 상한은 받는다"],
    [{ ...ok, size: 5 * MB + 1 }, false, { ok: false, issue: "size" }, "상한 +1"],
    [{ ...ok, size: 0 }, false, { ok: false, issue: "size" }, "빈 파일"],
    [{ ...ok, size: -1 }, false, { ok: false, issue: "size" }, "음수"],
    [{ ...ok, size: 1.5 }, false, { ok: false, issue: "size" }, "정수가 아님"],
    [{ ...ok, size: "1000" }, false, { ok: false, issue: "size" }, "문자열"],
    [{ ...ok, size: Number.NaN }, false, { ok: false, issue: "size" }, "NaN"],
    [{ ...ok, contentType: "image/svg+xml" }, false, { ok: false, issue: "contentType" }, "svg 는 스크립트를 실을 수 있어 받지 않는다"],
    [{ ...ok, contentType: "text/html" }, false, { ok: false, issue: "contentType" }, "html"],
    [{ ...ok, contentType: "IMAGE/PNG" }, false, { ok: true }, "대소문자 무시"],
    [{ ...ok, contentType: "image/png; charset=binary" }, false, { ok: false, issue: "contentType" }, "매개변수가 붙은 형식은 거절"],
    [{ ...ok, contentType: undefined }, false, { ok: false, issue: "contentType" }, "형식 없음"],
    [{ ...ok, kind: "video" }, false, { ok: false, issue: "kind" }, "모르는 종류"],
    [{ ...ok, kind: "__proto__" }, false, { ok: false, issue: "kind" }, "프로토타입 이름"],
    [{ ...ok, kind: undefined }, false, { ok: false, issue: "kind" }, "종류 없음"],
    [{ kind: "avatar", contentType: "image/png", size: 100 }, false, { ok: false, issue: "signIn" }, "avatar 는 로그인 필수"],
    [{ kind: "avatar", contentType: "image/png", size: 100 }, true, { ok: true }, "avatar 로그인"],
    [{ kind: "avatar", contentType: "image/avif", size: 100 }, true, { ok: false, issue: "contentType" }, "avatar 는 avif 불가"],
    [{ kind: "avatar", contentType: "image/png", size: 2 * MB + 1 }, true, { ok: false, issue: "size" }, "avatar 2MB 초과"],
    [{ kind: "attachment", contentType: "application/pdf", size: 10 * MB }, false, { ok: true }, "첨부는 비로그인도 받는다"],
    [{ kind: "attachment", contentType: "application/x-msdownload", size: 10 }, false, { ok: false, issue: "contentType" }, "실행 파일"],
  ]
  for (const [input, signedIn, want, why] of cases) {
    const got = checkUpload(input, signedIn)
    assert.equal(got.ok, want.ok, why)
    if (!want.ok) assert.equal(got.issue, want.issue, why)
  }
})

test("키는 ${종류}/${yyyy}/${uuid}.${확장자} — 사용자 파일명은 키에 들어가지 않는다", () => {
  const id = "0b9f3c2a-6c1d-4d57-9a53-0f3e7f6a1b2c"
  assert.equal(buildKey({ kind: "attachment", id, contentType: "application/pdf", now: new Date("2026-10-22T00:00:00Z") }), `attachment/2026/${id}.pdf`)
  assert.equal(buildKey({ kind: "image", id, contentType: "image/jpeg", now: new Date("2026-12-31T23:59:59Z") }), `image/2026/${id}.jpg`)
  assert.throws(() => buildKey({ kind: "image", id: "../../etc/passwd", contentType: "image/png", now: new Date() }), /id/)
  assert.throws(() => buildKey({ kind: "image", id, contentType: "image/gif", now: new Date() }), /contentType/)
})

test("isStorageKey: 우리가 만든 모양만 — 경로 이동·절대 경로·다른 종류 이름은 거절", () => {
  const id = "0b9f3c2a-6c1d-4d57-9a53-0f3e7f6a1b2c"
  assert.equal(isStorageKey(`avatar/2026/${id}.png`), true)
  for (const bad of [`../avatar/2026/${id}.png`, `/avatar/2026/${id}.png`, `avatar/2026/../${id}.png`, `video/2026/${id}.png`, `avatar/26/${id}.png`, `avatar/2026/${id}.exe`, `avatar/2026/x.png`, `avatar/2026/${id}.png/`, `avatar/2026/${id}.png\u0000`, ""]) assert.equal(isStorageKey(bad), false, JSON.stringify(bad))
})

test("확장자·형식 보조: 파일 이름의 확장자로 형식을 짐작한다(브라우저가 hwp 형식을 비워 보낼 때)", () => {
  assert.equal(contentTypeFromName("계약서.HWP"), "application/x-hwp")
  assert.equal(contentTypeFromName("a.hwpx"), "application/vnd.hancom.hwpx")
  assert.equal(contentTypeFromName("a.JPEG"), "image/jpeg")
  assert.equal(contentTypeFromName("noext"), undefined)
  assert.equal(contentTypeFromName("a.exe"), undefined)
  assert.equal(extensionOf("image/webp"), "webp")
  assert.equal(extensionOf("image/gif"), undefined)
})

test("정책 표의 모든 형식은 확장자가 있다(키를 만들 수 있다)", async () => {
  const { extensionOf, formatList } = await import("../src/key.ts")
  for (const kind of STORAGE_KINDS) for (const t of STORAGE_POLICY[kind].contentTypes) assert.ok(extensionOf(t), `${kind} ${t}`)
  assert.equal(formatList(STORAGE_POLICY.avatar.contentTypes), "PNG, JPG, WEBP")
})

test("cleanFileName: 경로·제어 문자·방향 바꿈 문자를 버리고 100자로 자른다", async () => {
  const { cleanFileName } = await import("../src/key.ts")
  assert.equal(cleanFileName("<home>\\계약서 최종.pdf"), "계약서 최종.pdf")
  assert.equal(cleanFileName("../../etc/passwd"), "passwd")
  assert.equal(cleanFileName("a\u0000b\u202ecod.exe"), "abcod.exe")
  assert.equal(cleanFileName("  a   b  "), "a b")
  assert.equal(cleanFileName("가".repeat(150)), "가".repeat(100))
  assert.equal(cleanFileName("   "), undefined)
  assert.equal(cleanFileName(42), undefined)
})
