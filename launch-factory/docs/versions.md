# 고정 버전

모든 행은 정확한 판(`^`·`~` 없음)이다. 확인일은 2026-09-30이다. 확인한 방법은 `npm view <패키지> dist-tags.latest`·`npm view <패키지> time --json`·`npm view <패키지> license`이고, 출처 링크는 npm 레지스트리다.
각 패키지는 그것을 쓰는 작업에서 이 판으로 설치한다(Task 1은 개발 도구만, Task 10은 `template/` 의 앱 의존을 설치했다).

## 런타임·프레임워크

| 패키지 | 고정 판 | 판 공개일 | 라이선스 | 고정 이유 | 출처 | 확인일 |
|---|---|---|---|---|---|---|
| `next` | **16.3.8** | 2026-09-30 | MIT | 보안 바닥 판. 2026-10-08 CI OSV-Scanner 가 16.3.6 의 공지 6건을 잡았다(GHSA-39w2-rjm5-chcv · 3w37-wq28-93x7 · 4jqv-mc3x-m676 · cjq9-62q9-8jv4(high, CVSS 8.3, 2026-09-30 공개) · f87g-xv8r-7p7x · mcj8-r9mp-w47p — 모두 16.3.8 에서 고침). 그 전 바닥 16.3.6 은 GHSA-vcvr-r3jv-pc5j(critical). `template/test/deps-floor.test.mjs` 가 바닥을 지킨다 | https://www.npmjs.com/package/next/v/16.3.8 (`npm view next time` → 16.3.8 2026-09-30T16:07Z) · https://github.com/vercel/next.js/security-advisories/GHSA-cjq9-62q9-8jv4 (`gh api` → severity high, published 2026-09-30) · CI 실행 37698164414 의 OSV 표 | 2026-10-08 |
| `drizzle-orm` | **0.45.3** | 2026-09-21 | Apache-2.0 | 계획 고정값 = 현재 latest. 1.0은 아직 rc라 쓰지 않는다. **설치함 — `packages/db` dependencies(Task 3)** | https://www.npmjs.com/package/drizzle-orm/v/0.45.3 | 2026-09-30 |
| `drizzle-kit` | **0.31.11** | 2026-09-21 | MIT | 계획 고정값 = 현재 latest(drizzle-orm 0.45.3과 같은 날 공개). **설치함 — `packages/db` devDependencies(Task 3).** `npm audit`에 moderate 4건이 뜬다: drizzle-kit → `@esbuild-kit/esm-loader` → 옛 esbuild(GHSA-67mh-4wv8-2f99, esbuild 개발 서버 요청 노출). 개발 도구 경로이고 우리는 esbuild 개발 서버를 띄우지 않는다. `audit fix --force`는 drizzle-kit을 0.18.1로 내려서 쓰지 않는다 | https://www.npmjs.com/package/drizzle-kit/v/0.31.11 | 2026-09-30 |
| `better-auth` | **1.7.6** | 2026-09-24 | MIT | 현재 latest. **설치함 — `packages/auth` dependencies(Task 4).** 요청 제한은 `auth.handler`(라우터 onRequest)에서만 걸린다 — `auth.api.*` 직접 호출은 건너뛴다(dist/api/index.mjs 확인) | https://www.npmjs.com/package/better-auth/v/1.7.6 | 2026-09-30 |
| `@paddle/paddle-node-sdk` | **3.10.0** | 2026-08-07 | Apache-2.0 | 현재 latest(Task 5 착수 때 다시 확인 — 3.10.0 그대로). **설치함**(`@launch-factory/billing-paddle` dependencies, Task 5). 런타임 의존성 0개. 전역 `fetch`를 쓴다(테스트는 가짜 Paddle HTTP를 끼운다). 서명 검증 `webhooks.unmarshal`은 HMAC-SHA256(`ts:원문`)이고 ts가 **5초**보다 오래되면 거절한다(`WebhooksValidator.MAX_VALID_TIME_DIFFERENCE = 5`). 헤더에 `h1`이 여럿 와도(비밀 교체 중) **마지막 하나만** 비교한다 — 문서는 모두 비교하라고 해서, 처리기가 `h1`마다 헤더를 나눠 검증한다(`packages/billing-paddle/src/webhook.ts` `verified`) | https://www.npmjs.com/package/@paddle/paddle-node-sdk/v/3.10.0 · 원본 https://github.com/PaddleHQ/paddle-node-sdk | 2026-09-30 |
| `resend` | **6.30.0** | 2026-09-25 | MIT | 현재 latest(Task 7 착수 때 `npm view resend dist-tags.latest` → 6.30.0 그대로). **설치함**(`@launch-factory/email` dependencies). `render`는 우리가 하고 `html`·`text`로 넘긴다 — SDK의 `react` 옵션(선택 peer `@react-email/render`)은 쓰지 않는다. SDK는 전역 `fetch`를 쓰고, 개발 모드(`NODE_ENV≠production`)에서 API 오류를 `console.error`로 스스로 찍는다 | https://www.npmjs.com/package/resend/v/6.30.0 | 2026-09-30 |
| `react-email` | **6.11.0** | 2026-09-23 | MIT | 현재 latest. **설치함**(`@launch-factory/email` dependencies, Task 7). React Email 6부터 컴포넌트와 `render`를 이 패키지 하나에서 내보낸다. `@react-email/components`·`@react-email/html` 등 개별 패키지는 npm에서 **deprecated**(「Package no longer supported」)라 쓰지 않는다. 대가: CLI 의존성(esbuild·tailwindcss·socket.io 등)까지 따라와 잠금 파일에 141개 항목이 더해졌다. 첫 import 약 3초(개발 기계 실측) | https://www.npmjs.com/package/react-email/v/6.11.0 · Context7 `/resend/react-email` 「Update from React Email 5.0 to 6.0」(https://github.com/resend/react-email/blob/canary/apps/docs/getting-started/updating-react-email.mdx) | 2026-09-30 |
| `react-dom` | **19.3.0** | 2026-09-09 | MIT | react 19.3.0과 같은 판. `react-email`의 `render`가 `react-dom/server`를 쓴다. `@launch-factory/email`에 peer `^19.0.0` + devDependency 19.3.0(Task 7, react와 같은 방식) | https://www.npmjs.com/package/react-dom/v/19.3.0 | 2026-09-30 |
| `posthog-js` | **1.434.18** | 2026-09-29 | Apache-2.0 AND MIT | 현재 latest. 공개 주기가 매우 잦다(하루 여러 판). Task 8 착수 때(2026-09-30) `npm view posthog-js dist-tags.latest` → 1.434.18 그대로. **설치함**(`@launch-factory/analytics-posthog` dependencies). 브라우저에서만 동의 뒤 동적 import 로 부른다 | https://www.npmjs.com/package/posthog-js/v/1.434.18 | 2026-09-30 |
| `posthog-node` | **5.54.1** | 2026-09-25 | MIT | 현재 latest(Task 8 착수 때 다시 확인). **설치함**(`@launch-factory/analytics-posthog` dependencies). 서버 이벤트는 `captureImmediate` | https://www.npmjs.com/package/posthog-node/v/5.54.1 | 2026-09-30 |
| `react` | **19.3.0** | 2026-09-09 | MIT | 현재 latest. `@launch-factory/analytics-posthog` 의 `useExperiment` 훅(`useSyncExternalStore`) 때문에 **peerDependency `^19.0.0`** + 타입 검사용 devDependency 로 넣었다(Task 8). `@launch-factory/email`도 같은 방식(peer `^19.0.0` + dev 19.3.0, Task 7). next 16.3.6 의 peer 는 `^18.2.0 || ^19.0.0`. 템플릿(Task 10)이 앱 판을 정하면 여기를 맞춘다 | https://www.npmjs.com/package/react/v/19.3.0 | 2026-09-30 |
| `@types/react` | **19.3.0** | 2026-09-09 | MIT | react 19.3.0 타입. devDependency(Task 8) | https://www.npmjs.com/package/@types/react/v/19.3.0 | 2026-09-30 |
| `@sentry/nextjs` | **11.4.0** | 2026-10-02 | MIT | 현재 latest(2026-10-05 `npm view @sentry/nextjs version` → 11.4.0, 피어 `next ^14 \|\| ^15 \|\| ^16`). **설치함**(`template` dependencies, LFOBS — 11.1.0 에서 올렸다. 설계는 docs/qa/lfobs.md) | https://www.npmjs.com/package/@sentry/nextjs/v/11.4.0 | 2026-10-05 |
| `zod` | **4.6.5** | 2026-09-13 | MIT | 현재 latest(계획의 「zod 4」). **설치함**(`@launch-factory/env` dependencies, Task 2) | https://www.npmjs.com/package/zod/v/4.6.5 | 2026-09-30 |
| `@electric-sql/pglite` | **0.5.8** | 2026-08-26 | Apache-2.0 | 현재 latest. 로컬·테스트 DB(계획 개정). **Task 3 첫 단계 확인(2026-09-30): 맞다.** drizzle-kit 0.31.11 `generate`로 만든 SQL을 `drizzle-orm/pglite/migrator` `migrate()`가 빈 메모리 DB에 적용했고(종료 0), 고유 인덱스 중복 삽입이 SQLSTATE 23505로 막혔다. docker compose로 돌아가지 않는다. **설치함 — `packages/db` dependencies(Task 3)**, `db.local()`에서만 동적으로 불러온다 | https://www.npmjs.com/package/@electric-sql/pglite/v/0.5.8 | 2026-09-30 |
| `postgres` (postgres-js) | **3.4.9** | 2026-04-05 | Unlicense | 현재 latest. 운영 연결 드라이버. Supabase 트랜잭션 풀러(6543)는 prepared statement를 못 쓰므로 `prepare: false` 옵션을 주는 드라이버가 필요하다(설계 D4). drizzle-kit `migrate`도 이 드라이버로 돈다. **설치함 — `packages/db` dependencies(Task 3)** | https://www.npmjs.com/package/postgres/v/3.4.9 | 2026-09-30 |
| `auth` (Better Auth CLI) | **1.7.6** | 2026-09-24 | MIT | 설치하지 않는다. Better Auth 스키마 생성기. `better-auth 1.7.6`을 정확히 의존하는 판이라 그 판의 표를 만든다. 쓰는 법: 빈 폴더에 `better-auth@1.7.6`·`auth@1.7.6`을 설치하고 `npx auth generate --adapter drizzle --dialect postgresql --config ./auth.ts --output <파일> --yes`. 결과는 `packages/db/src/schema/auth-base.ts` 머리 주석에 적었다. 명령 확인: Context7 `/better-auth/better-auth`(v1.6.23 문서 — `generate` `--adapter` 옵션) + `npx auth@1.7.6 generate --help` | https://www.npmjs.com/package/auth/v/1.7.6 | 2026-09-30 |
| `nosecone` | **1.13.0** | 2026-09-16 | Apache-2.0 | 현재 latest. **설치함**(`@launch-factory/security` dependencies, 의존성 0개). 헤더 조립·검증만 맡기고 지시어는 우리가 정한다. `@nosecone/next` 1.13.0은 쓰지 않는다 — 소스 확인 결과 Next용 기본값이 `style-src`에 `'unsafe-inline'`을 넣고, nonce를 안에서 만들어 밖에서 받을 수 없고, peer로 `next`를 끌어온다(`docs/qa/task-2-report.md`) | https://www.npmjs.com/package/nosecone/v/1.13.0 · 원본 https://github.com/arcjet/arcjet-js | 2026-09-30 |
| `@better-auth/core` | **1.7.6** | 2026-09-24 | MIT | better-auth 1.7.6이 정확히 의존하는 판(이미 잠금 파일에 있음). **직접 의존으로 더함**(`@launch-factory/security` dependencies, Task 15). 쓰는 것은 `@better-auth/core/utils/ip`의 `getIP` 하나 — 우리 요청 제한(`rate_limits`)이 Better Auth(`rate_limit`)와 같은 규칙으로 IP를 읽게 하려고(`x-forwarded-for` 한 개만 믿음, 여러 개면 `trustedProxies` 필요). better-auth를 올릴 때 같은 판으로 함께 올린다 | https://www.npmjs.com/package/@better-auth/core/v/1.7.6 · 설치본 `dist/utils/ip.mjs` | 2026-09-30 |

