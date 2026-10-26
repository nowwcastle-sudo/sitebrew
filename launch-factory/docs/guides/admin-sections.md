# 관리 화면 구획 만들기 (섹션 작성자용)

관리 화면(`/admin`)은 **셸**(쪽 · 사이드바 · 표 · 기록 · 개요)과 **구획**(주문 · 예약 · 문의 · 후기 …)으로 나뉜다. 셸은 한 번 만들어져 있고, 구획은 부품마다 파일 하나로 더한다. 구획은 **선언**이다 — 누가 들어오는지, 무엇을 보여 주는지, 어떤 행동이 있는지만 적는다. 접근 벽 · 확인 입력 벽 · 상태 검사 · 요청 제한 · 접속 기록 · 행동 기록 · 연락처 가리기 · 던진 오류 가리기는 콘솔(`packages/admin-console`)이 한 곳에서 한다.

## 5줄 요약

1. `template/lib/launch/admin-sections/<id>.ts` 에 `defineSection({ id, part, label, audience, columns, list, key, cells, load, view, … })` 를 `export const` 로 둔다. `part` 는 `features/outcomes.yaml` 의 부품 이름이다.
2. `template/lib/launch/admin-console.ts` 의 `ADMIN_SECTIONS` 배열에 한 줄을 더한다(이 파일은 제품 소유라 설치 때 한 번만 쓰인다 — 레지스트리 사본을 고치고 템플릿에 복사한다).
3. 위험한 행동(되돌리기 어려운 것)은 `actions` 에 `danger: true` 로 둔다(구획당 하나). 콘솔이 `confirmed === true` 없이는 `run` 을 부르지 않는다.
4. 구획은 세션 · 입력의 role · userId 를 읽지 않는다. 필요한 것은 `run(actor, rec, fields)` 의 `actor`(콘솔이 만든다)뿐이다. 서비스에 행위자를 넘길 때는 `actor` 를 그대로 넘긴다.
5. `scripts/test/` 에 접근 벽 시험(로그아웃 · 일반 사용자 · 2단계 없음 · 대리 세션 · 정상) · 확인 입력 벽 시험 · 목록 → 상세 → 행동 한 바퀴를 둔다(`admin-console-glue.test.mjs` 를 본뜬다).

## 구획 선언

```ts
import { defineSection, refuse } from "@launch-factory/admin-console"

export const inquiriesSection = defineSection({
  id: "inquiries",
  part: "inquiry",
  label: "Inquiries",
  audience: { owner: () => process.env.INQUIRY_OWNER_EMAIL }, // 소유자 이메일 또는 관리자. 관리자만이면 "admin"
  statuses: ["open", "answered"],
  columns: [
    { id: "subject", label: "Subject", kind: "text", primary: true },
    { id: "email", label: "Email", kind: "contact", secondary: true },
    { id: "status", label: "Status", kind: "status", filter: true },
  ],
  list: async (actor, { search, status, limit }) => ({ items: await svc.list(actor, { search, status, limit }), total: await svc.count(actor, { search, status }) }),
  key: (row) => row.id,
  cells: (row) => ({ subject: row.subject, email: row.email, status: row.status }),
  load: async (actor, id) => (await svc.get(actor, id)) ?? null, // null → not_found
  view: (rec) => ({ title: rec.subject, summary: [{ label: "Email", value: rec.email, kind: "contact" }] }),
  actions: {
    "mark-answered": { label: "Mark answered", when: (rec) => rec.status === "open", run: (actor, rec) => svc.markAnswered(actor, rec.id) },
    delete: { label: "Delete", danger: true, adminOnly: true, run: (actor, rec) => svc.remove(actor, rec.id) },
  },
  overview: async (actor) => ({ todo: [{ id: "open", severity: "warning", title: "Open inquiries", count: await svc.count(actor, { status: "open" }), status: "open" }] }),
})
```

