// 탈퇴 파기 때 PostHog 의 사람·이벤트·녹화를 지운다(v0 Task 14 — @launch-factory/account-lifecycle 의 AnalyticsEraser 모양).
// 출처(2026-09-30 확인): PostHog OpenAPI https://us.posthog.com/api/schema/ — `POST /api/projects/{project_id}/persons/bulk_delete/`
//   「bulk delete persons, either by the PostHog person IDs or by distinct IDs … a maximum of 1000 IDs per call」, 응답 202(배경에서 지운다),
//   본문 PersonBulkDeleteRequest { distinct_ids, delete_events, delete_recordings, keep_person }, 인증 PersonalAPIKeyAuth scope `person:write`.
//   https://posthog.com/docs/privacy/data-deletion — 개인 API 키(프로젝트 키가 아니다)로 부르고, 이벤트 삭제는 비동기다.
// API 는 앱 호스트(us.posthog.com·eu.posthog.com)로 부른다 — 수집 호스트(*.i.posthog.com)가 아니다.
import { resolvePostHog, type PostHogRegion } from "./region.ts"

export const POSTHOG_BULK_DELETE_MAX = 1000

export interface PostHogEraserOptions {
  /** POSTHOG_PERSONAL_API_KEY — scope person:write */
  personalApiKey: string
  /** POSTHOG_PROJECT_ID(숫자 id) */
  projectId: string
  host?: string
  region?: PostHogRegion
  fetch?: typeof fetch
}

export function postHogEraser(options: PostHogEraserOptions) {
  if (!options.personalApiKey?.trim()) throw new Error("POSTHOG_PERSONAL_API_KEY is empty")
  if (!/^\d+$/.test(options.projectId ?? "")) throw new Error("POSTHOG_PROJECT_ID must be the numeric project id")
  const { uiHost } = resolvePostHog({ host: options.host, region: options.region })
  const url = `${uiHost}/api/projects/${options.projectId}/persons/bulk_delete/`
  const doFetch = options.fetch ?? fetch
  return {
    url,
    async erase(distinctIds: readonly string[]): Promise<void> {
      const ids = [...new Set(distinctIds.filter((x) => typeof x === "string" && x.trim()))]
      if (!ids.length) return
      if (ids.some((x) => x.includes("@"))) throw new Error("distinct ids are internal user ids, not email addresses")
      for (let i = 0; i < ids.length; i += POSTHOG_BULK_DELETE_MAX) {
        const res = await doFetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${options.personalApiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ distinct_ids: ids.slice(i, i + POSTHOG_BULK_DELETE_MAX), delete_events: true, delete_recordings: true }),
        })
        // 키·본문은 오류에 넣지 않는다
        if (res.status !== 202 && res.status !== 200) throw Object.assign(new Error(`posthog bulk_delete failed: HTTP ${res.status}`), { code: `http_${res.status}` })
      }
    },
  }
}