## 개발 도구(설치함 — 루트 `devDependencies`)

| 패키지 | 고정 판 | 판 공개일 | 라이선스 | 고정 이유 | 출처 | 확인일 |
|---|---|---|---|---|---|---|
| `typescript` | **6.0.3** | 2026-04-16 | Apache-2.0 | latest는 7.0.2지만 `typescript-eslint@8.71.1`의 peer가 `>=4.8.4 <6.1.0`이라 6.0 계열 최신을 쓴다 | https://www.npmjs.com/package/typescript/v/6.0.3 | 2026-09-30 |
| `eslint` | **10.12.0** | 2026-10-02 | MIT | 현재 latest(Dependabot 갱신, 2026-10-15 확인) | https://www.npmjs.com/package/eslint/v/10.12.0 | 2026-10-15 |
| `@eslint/js` | **10.0.1** | 2026-02-06 | MIT | 현재 latest | https://www.npmjs.com/package/@eslint/js/v/10.0.1 | 2026-09-30 |
| `typescript-eslint` | **8.71.1** | 2026-10-05 | MIT | 8.71.x 최신(Dependabot 갱신, 2026-10-15 확인; 8.71.2 가 있으나 갱신 PR 의 판을 따랐다). peer eslint `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, typescript `>=4.8.4 <6.1.0` | https://www.npmjs.com/package/typescript-eslint/v/8.71.1 | 2026-10-15 |
| `globals` | **17.13.0** | 2026-10-01 | MIT | 현재 latest(eslint Node 전역, 2026-10-15 확인) | https://www.npmjs.com/package/globals/v/17.13.0 | 2026-10-15 |
| `@types/node` | **24.19.0** | 2026-09-25 | MIT | 런타임 Node 24.13.0에 맞춘 24.x 최신(latest 26.6.3은 Node 26용). `@launch-factory/env`·`security`·`db`의 devDependencies에 넣었다(루트 `package.json`은 그대로). TypeScript 6은 `types` 기본값이 빈 목록이라 `tsconfig.base.json`에 `"types": ["node"]`를 한 번 둔다(D17, 2026-10-05 — 파일 머리의 참조 줄은 지웠다) | https://www.npmjs.com/package/@types/node/v/24.19.0 | 2026-09-30 |

## 실행 환경

| 항목 | 값 | 확인 |
|---|---|---|
| Node | v24.13.0 | `node --version`. `process.features.typescript === "strip"` — `.ts`를 타입 제거로 바로 돌린다. 테스트는 `node --test`로 `src/index.ts`를 직접 불러온다 |
| npm | 11.6.2 | `npm --version` |

## 외부 API(패키지가 아닌 것 — 버전 번호가 문서에만 있다)

| API | 고정 | 확인일 | 설명 | 출처 |
|---|---|---|---|---|
| Gumroad API | 기준 `https://api.gumroad.com/v2`(경로의 `v2`가 판이다. 별도 판 머리·SDK 없음). 문서 원천 `antiwork/gumroad@74d7314` | 2026-09-30 | **설치한 것 없음**(`@launch-factory/billing-gumroad`가 전역 `fetch`로 `GET /sales/:id`·`GET /subscribers/:id`만 부른다). 공식 문서에 **구독을 바꾸는 쓰기 API가 없다**(엔드포인트 목록 전체 확인: 구독은 `GET /products/:product_id/subscribers`·`GET /subscribers/:id` 읽기뿐 — 해지·일시정지·등급 변경·결제수단 변경 없음). 그래서 어댑터의 해당 메서드는 `{ ok: false, code: "provider_unsupported" }`로 끝난다(대장 D160·D165). 판매 알림은 **서명이 없고** 적어도 한 번 전달·순서 보장 없음이라 공유 비밀(`?key=`) + API 재조회로 처리한다. 가격 인상은 기존 손님에게 **7일 전** 안내 메일만 보낸다 — 한국 30일 동의 규칙보다 짧다(대장 D164) | https://gumroad.com/api · https://gumroad.com/ping · https://gumroad.com/help/article/82-membership-products · https://gumroad.com/help/article/278-guide-to-memberships · 원천 https://github.com/antiwork/gumroad |