- **열**은 정확히 하나가 `primary` 다. `kind: "contact"` 열과 요약은 콘솔이 가려서(`k***@example.com`) 내보낸다 — 구획이 가리지 않는다.
- **행동 이름**은 도착 상태로 짓는다(`mark-answered`, `cancel`). `save` 는 폼 저장이 쓰는 예약 이름이다. 행동 id 는 소문자로 시작하는 소문자 · 숫자 · 하이픈이다.
- **`when`** 이 거짓이면 콘솔이 `invalid_state` 로 막고 단추도 숨긴다. 두 번 눌러도 한 번만 실행되게 `when` 으로 막는다.
- **`adminOnly`** 행동은 소유자에게 `forbidden` 이고 단추도 안 보인다.
- **쪽 매김.** 목록은 서버가 쪽 단위로 준다 — `list(actor, q)` 의 `q.limit`(한 쪽 줄 수)과 `q.offset`(건너뛸 줄 수 = (쪽 − 1) × limit)을 그대로 DB 질의에 싣고 `total` 은 거른 전체 건수로 돌려준다. 입력의 `page` 는 1~10000 정수이고 틀리면 `invalid_input` 이다. 한 쪽 줄 수는 구획이 `pageSize`(1~100 정수, 기본 100)로 정한다 — 서비스의 한 쪽 상한이 더 작으면(후기 50 · 사용자 100) 그 값을 선언해 `offset` 이 `pageSize` 의 배수가 되게 한다(그 서비스는 `Math.floor(q.offset / size) + 1` 쪽 번호로 읽는다). 정렬은 반드시 고정 순서(최신순 + id)여야 쪽 사이에 줄이 겹치거나 빠지지 않는다. 화면은 표 아래에 서버 쪽 이동 줄(`?page=`, `lib/admin-paging.ts`)을 두고 검색·상태를 바꾸면 1쪽으로 돌아간다.
- **중복 전송 방지 키.** 폼 저장(`form.save`)과 행동(`run`)은 마지막 인자 `ctx.idempotencyKey`(8~100자 영문·숫자·밑줄·하이픈, 없을 수 있다)를 받는다. 두 번 보내면 부작용이 둘이 되는 저장(메일이 나가는 문의 답변)은 이 키를 서비스에 그대로 넘긴다 — 서비스가 `withIdempotency` 로 같은 결과를 24시간 돌려준다. 화면은 저장마다 키를 하나 만들어 성공할 때까지 재사용한다. 키를 안 받는 저장은 무시하면 된다(콘솔은 모양만 검사한다).
- **편집 폼**이 필요하면 `form: { fields(rec), save(actor, rec, values) }` 를 둔다. 콘솔은 `fields` 에 없는 칸을 받으면 `invalid_input` 으로 막는다(허용 칸 목록).
- 거절은 `return refuse("invalid_input", { fieldErrors: { note: ["Too long"] } })` 로 값으로 돌려준다. 던진 오류는 콘솔이 `action_failed` 로 가린다(DB 문구 · 개인정보가 화면에 나가지 않는다).
- 구획이 쓰는 서비스는 **자기 부품의 행위자 규칙**을 가진다. 콘솔이 준 `actor`(`userId` · `role` · `isOwner` · `via`)를 그대로 넘기고, 서비스가 다시 검사한다(두 겹).

## 쪽과 블록

구획은 쪽도 블록도 만들지 않는다. `/admin/[section]` 과 `/admin/[section]/[id]` 는 셸이 이미 그리고, 포트 값 → 블록 모양은 `template/lib/launch/to-blocks.ts` 한 곳이 바꾼다. 새 블록 종류는 만들지 않는다(기존 `data-table/admin-list` · `data-table/record-panel` · `dashboard-panel/*` · `nav/*` 만 쓴다). 화면 글은 `template/content/copy.admin.en.ts` 에 있다.

## 접근 · 기록 · 제한 (콘솔이 하는 일)

| 단계 | 내용 |
|---|---|
| 신원 | `lib/launch/admin-identity.ts` 가 세션 · 사용자 행에서 읽는다(호출당 한 번). 대리 세션 · 정지 · 2단계 없음 · 메일 미확인은 여기서 거른다 |
| 입장 | 구획의 `audience` 와 신원을 견준다. 입력의 role · userId 는 읽지 않는다 |
| 요청 제한 | 쓰기는 서버 액션 `adminAct` 가 입장 전에 한 번만 센다(`guardAction("adminAct")` 30회/분, 사용자별). 읽기는 콘솔이 입장 뒤에 `admin:read` 120회/분으로 센다. 쓰기를 두 번 세지 않는다 |
| 접속 기록 | 읽기마다 `access_logs` 에 한 줄(행위자 · IP · 대상 `admin/<구획>/<종류>` · 본 기록 id) |
| 행동 기록 | 실행한 행동마다 `admin_actions` 에 한 줄(`<구획>.<행동>` · 구획 · 기록 id · 성공 여부 · 자격). **폼 값은 남기지 않는다** |

부품이 꺼지면(`lib/launch/enabled`) 그 구획은 사이드바에서도 직접 요청에서도 사라진다. 새 구획의 `part` 가 `outcomes.yaml` 에 없으면 시험(`admin-shell.test.mjs`)이 실패한다.

## 쪽 소유와 포장

- `/admin/**` 쪽 파일은 `features/outcomes.yaml` 의 `pages` 항목이 가진다. 구획을 더하는 부품이 그 항목의 `owners` 에 이미 들어 있다.
- 구획 모듈 파일은 그 부품의 레지스트리 항목(`registry/feature-<부품>/item.json`)의 `files` 에 더한다. 구획 모듈은 `@/lib/launch/<부품>` 서비스를 부르므로, 부품이 꺼진 사이트에 파일이 깔리지 않게 부품 항목에 넣는다.
- 생성물(`registry.json` · `registry/dist/*` · `template.lock.json` · `outcomes.generated.json`)은 손으로 고치지 않는다 — `npm run registry:build` · `npm run outcomes:gen` · `node scripts/template-sync.mjs features` 로 다시 만든다.

