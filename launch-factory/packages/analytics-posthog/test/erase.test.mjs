// PostHog 사람·이벤트 삭제(v0 Task 14) — fetch 가짜로 요청 모양만 본다(네트워크 없음).
import { test } from "node:test"
import assert from "node:assert/strict"
import { POSTHOG_BULK_DELETE_MAX, postHogEraser } from "../src/erase.ts"

// 고정 시험값 — 실제 키가 아니다.
const KEY = "phx_test_not_real_key"

function recorder(status = 202) {
  const calls = []
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: JSON.parse(init.body) })
      return new Response(JSON.stringify({ persons_queued_for_deletion: 1, persons_deleted: 0 }), { status })
    },
  }
}

test("bulk_delete 를 앱 호스트(수집 호스트 아님)로, 개인 API 키로, 이벤트·녹화까지 지우게 부른다", async () => {
  const r = recorder()
  const eraser = postHogEraser({ personalApiKey: KEY, projectId: "12345", host: "https://eu.i.posthog.com", fetch: r.fetch })
  assert.equal(eraser.url, "https://eu.posthog.com/api/projects/12345/persons/bulk_delete/")
  await eraser.erase(["usr_1", "usr_1", "usr_2"])
  assert.equal(r.calls.length, 1)
  assert.equal(r.calls[0].method, "POST")
  assert.equal(r.calls[0].headers.authorization, `Bearer ${KEY}`)
  assert.deepEqual(r.calls[0].body, { distinct_ids: ["usr_1", "usr_2"], delete_events: true, delete_recordings: true })
  const us = postHogEraser({ personalApiKey: KEY, projectId: "1", region: "us", fetch: r.fetch })
  assert.equal(us.url, "https://us.posthog.com/api/projects/1/persons/bulk_delete/")
})

test("1000개씩 나눠 부른다 · 빈 목록은 부르지 않는다", async () => {
  const r = recorder()
  const eraser = postHogEraser({ personalApiKey: KEY, projectId: "1", region: "us", fetch: r.fetch })
  await eraser.erase([])
  assert.equal(r.calls.length, 0)
  await eraser.erase(Array.from({ length: POSTHOG_BULK_DELETE_MAX + 1 }, (_, i) => `usr_${i}`))
  assert.deepEqual(r.calls.map((c) => c.body.distinct_ids.length), [1000, 1])
})

test("202 가 아니면 던지고(Cron 이 다시 시도), 오류에 키가 없다 · 이메일 id·빈 설정은 거부", async () => {
  const r = recorder(403)
  const eraser = postHogEraser({ personalApiKey: KEY, projectId: "1", region: "eu", fetch: r.fetch })
  await assert.rejects(eraser.erase(["usr_1"]), (e) => e.message === "posthog bulk_delete failed: HTTP 403" && e.code === "http_403" && !JSON.stringify(e).includes(KEY))
  await assert.rejects(eraser.erase(["someone@example.com"]), /not email addresses/)
  assert.throws(() => postHogEraser({ personalApiKey: "", projectId: "1", region: "eu" }), /POSTHOG_PERSONAL_API_KEY/)
  assert.throws(() => postHogEraser({ personalApiKey: KEY, projectId: "abc", region: "eu" }), /numeric project id/)
  assert.throws(() => postHogEraser({ personalApiKey: KEY, projectId: "1", host: "https://ph.example.com" }), /region/)
})