## web-factory 계약

| 항목 | 값 |
|---|---|
| 원본 | `nowwcastle-sudo/sitebrew` |
| 고정 | 태그 `v0.1.0`(커밋 `d6da4ce88a0d` — 태그가 만들어지면 최종 커밋으로 바뀐다; v0.0.11 `94c6d9e926c1` 을 모두 포함. 2026-10-08 레인 LFPIN12 에서 올림 — 계약 4파일·적합성 묶음은 **바뀌지 않았고**(검사 173 그대로) 블록 9개·공유 조각 2개(폼 `method="post"`·`port-form` 경주 고침·`verify-email` `initialWait`·`notification-consents` `channels`·업그레이드 대화상자 단추 글 한 덩어리)만 바뀌었다 → 잠금 파일 213개 그대로(새 파일 없음); 같은 날 `contract:sync --from <sitebrew checkout> --ref d6da4ce` 와 `template-sync blocks` 로 놓았다. 자세히 `docs/qa/lfpin-v012.md`. 앞 고정: 태그 `v0.0.11`(커밋 `94c6d9e926c1`; v0.0.10 `8f199e48cfaf` 를 모두 포함. 2026-10-05 레인 LFPIN11 에서 올림 — 계약 잠금·템플릿·어댑터 적합성 묶음 로더 `scripts/lib/wf-conformance.mjs` 가 모두 이 태그다. v0.0.10 → v0.0.11 에서 **계약 판은 2 그대로**이고 선택 추가만 늘었다: 승인 행동 확인 입력 `HumanConfirmation`(`confirmed?: true`)·`ActionFailureCode` 6개(`confirmation_required` 등)·`human-actions` 표; 적합성 묶음은 옵션 `requireConfirmation` 이 늘어(켜면 `*.confirmation.*` 8개) LF 는 billing-paddle·consent/notify 에서 켠다 → 검사 165 → **170**; 잠금 파일 → 190개; 새 공유 조각 4개(`consent-open-attrs`·`human-approval`·`pinned-bar-space`·`scroll-hint`)·계약 부품 1개(`human-actions`). `contract:sync --from <sitebrew checkout> --ref v0.0.11` 과 `template-sync blocks --from <sitebrew checkout> --ref v0.0.11` 로 놓았다(대장 D10). 자세히 `docs/qa/lfpin-v011.md`) |
| 계약 판 | `CONTRACT_VERSION = 2` (`CONTRACT_VERSION_EXPECTED = 2`) — 판 2 안의 선택 추가만 늘었다 |
| 잠금 | `packages/contract/contract.lock.json`(계약 4파일), `template/template.lock.json`(템플릿의 web-factory 블록·레시피·목 파일과 이 저장소 기능 번들 파일의 sha256) |

## 템플릿(`template/`, v0 Task 10) 고정

`template/package.json` 은 정확한 판이다. 블록이 끌어오는 의존(`@base-ui/react`·`lucide-react`·`gsap`·`recharts` 등)은 `scripts/template-sync.mjs blocks` 가 shadcn 4.21.0 설치 뒤 **설치된 판으로 바꿔 적는다**(확인 2026-09-30 — 판은 `template/package.json` 이 정본이다). 앞 절의 `next 16.3.6`·`react 19.3.0` 은 그대로다. 서체는 레시피 `r1-measure` 가 `@fontsource/*` npm 패키지로 싣는다(`next/font/google` 이 아니라 빌드가 네트워크 없이 돈다)