## 만들어 둔 구획과 정한 것

| 구획 | 부품 | 파일 | 요약 |
|---|---|---|---|
| `orders` | commerce | `lib/launch/admin-sections/orders.ts` | 목록(번호 앞 8자 · 상태 · 합계 · 주문 시각 · 받는 분[연락처]), 상태 거르기, 상세(줄 · 합계 · 배송지 · 송장 · 상태), 송장 번호 폼 저장, `mark-preparing` · `mark-shipped` · `mark-delivered`, 위험 행동 `cancel`(환불) |
| `stock` | commerce | `lib/launch/admin-sections/stock.ts` | 재고 제한이 있는 상품의 남은 수 보기 · 폼 저장으로 정하기 |

- **파일은 구획 하나에 모듈 하나, `export default defineSection(...)`** 이다. 등록부는 `import orders from "@/lib/launch/admin-sections/orders"` 로 불러 배열에 이름을 적는다.
- **구획이 쓰는 부품의 서비스를 직접 부른다.** 주문 구획은 `advanceOrder` · `cancelOrder` · `setTrackingNumber` · `listAllOrders` 를, 재고 구획은 `setStock` 을 `withDefaults(await commerceDeps())` 의 주입 면으로 부른다. 예전 `app/actions/commerce-admin.ts` 는 지웠다 — 입구는 콘솔 하나다.
- **재고는 주문 구획의 폼이 아니라 둘째 구획으로 뒀다.** 기록 단위가 다르다(주문은 주문 번호, 재고는 상품). 한 폼에 섞으면 `form.fields` 가 두 종류의 기록을 가려야 한다. 재고를 정하는 일은 되돌릴 수 있어(같은 폼으로 다시 정한다) 위험 행동이 아니다.
- **송장 번호는 폼 저장**(행동 단추는 입력을 못 싣는다)이고 배송 전 상태(`TRACKING_EDITABLE` = 결제 완료 · 준비 중)에서만 칸이 나온다. `mark-shipped` 는 저장해 둔 번호를 그대로 싣는다. 판매 규칙 패키지에 `setTrackingNumber` · `countOrders` 를 덧붙였다(기존 함수는 그대로).
- **목록은 가리고 상세는 보인다.** 받는 분은 목록에서 연락처 열이라 가려서 나가지만, 배송에 쓰는 상세(받는 분 · 전화 · 주소 · 배송 메모)는 전체 값을 `text` 로 보인다 — 읽기마다 접속 기록이 남는다. 상세에서 `contact` 로 두면 콘솔이 가려서 배송을 못 한다.
- 주문 목록은 검색어를 받지 않는다(번호는 길고 받는 분은 가려져 있다). 상태 거르기로 좁힌다. 재고 목록은 이름 · id 로 검색한다.
- **서버 검색 선언(`serverSearch: true`).** 연락처 열(메일·이름·전화)은 가려서 나가고 표 블록은 연락처 열을 검색 대상으로 삼지 않으므로, 서버가 연락처까지 찾아도 블록이 받은 행을 다시 거르면 맞는 행이 사라진다. `list` 가 검색어로 가린 칸까지 실제로 찾는 구획(사용자 · 뉴스레터 · 문의)만 이 선언을 켠다 — 그러면 목록 쪽이 블록에 `serverSearch` 를 넘겨 블록이 검색어로 다시 거르지 않고(거르기·정렬은 그대로), 입력할 때마다 서버가 다시 읽는다. 선언이 없는 구획은 예전처럼 받은 행 안에서 보이는 칸으로만 거른다. 읽기는 `searchesOnServer(id)`(`lib/launch/admin-console.ts`), 시험은 `scripts/test/admin-server-search.test.mjs`.
- **예약 취소의 환불은 누가 취소했는지에 따른다.** 고객이 취소하면 환불 규정(`fullRefundBeforeMinutes` · `laterRefundPercent`)대로이고, 대표(관리 화면의 `cancel`)나 시스템이 취소하면 때와 상관없이 `depositPolicy.ownerCancelRefundPercent`%(기본 100 = 전액, 0~100)를 돌려준다 — 사업자 쪽 취소로 고객이 손해 보지 않게 한다.
- 구획을 싣는 부품이 이 항목(`feature-admin-console`)의 `registryDependencies` 에 들어간다 — 등록부가 구획 모듈을 정적으로 불러 설치 닫힘 시험이 요구한다. 다음 구획을 더하는 레인도 같은 줄에 부품 이름을 더한다.
