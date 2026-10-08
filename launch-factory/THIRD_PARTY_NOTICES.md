# Third-party notices

launch-factory is MIT-licensed (see `LICENSE`). This file lists third-party material it borrows from or depends on.
The first part was checked on 2026-10-08 against `package-lock.json` license fields (923 packages; the 28 entries without a license field are this repository's own workspace packages) and `gh api repos/<owner>/<repo> --jq .license.spdx_id`. Nothing here is legal advice.

## Dependencies with a license other than MIT, ISC, BSD or Apache-2.0

| Package | Version | License (as declared) | Role |
|---|---|---|---|
| `sentry` (pulled in by `@sentry/bundler-plugins`) | 0.45.0 | FSL-1.1-Apache-2.0 | Build-time tool for source-map upload. Read the Functional Source License before you use it commercially. |
| `gsap` | 3.15.0 | "Standard 'no charge' license" (https://gsap.com/standard-license) | Production dependency of `template`. Not MIT. Read the GSAP license before you ship. |
| `@img/sharp-libvips-*` (10 platform packages), `@img/sharp-wasm32`, `@img/sharp-win32-*` | 1.3.4 / 0.35.5 | LGPL-3.0-or-later (some combined with Apache-2.0 and MIT) | Optional platform binaries of `sharp`, pulled in as an optional dependency of `next`. Not part of this repository's source. |
| `@fontsource/ibm-plex-mono`, `@fontsource/ibm-plex-sans-kr`, `@fontsource/nanum-gothic-coding`, `@fontsource-variable/martian-mono` | 5.3.0 | OFL-1.1 | Typeface npm packages. No font file is stored in this repository. |
| `dompurify` | 3.4.16 | MPL-2.0 OR Apache-2.0 | HTML sanitizing. |
| `@axe-core/playwright`, `axe-core`, `lightningcss` and its platform packages | 4.13.0 / 1.32.0 | MPL-2.0 | Dev-only test and build tools. |
| `caniuse-lite` | 1.0.30001813 | CC-BY-4.0 | Browser-support data used by build tooling. |

## Code borrowed from other repositories

The table below is the project's own record. The licenses in the "License" column were re-checked on 2026-10-08 with `gh api` (`PaddleHQ/paddle-nextjs-starter-kit` Apache-2.0, `AmanVarshney01/create-better-t-stack` MIT, `ixartz/SaaS-Boilerplate` MIT, `vercel/next-forge` MIT). Sentences that point to files outside this repository describe the maintainers' working notes.

launch-factory는 라이브러리를 조립하고, 아래 오픈소스 조각만 출처를 적어 빌린다(계획 개정 2026-09-30 「바탕 A+」).
조각을 실제로 옮기는 작업에서 상태를 `planned` → `borrowed`로 바꾸고, 옮긴 파일 경로·원본 커밋·원본 저작권 문구를 적는다. Apache-2.0 원본에 NOTICE 파일이 있으면 그 내용을 여기에 옮긴다.

라이선스는 2026-09-30에 `gh api repos/<저장소> --jq .license.spdx_id`와 `npm view <패키지> license`로 확인했다.

| # | 조각 | 원본 | 라이선스 | 쓸 작업 | 상태 |
|---|---|---|---|---|---|
| 1 | Paddle 웹훅 서명 검증: SDK `paddle.webhooks.unmarshal(rawBody, secret, signature)`, `paddle-signature` 헤더, 원문 본문(`request.text()`) 처리 | [PaddleHQ/paddle-nextjs-starter-kit](https://github.com/PaddleHQ/paddle-nextjs-starter-kit) `src/app/api/webhook/route.ts` | Apache-2.0 (저장소 루트에 NOTICE 파일 없음 — 2026-09-30 `contents/NOTICE` 404) | Task 5 | **borrowed(방식, 코드 옮김 없음)** — 2026-09-30 Task 5, 원본 커밋 `a8c5168e5411af7a4a4c8521d0a8a342ce0307ac`. 옮긴 것: 헤더 `paddle-signature`를 읽고, 본문을 `request.text()` 원문 그대로 받아, SDK `paddle.webhooks.unmarshal(원문, 비밀, 서명)`으로 검증과 이벤트 변환을 한 번에 하는 순서(`packages/billing-paddle/src/webhook.ts`). 다르게 한 것: 서명 없음·틀림은 **401**(원본은 헤더 없음 400·검증 실패 500), 처리는 한 트랜잭션(중복 제거→재조회→순서 보호)·실패 시 500으로 재전송을 받는다 — 원본에 없는 우리 것. 원본 저작권 문구를 복제할 파일이 없다(같은 모양의 SDK 호출만 썼다) |
| 2 | Better Auth + Drizzle(Postgres) 인증 스키마 구조, `packages/auth`·`packages/db` 나누는 법(구조만, 판은 우리 고정값) | [AmanVarshney01/create-better-t-stack](https://github.com/AmanVarshney01/create-better-t-stack) `templates/auth/better-auth/server/db/drizzle/postgres` | MIT | Task 4 (Task 3·4의 인증 표는 모두 Better Auth 자체 생성기 `auth@1.7.6 generate`로 만들었고, 패키지 나누기는 계획 File Structure를 따랐다) | **not used** — 옮긴 코드 없음(Task 4, 2026-09-30) |
| 3 | 로컬·테스트 DB를 docker 대신 PGlite(WASM Postgres)로 돌리고, 같은 drizzle-kit 마이그레이션을 그 DB에 적용하는 **방식** | [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) 커밋 `e3952a7ed5b0ef172ac4363c4644b8c334d1094b` — `package.json` 스크립트 `db-server:memory`(`pglite-server -m 100 --run 'npm run db:migrate'`)·`drizzle.config.ts`(`out: ./migrations`) | MIT | Task 3(borrowed)·Task 10 | **borrowed(방식만, 코드 옮김 없음)** — 2026-09-30 Task 3. 원본은 `@electric-sql/pglite-socket` 서버 + `pg` 드라이버로 붙는다. 우리는 서버 없이 프로세스 안에서 `drizzle-orm/pglite` 드라이버로 연다(`packages/db/src/client.ts` `db.local()`). 옮긴 파일이 없으므로 저작권 문구 복제 대상도 없다. Task 10 dev 서버가 소켓 방식을 쓰면 그때 이 행을 고친다 |
| 4 | 보안 헤더(CSP nonce 등) — next-forge `packages/security`가 쓰는 nosecone. **코드를 옮기지 않고 핵심 패키지 `nosecone@1.13.0`을 의존성으로 쓴다**(`packages/security/src/headers.ts`). `@nosecone/next`는 쓰지 않는다(Next 기본값의 `style-src 'unsafe-inline'`·안에서 만드는 nonce·`next` peer) | [vercel/next-forge](https://github.com/vercel/next-forge) `packages/security` → 패키지 원본 [arcjet/arcjet-js](https://github.com/arcjet/arcjet-js) | next-forge는 MIT. **`nosecone`·`@nosecone/next`는 Apache-2.0**(npm `license`, `gh api repos/arcjet/arcjet-js --jq .license.spdx_id`). arcjet-js 루트에 NOTICE 파일 없음(2026-09-30 `contents/NOTICE` 404), 패키지 tarball에도 LICENSE·README뿐. 계획 본문의 「MIT」는 next-forge 쪽 표기다 | Task 2 | dependency (nosecone 1.13.0) |

## 옮긴 코드가 아닌 참고(Task 8, 2026-09-30)

`packages/analytics-posthog`는 제3자 코드를 옮기지 않았다. 아래는 코드가 아니라 사실·목록을 참고한 것이라 라이선스 대상이 아니지만, 출처를 남긴다.

| 무엇 | 어디에 | 출처 |
|---|---|---|
| AI 답변 엔진 리퍼러 도메인 목록(골라 쓴 것) | `packages/analytics-posthog/src/referrer.ts` `AI_DOMAINS` | Swydo 「AI Referral Traffic Tracking in GA4」(2026-03-24 갱신, 정규식은 Dana DiTomaso·Analytics Playbook) https://www.swydo.com/blog/track-ai-traffic-in-ga4/ · ChatGPT `utm_source=chatgpt.com`: OpenAI Publishers and Developers FAQ https://help.openai.com/en/articles/12627856-publishers-and-developers-faq |
| PostHog 호스트·지역·CSP 값 | `packages/analytics-posthog/src/region.ts` | PostHog 문서(https://posthog.com/docs/libraries/js/config · /docs/advanced/content-security-policy · /handbook/company/security) |
| 개인정보 칸 이름 정규식(`PII_KEY`) | `packages/analytics-posthog/src/props.ts` | web-factory `registry/factory/contract/conformance/analytics.ts`(p3-3 b2fb648) — 같은 소유자의 1차 저장소라 제3자가 아니다 |

## 의존성으로만 쓰는 것

npm 패키지로 설치해 쓰는 라이브러리(Next.js·Better Auth·Drizzle·Paddle SDK·Resend·PostHog·Sentry·zod·PGlite 등)는 코드를 옮기지 않으므로 이 표에 넣지 않는다. 판과 라이선스는 `docs/versions.md`에 있다.
