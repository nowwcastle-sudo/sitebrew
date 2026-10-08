# 문구 에이전트 지시서 (04-content)

이 문서 하나로 일을 끝낼 수 있게 썼다. 다른 문서를 열지 않아도 된다(스킬 호출만 예외).

## 하는 일

후보 한 개의 사이트 문구를 쓴다. 입력은 `04-content.request.json` 하나, 출력은 같은 폴더의 `04-content.json` 하나다.

- 요청 파일 자리: `out/<run>/<후보>/04-content.request.json` (스크립트 `factory/stamp/content.mjs`의 `contentRequest`가 만든다)
- 출력 자리: `out/<run>/<후보>/04-content.json` — 원형 콘텐츠 객체 하나. 단계 파일 봉투(`inputHash`·`data`)로 감싸지 않는다. 검사를 통과하면 스크립트가 봉투로 다시 쓴다.
- 스크립트는 LLM 을 부르지 않는다. 문구는 이 지시서를 읽은 네가 쓰고, 검사는 스크립트가 한다.
- 브리프에 없는 사실은 지어내지 않는다. 이 규칙이 모든 규칙보다 먼저다.

## 요청 파일 읽는 법

| 칸 | 뜻 |
|---|---|
| `locale` | `ko` 또는 `en`. 사이트 언어 하나다. 다른 언어를 섞지 않는다 |
| `voice` | `register`(ko `해요체` · en `plain`)와 목소리 형용사 3개. 모든 문구에 같은 목소리를 쓴다 |
| `placeholder` | 사실이 없을 때 쓰는 글자. ko `확인 필요` · en `To be confirmed`. 한 글자도 바꾸지 않는다 |
| `facts` | 브리프의 사실(비지 않은 것만). 사실은 여기 있는 값만 쓴다 |
| `missing` | 원형이 필수로 요구하는데 브리프에 없는 사실 이름 |
| `factPaths` | 사실 이름이 콘텐츠 객체 어디에 들어가는지(경로 배열). 예: `phone` → `["business","phone"]` |
| `structures` | 사실 이름 → 그 사실로 채울 구조 칸(예: detail `price` → `product.price`·`product.taxIncluded`·`product.currency`). 사실이 있으면 이 칸들을 만든다 |
| `structureSlots` | 본문 섹션(소식·연혁·리더·보고서·채용 주소·바로가기·공지·작업·사례·변경 기록 …)이 읽는 **구조 칸** 목록. 칸마다 콘텐츠 경로(`path`)·그 칸을 그리는 섹션(`sections`)·채울 브리프 사실 이름(`factsWanted`)·실제로 있는 사실(`factsUsed`)·사실이 없는지(`empty`)·스키마 모양(`shape`)·섹션이 읽는 항목 칸(`reads`). 아래 「구조 칸」 |
| `structureRule` | 구조 칸을 채우는 규칙 한 줄(사실로만, 사실 없으면 비운다) |
| `siteRoutes` | 이 사이트의 쪽 경로. 구조 칸의 링크가 `/guide` 같은 사이트 안 경로면 여기 있어야 한다 |
| `currency` | detail 만. 브리프 가격의 통화(`USD`·`EUR`·`JPY`·`KRW`) 또는 `null`. `product.currency` 를 이 값으로 적고 금액(`product.price`·`shipping.fee`·`freeThreshold`)은 **최소 단위 정수**로 쓴다(USD·EUR 은 센트: $48 → `4800`, KRW·JPY 는 그대로). 통화를 빼면 KRW 로 읽혀 검사(`currency`)가 떨어진다 |
| `seedContent` | 사실을 자리에 옮겨 둔 출발점. 여기서 시작한다 |
| `slots` | 쓸 문구 칸 목록. 아래 「문구 칸」 |
| `sections` | 블록이 그리는 섹션 키(`<쪽>/<섹션>`). 문구 변형 태그를 붙일 수 있는 키 |
| `skipped` | 블록이 없어 화면이 「확인 필요」를 그리는 섹션. 문구를 쓰지 않는다 |
| `checks` | 검사가 보는 규칙 id와 한 줄 설명. 검사 결과 앞의 `[id]`와 같다 |

## 순서

1. `04-content.request.json`을 읽는다.
2. `seedContent`를 복사해 `04-content.json` 초안을 만든다. 원형 스키마 `registry/factory/content/schemas/<요청의 archetype>.ts`를 열어 필수 칸(예: local 은 `hours`·`booking`·`mapLinks`·`directions`)을 채운다. 브리프 사실로 채울 수 없는 칸은 지어내지 않는다 — 아래 「빈 사실」을 따른다.
2b. `structureSlots[]` 가 있으면 칸마다 채운다(아래 「구조 칸」) — 본문 섹션이 이 칸에서 값을 읽는다. 사실이 있는 칸을 비워 두면 그 섹션이 비어 06 이 「자료 연결 안 됨」을 남기고, 사실이 없는 칸을 채우면 검사가 떨어진다.
3. 최상위에 `"locale": "<요청의 locale>"`을 적는다. `archetype`은 요청 값 그대로다. **최상위 칸은 원형 스키마의 칸과 봉투 칸(`locale`·`facts`·`copyVariants`·`media`·`site`)뿐이다.** 그 밖의 이름(스키마에 없는 원형에 `product` 를 두는 것 등)은 스키마가 조용히 떼어 내던 것이라 검사(`schema`)가 떨어진다. 스키마에 있는 칸은 그 자리에, 사실 원문·자리 표시는 `facts`에 적는다.
4. `slots.copy`에 요청 `slots`와 **같은 순서·같은 개수**로 한 줄씩 쓴다: `{ "id": <slot.id>, "role": <slot.role>, "text": <문구> }`. 같은 id 가 여러 섹션에 있으면(예: `headline`) 요청 순서대로 쓴다. 요청에 없는 id 를 더하지 않는다.
5. 문구를 다 쓴 뒤 윤문한다(아래 「윤문」).
6. 검사한다: `node factory/stamp/content.mjs --check <요청 파일> <04-content.json>` — 종료 0 이 통과다. 1 이면 출력된 줄(`[규칙] 설명 — 위치`)을 고치고 다시 돈다. 2 는 경로·파일 오류다.
7. 통과하면 끝이다. 통과 출력 한 줄(`통과 — 문제 0건`)을 결과에 붙인다.

## 문구 칸

`slots[]` 한 칸의 모양: `path`(쪽/섹션/칸 id) · `id` · `role`(무엇을 쓰는 칸인가) · `maxChars`(넘기면 안 되는 글자 수, `null`이면 제한 없음) · `block`(이 문구를 받는 블록 이름) · `factsUsed`(이 칸을 채우는 브리프 사실 이름) · `factsWanted`·`placeholder`(사실 칸일 때만).

- 글자 수는 `[...text].length`(유니코드 글자 수)로 센다. `maxChars`를 넘지 않는다. 너무 길면 뜻을 줄이지 말고 문장을 고른다.
- `placeholder`가 `true`인 칸: 이 칸을 채울 사실(`factsWanted`)이 브리프에 하나도 없다. 문구를 짓지 말고 `text`를 정확히 요청의 `placeholder`로 적는다.
- `placeholder`가 `false`이고 `factsUsed`가 있는 칸: `facts`에 있는 값만으로 문구를 쓴다. 자리 표시 글자를 남기지 않는다.
- `factsWanted`가 없는 칸: 사실 칸이 아니라 문구 칸(제목·설명·행동 문구)이다. 자유롭게 쓰되 사실이 아닌 숫자·이름을 넣지 않는다.

### 화면 안내 문구 칸 (`ui:` — P3-3 Task 9b)

제품 화면(로그인·가입·계정·결제·해지·완료·동의)과 문의 폼, 예시 표지만 남은 히어로 캡션은 블록 예시(fixture)에 안내 문장이 들어 있다. 그 문장 중 「예시」 표지·가상 이름·지어낸 숫자가 남은 것은 문구 칸으로 요청된다. 모양은 `id: "ui:<잎 경로>"`(예: `ui:copy.errors.emailFormat`), `slot.ui = { path, example, why, numbers? }`, `role` 에 예시 문장이 들어 있다. `numbers`(`why` 가 `digits` 일 때만)는 `structural`(기능·구조 이름의 숫자: 「2단계 인증」·「6자리」·「만 14세」 — 예시 그대로 써도 된다) 또는 `business`(사업 수치: 「3개」·「월 300건」 — 그대로 쓰면 검사가 떨어진다)이다.

- 예시 문장을 이 서비스에 맞게 다시 쓴다. 뜻(오류 안내·다음 행동 안내 등)은 그대로 두고 가상 서비스 이름·가상 도메인(일정·주문·보고서 …)을 이 서비스의 일로 바꾼다.
- `{date}`·`{plan}`·`{n}` 같은 자리 표시는 예시와 같은 것을 그대로 둔다(블록이 실행 때 채운다). 빠뜨리거나 더하면 검사(`ui-copy`)가 떨어진다.
- 「예시」·`(example)` 표지를 쓰지 않고 예시 문장을 그대로 베끼지 않는다.
- 브리프에 없는 약속(응답 시간·보관 기간·무료 기간)과 숫자를 짓지 않는다. 모르면 약속을 빼고 안내만 쓴다. 「확인 필요」는 이 칸에 쓸 수 없다.
- 「8자 이상」「6자리」처럼 화면이 실제로 지키는 값은 예시의 숫자를 그대로 쓴다.
- **`slot.ui.why`**: `marker` = 예시 표지·가상 이름이 남은 문장, `digits` = 예시의 숫자가 남은 문장. `digits` 문장은 숫자가 화면이 지키는 값(8자·6자리·만 14세)이면 그대로 두고, 사업 수치(월 300건·직원 3명·13개월·10분)이면 브리프 사실의 숫자로 바꾸거나 숫자 없이 쓴다. 브리프 사실에 없는 사업 수치를 남기지 않는다.
- **en 사이트**: 예시 문장과 `role` 안의 예시는 한국어일 수 있다. 뜻을 영어로 옮겨 `text`를 쓴다. 옮길 때도 위 규칙(자리 표시 그대로·예시 표지 금지·지어낸 숫자 금지)을 지킨다. `slots.copy[].role`은 요청 값을 한 글자도 바꾸지 않고 옮긴다. 검사는 `text`만 본다.
- 예시 문장 안의 메일·전화·도메인(`name@example.com` 등)은 브리프 사실이 아니면 쓰지 않는다. 예시를 빼고 뜻만 쓴다.
- 청약철회·환불·요금 안내처럼 법적 성격이 있는 문장은 브리프 사실 안에서만 쓴다. 사실에 없는 약속은 짓지 않고, 사실이 없으면 안내만 쓴다. 이런 칸은 법률 검토 단계가 다시 본다.
- **뜻을 지키는 것과 약속을 짓지 않는 것이 부딪치면 약속을 짓지 않는 쪽이 이긴다.** 예: 체험 종료 뒤 무엇이 일어나는지·첫 결제 시점·알림 시점·보관 기간은 브리프 사실에 있을 때만 쓴다. 없으면 그 약속을 뺀 중립 안내(「설정에서 바꿀 수 있어요」)로 쓴다. 이렇게 뺀 칸은 결과 보고에 칸 이름으로 적는다.
- `digits` 칸의 숫자가 **기능 이름·화면 구조**(「2단계 인증」·「만 14세」·「6자리」, `numbers: "structural"`)면 그대로 둔다. **사업 수치**(월 300건·직원 3명·13개월·10분, `numbers: "business"`)일 때만 브리프 사실의 숫자로 바꾸거나 뺀다. 바꿀 사실이 없어 숫자 없는 문장이 안 되면 **`text` 를 빈 문자열(`""`)로 남긴다**(`business` 칸만 비울 수 있다). 06-pages 가 그 칸이 든 표 행(비교 표의 한 줄)을 통째로 빼므로 예시 수치도 빈 칸도 화면에 나가지 않는다. `structural` 칸을 비우면 검사가 떨어진다.
- **법적 성격이 있는 `ui:` 문장**(청약철회·환불·요금·자동 갱신·동의·개인정보)은 중립 안내로 쓰고, 그 칸 이름을 결과 보고의 「법률 검토 표시」 줄에 적는다(법률 검토 단계가 이 줄을 먼저 본다).

## 구조 칸 (`structureSlots` — 본문 섹션 자료, 대장 C297)

홈·소개·소식·사례 쪽의 본문 섹션(소식 목록·연혁·리더십·보고서·채용 링크·바로가기·공지·작업 카드·사례·변경 기록 …)은 콘텐츠의 **구조 칸**에서 값을 읽어 그린다. 문구 칸(`slots`)에 쓰는 글과 따로, 요청의 `structureSlots[]` 가 그 칸을 알려 준다. 칸 하나의 모양:

```json
{
  "path": "news",                        // 콘텐츠 최상위 칸 이름 — 04-content.json 의 이 자리에 쓴다
  "sections": ["home/news", "news/press-list"],   // 이 칸을 읽어 그리는 섹션
  "factsWanted": ["news"], "factsUsed": ["news"], // 채울 수 있는 브리프 사실 이름 / 지금 브리프에 실제로 있는 것
  "empty": false,                        // true = 브리프에 이 사실이 없다
  "schemaRequired": false,               // true = 스키마가 이 칸을 필수로 요구한다
  "reads": ["[].title", "[].date", "[].url", "[].thumb"],  // 섹션이 읽는 항목 칸([] = 배열의 항목)
  "shape": { "type": "array", "item": { "date": "YYYY-MM-DD 날짜 — …", "title": "글자(비지 않음) — 제목", "url": "http(s) 절대 주소(사실이 없으면 「확인 필요」) — …", "thumb?": { "type": "ImageSlot", … } } }
}
```

`shape` 에서 이름 끝 `?` 는 선택 칸이다. 읽는 법과 채우는 법:

- **사실로만 채운다.** `factsUsed` 의 사실(브리프 `facts` 의 글)에 적힌 항목을 하나씩 구조 칸 항목으로 옮긴다. 이름·제목·링크 글자는 사실의 글자 그대로 옮기고, 날짜는 `YYYY-MM-DD` 로 바꾼다(`2026년 9월 3일` → `2026-09-03`). 항목 안의 설명 글(약력·과제·해결 등)은 해요체로 다듬어도 되지만 사실에 없는 숫자·날짜·이름·주소를 더하지 않는다. 사실에 있는 항목보다 많이 쓰지 않는다.
- **`empty: true` 이면 그 칸을 적지 않는다**(배열은 칸을 빼거나 `[]`, 문자열은 칸을 뺀다). 소식·인물·연혁·링크를 지어내 채우지 않는다. 필수(`schemaRequired`)여도 같다 — 검사가 그 칸의 스키마 오류를 건너뛰고, 06 이 섹션을 「자료 연결 안 됨」으로 남긴다.
- 사실이 있는데 칸을 비우면 검사(`[structure-missing]`)가 떨어진다. 사실에 없는 항목·날짜·연도·주소·숫자는 `[structure-trace]`, 사실이 없는 칸을 채우면 `[structure-invented]` 다.
- **주소 칸**(`url`·`href`·`pdfUrl`·`careersUrl`): 사실에 적힌 주소만 쓴다. 사실에 없으면 정확히 `placeholder`(「확인 필요」)를 적는다 — 화면은 링크 없이 글만 그리고 06 이 「확인 필요 사실」 blocker 를 남긴다(Href 형식의 칸도 자리 표시는 검사가 받는다). 사실에 없는 `/notice/1` 같은 경로를 짓지 않는다. 사이트 안 경로는 `siteRoutes` 에 있는 것만 쓴다.
- **사진 칸(`ImageSlot`)**: 필수(`portrait`·`thumb`)이면 `{ "id", "aspect", "source" }` 는 `shape` 가 알려 준 값 그대로(비율이 없으면 직접 적는다, 예 `4:3`), `alt` 는 이 항목의 이름으로 쓴 짧은 설명(예: 「윤도현 사진」), `src` 는 적지 않는다(진짜 사진이 없다 — 화면이 「실제 사진 필요」 틀을 그리고 05-media 가 공개 불가 사유로 남긴다). 선택 칸(`thumb?`)은 사진 사실이 있을 때만 적는다.
- **portfolio `caseStudies`**: 사례 쪽은 **첫 항목(0번)만** 그린다. 가장 대표인 사례를 맨 앞에 둔다. `process`·`results` 는 문자열 배열(항목마다 한 줄), `slug`·`next` 는 `works[].slug` 와 같은 사실의 주소 조각이다.
- **brand `reports`**: 문구 칸 `claim` 이 있으면(지속가능성 주장) 보고서 항목이 하나 이상 있어야 한다(스키마). 사실이 없으면 `claim` 칸도 요청에 없다.
- **`history`·`leaders` 같은 칸이 사이트맵에 없으면** 요청의 `structureSlots` 에도 없다 — 브리프에 그 사실(`history`·`leaders` …)이 있을 때만 섹션이 들어온다. 요청에 없는 칸을 더하지 않는다(검사가 `[schema]` 로 막지는 않지만 06 이 읽지 않는다).
- **commerce `origin`**: 사실 `origin` 이 있으면 `products[].origin` 칸을 그 사실로 채운다(식품은 원산지 필수). **dashboard `decision.refresh`**: 사실 `refresh` 가 있으면 그 글(예: 「5분마다 새로 고쳐요」), 없으면 `missing` 규칙대로 `placeholder`.

브리프 사실 안의 항목 구분은 보통 ` ; `(항목)·` | `(항목 안 칸)·` / `(항목 안 목록)이다. 칸 순서는 `shape` 와 같고, 모양이 모호하면 사실에 있는 글로 판단하되 지어내지 않는다.

## 빈 사실

`missing`에 든 사실은 `factPaths[이름]` 자리에 정확히 `placeholder`를 문자열로 적는다. 예: 전화번호가 없으면 `"business": { …, "phone": "확인 필요" }`. 비워 두거나 `""`·`null`로 두거나 그럴듯한 값을 넣으면 검사가 떨어진다.

**`missing`은 스키마가 필수로 요구하는데 사실이 없는 자리를 전부 담는다.** 브리프의 필수 사실뿐 아니라 스키마가 요구하는 주소·전화(`business.address`·`business.phone`)와 주소 칸도 들어 있다. 이름 옆 `factPaths`가 자리를 알려 준다. 예:

| 이름 | 자리 | 적는 것 |
|---|---|---|
| `booking` (local) | `booking.primary.value` | `booking.primary`를 `{ "kind": "tel", "value": "<placeholder>" }`로 쓴다 |
| `mapLinks.naver`·`mapLinks.kakao` (local) | `mapLinks.naver`·`mapLinks.kakao` | 그 칸에 `placeholder`. 주소 칸(`Url`)도 자리 표시를 받는다. 화면은 링크를 그리지 않는다 |
| `directions.transit`·`directions.parking` (local) | 같은 이름의 칸 | `placeholder` |
| `product.url` (saas) | `product.url` | `placeholder`. `https://example.com` 같은 값을 만들어 넣지 않는다 |
| `organization.url` (brand) | `organization.url` | 사실 `companyUrl` 이 있으면 그 주소, 없으면 `placeholder` |
| `business.ftcLookupUrl`·`business.termsUrl`·`business.privacyUrl` (commerce) | 같은 이름의 칸 | 사실 `ftcLookupUrl`·`termsUrl`·`privacyUrl` 이 있으면 그 주소, 없으면 `placeholder`(스키마가 절대 주소만 받으므로 `/terms` 같은 경로도 쓰지 않는다) |
| `shipping.courier` (commerce) | `shipping.courier` | 사실 `courier` 가 있으면 그 글자, 없으면 `placeholder` |
| `agency.phoneNote`·`agency.copyright` (public) | 같은 이름의 칸 | 사실 `phoneNote`·`copyright` 가 있으면 그 글자, 없으면 `placeholder` |
| `agency.accessibilityPolicyUrl` (public) | `agency.accessibilityPolicyUrl` | 사실 `accessibilityPolicyUrl` 이 있으면 그 주소, 없으면 `placeholder`. 빈 앵커 `#` 로 채우지 않는다(검사는 이 칸의 형식 오류만 건너뛴다) |
| `decision.refresh` (dashboard) | `decision.refresh` | 사실 `refresh`(갱신 주기)가 있으면 그 글, 없으면 `placeholder`. 운영 화면 머리가 이 칸을 「갱신 주기」 행으로 그린다 |

**회사 정보 자리는 원형마다 다르다.** `factPaths` 가 알려 주는 자리를 따른다 — local·saas·commerce·detail 은 `business`, brand 는 `organization`(`business` 를 쓰면 검사가 「알 수 없는 최상위 칸」으로 떨어뜨린다), public 은 `agency`(이름·주소·대표전화 `mainPhone` 만 — 메일·대표자 같은 사실은 `facts` 에만 둔다), dashboard·portfolio·pwa 는 회사 정보 칸이 없어 사실을 `facts` 에 원문으로 남기고 구조 칸(portfolio `contact.email`·pwa `manifest.name`)은 그 사실로 채운다. public `agency.privacyPolicyUrl` 은 `seedContent` 에 이 사이트의 `/privacy` 가 이미 들어 있다.

**열거형·불리언 결정 칸**(public `decision.krds_scope` 의 기관 유형·표준형/확장형·공식 배너·운영기관 식별자, dashboard `decision`)은 사실 이름이 없어 자리 표시를 못 받는다. 브리프 사실이 말하는 값만 쓰고, 말하지 않으면 **가장 덜 주장하는 값**(공식 배너 `false`·운영기관 식별자 `false`)을 쓰고 결과 보고에 칸 이름을 적는다.
| `product.shipping.fee` (detail) | `product.shipping.fee` | 숫자 칸이다. 사실 `shippingFee`가 있으면 그 금액 정수, 없으면(`missing`에 있으면) 그 칸에 `placeholder` 글자를 적는다. 0·추정값을 넣지 않는다(0은 무료배송 약속이다). 검사는 이 칸의 형식 오류만 건너뛴다 |
| `product.shipping.freeThreshold` (detail) | `product.shipping.freeThreshold` | 선택 칸. `shipping` 사실에 무료배송 기준 금액이 있으면 그 금액을 **최소 단위 정수**로 쓴다(`free over $80` → `8000`, `5만원 이상 무료` → `50000`). 없으면 칸을 적지 않는다. 배송비(`fee`)·가격(`price`)과 같은 단위다 — 검사(`invented-fact`)가 단위 틀림을 잡는다 |
| `product.returns.feePayer` (detail) | `product.returns.feePayer` | `buyer`·`seller` 중 하나. 사실 `returnsFeePayer`가 있으면 그 값, 없으면 `placeholder` 글자. 어느 쪽인지 짐작하지 않는다 |
| `product.shipping.courier`·`notice.category` (detail) | 같은 이름의 칸 | 사실 `courier`·`noticeCategory`가 있으면 그 글자, 없으면 `placeholder` |
| `notice.rows` (detail) | `notice.rows[0].value` | 배열 칸이다(1행 이상 필수). 사실 `noticeRows`·`productInfo`·`specs`·`origin`이 있으면 「항목: 값」마다 한 행(`label`=고시 항목 이름 그대로, `value`=값). 없으면 `[{ "label": "<placeholder>", "value": "<placeholder>" }]` 한 행만 적는다 — 고시 항목 이름은 품목(`notice.category`)마다 「전자상거래 등에서의 상품 등의 정보제공에 관한 고시」 별표가 정하므로 짐작해 적지 않는다. 06 이 「확인 필요 사실」 blocker 를 남긴다 |
| `shipping`·`returns` (detail) | `facts.shipping`·`facts.returns` | 숫자·구조로만 받는 사실이 통째로 없을 때다. 그 자리에 `placeholder` 를 적고 `product.shipping`·`product.returns` 구조는 콘텐츠에서 뺀다(택배사·배송비·반품 배송비 자리도 함께 없어진다) |

- 위 자리에 값을 만들어 넣거나 그 칸을 비우면 검사가 떨어진다. 스키마가 요구하는 자리를 `missing`에서 못 찾으면 요청을 만든 쪽 문제다. 값을 지어내지 말고 막힌 줄과 함께 보고한다.
- 사실이 **있으면** 그 사실로 구조를 만든다. 사실이 없을 때만 뺀다. 브리프에 있는 사실을 구조로 옮기는 일은 네 몫이다.
  - `hours` 문자열 → 스키마의 `hours` 배열(요일·시각), `price` 사실 → saas `plans`·detail `product.price`, `shipping`·`returns` → detail `product.shipping`·`product.returns`, `transit`·`parking` → `directions`.
  - saas `plans[].vatIncluded`: `price` 사실이 부가세 포함(「부가세 포함」·「VAT 포함」·including VAT)이라고 말하면 `true`, 별도(「부가세 별도」·excluding VAT)라고 말하면 `false`. 사실이 세금을 말하지 않으면 이 칸을 적지 않는다(짐작하지 않는다). 이 칸이 있어야 요금표가 세금 표기를 그린다.
  - 사실이 둘 이상의 항목이면(요금제 여럿, 단계 여럿, 질문 여럿) 항목마다 구조 칸에 넣는다. 구조 칸이 하나뿐인 문구 칸이면 한 문장 안에 압축해 `maxChars` 안에서 이어 쓴다.
  - 브리프가 무료를 말하면 가격 `0`을 쓸 수 있다(`free`·「무료」가 사실에 있을 때 `monthlyPrice: 0`). 사실에 무료가 없으면 0을 쓰지 않는다.
- 원형 스키마가 그 자리를 구조로 받는 사실(local 의 `hours`, saas 의 `plans`, detail 의 `product.price`)이 **비어 있으면** 그 칸을 콘텐츠에서 뺀다. 검사가 그 오류만 건너뛴다. 대신 `facts.<사실 이름>`에 `placeholder`를 적는다.
- 사실이 있는데 자리 표시를 남기면 검사가 떨어진다.
- 문구 칸이 `placeholder: true`이면 그 칸은 자리 표시 그대로 둔다. 이 칸은 A3(CTA 동사 + 받는 것)을 받지 않는다. 자리 표시 CTA 는 사실이 생기면 다시 쓴다.

## 사실 이름과 콘텐츠 칸

사실 이름(브리프)과 콘텐츠 필드 이름은 다를 수 있다. **`factPaths`가 대응표다.** 예: `bizNo` → `business.bizRegNo`, detail 의 `name` → `product.name`·`seller` → `business.name`. 이름이 다르다고 값을 옮기지 않거나 두 곳에 나눠 쓰지 않는다. saas 의 `product`(`name`·`url`)는 `seedContent`에 이미 들어 있다(이름은 상호, 주소는 `productUrl` 사실). 없는 주소는 `missing`의 `product.url`이 알려 준다.

## 구조 칸과 문구 칸을 쓰는 형식

- **`menu[]`(local)**: `price`는 정수(원)다. 「35,000원부터」처럼 범위 표현이 있으면 `price`는 가장 낮은 값, `name` 끝에 「(35,000원부터)」처럼 표현을 그대로 적는다. 검사는 금액이 사실에 있는지만 본다.
- **`todayHours`·`hours` 문구 칸**: 문구는 정적 글이라 「오늘」을 알 수 없다. 요일별 시간을 한 줄로 압축해 쓴다(예: 「화-토 10:00-19:00, 일 12:00-17:00, 월 휴무」). 「오늘」이라는 말을 쓰지 않는다. 스키마의 `hours` 배열은 사실 전체를 요일별 구조로 옮긴다.
- **한 칸에 여러 항목**: `qa` = 「Q. 질문 A. 답」 한 문자열, `planName` = 요금제 이름을 쉼표로 잇는다(예: Free, Pro), `stepTitle` = 단계 전체를 뜻하는 짧은 제목 하나(예: 「세 단계로 끝나요」). 항목마다 따로 쓸 구조 칸(`plans`·`workflowSteps`·`faq`)이 있으면 그쪽에 항목마다 넣는다.
- **`workflowSteps[].uiCrop`(saas)**: 진짜 화면 캡처가 없으므로 `{ "id": "step-ui-crop", "aspect": "4:3", "source": "real-required", "alt": "<이 단계 화면 설명>" }`로 쓴다(`src`는 적지 않는다). 화면은 「실제 사진 필요」 틀을 그리고 05-media 가 공개 불가 사유로 남긴다. 이미지 파일을 만들거나 다른 곳의 그림을 끌어오지 않는다.

## 지어낸 사실

콘텐츠의 모든 글자에서 전화번호·사업자등록번호·가격·주소·메일을 정규식으로 찾아 `facts`와 맞춘다. `facts`에 없는 값이 하나라도 있으면 `[invented-fact]`로 떨어진다.

- 표기는 달라도 된다(`+82-2-1234-5678` = `02-1234-5678`, `4,800원` = `4800`).
- 계산해서 만든 값(연간 가격 = 월 가격 × 12)도 사실에 없으면 떨어진다. 브리프에 있는 값만 쓴다.
- 사실로 들어온 메일·주소가 예약 도메인(`example.com`·`example.org`·`.test`·`.invalid` 등)이면 그대로 옮긴다. 바꾸지 않는다. 06-pages 가 그 자리를 「예시 연락처」 공개 불가 사유로 남긴다.
- 실존 브랜드·회사 이름을 쓰지 않는다. 가상 이름에는 「예시」를 붙인다(운영자가 준 본인 사업 사실은 그대로 쓴다).

## 쓰는 법 (DESIGN §9·§22)

- **A1 5초 안에 답한다.** 히어로 문구는 무엇인지, 누구를 위한 것인지, 누르면 무엇이 일어나는지를 말한다. 기발함보다 명료함이 먼저다. 헤드라인은 기능이 아니라 결과를 말하고, 근거가 있으면 숫자·기간·금액 하나를 넣는다(브리프 사실에 있는 것만).
- **A2 화면마다 주 행동은 하나다.**
- **A3 CTA 문구는 동사 + 받는 것이다.** 「예약하기」보다 「자리 예약하기」, 「시작하기」보다 「무료로 시작하기」. 맨 「확인」「제출」「더보기」는 쓰지 않는다. 한국어는 해요체·능동형으로 쓰고, 버튼만 보고 다음 화면이 예측되게 한다.
- 다른 회사 이름을 넣어도 성립하는 문장은 실패다. 구체 명사·숫자·결과로 쓴다.
- 문장은 능동태로 짧게, 문단은 4문장 이내, 핵심 단어를 문장 앞에 둔다. 같은 개념에는 한 용어만 쓴다.
- 근거 없는 수치(「99.99% 가동률」「30% 상승」)와 지킬 수 없는 보증을 쓰지 않는다. 가짜 긴급성·희소성(「3명이 보는 중」)과 거절 문구로 죄책감을 주는 말을 쓰지 않는다.
- 의료기관(local 의 의료 변형)은 치료경험담 후기를 쓰지 않는다.
- **FAQ·소개의 첫 문단은 질문에 대한 직접 답이다**(geo-answer-structure). 소제목이 질문이면 그 아래 첫 문장이 답이고, 배경 설명은 뒤에 둔다. 근거에 쓰는 수치는 브리프 사실에 있는 것만 쓰고 출처와 날짜를 함께 적는다(사실에 없으면 수치를 빼고 「확인 필요」 규칙을 따른다). AI 검색이 소제목 아래 첫 문장을 뽑아 쓰기 쉽게 하려는 규칙이다.
- **글자 캡차와 「로봇이 아닙니다」 문구를 쓰지 않는다**(ax-captcha-bot-wall). 폼·가입·문의 문구에 이 문구를 넣지 않는다. 글자를 읽어 옮기게 하는 확인은 WCAG 3.3.8(접근 가능한 인증)을 어긴다. 봇 확인이 필요하면 문구 없이 어댑터의 봇 확인 토큰 자리(`bot_check_failed`)로 처리하고 사람에게는 「잠시 뒤 다시 시도해 주세요」처럼 결과만 안내한다.

## 검사가 막는 것 (`checks`가 정본, 요약)

**구조 칸**: `[structure-invented]` 사실 없는 칸을 채움 · `[structure-missing]` 사실 있는 칸을 비움 · `[structure-trace]` 항목의 이름·제목·날짜·연도·주소·숫자가 브리프 사실에 없음(위 「구조 칸」).

**공통(ko·en)**: 이모지 · 느낌표(`!`) · em dash(`—`).

**ko**
- 해요체·능동형이다. 합쇼체(`-습니다`·`-입니다`·`-십시오`)와 마침표 있는 해라체(`-한다.`)로 끝맺지 않는다. 명사로 끝나는 라벨·제목은 된다.
- 금지 표현: 「~의 새로운 기준」 「~를 경험하세요」 「더 스마트하게」 「한눈에」 「혁신·혁신적」 「원활한·최첨단·획기적」 「수천 명이 선택한」 「~의 힘」 · 대비 구문(「X가 아니라 Y」 「단순한 X가 아니다」) · 부정 나열(「X도 Y도 아닌 Z」) · 극적 파편(「빠르게. 쉽게. 따뜻하게.」 「그게 다입니다」) · 수사 질문 도입(「만약 ~라면?」) · 헛기침·가짜 통찰·해석 메타·요약 반복(「솔직히 말하면」 「대부분이 놓치는」 「이 점이 중요합니다」 「보시다시피」 「결론적으로」) · 근거 없는 권위(「전문가들은」 「연구에 따르면」) · 의미 없는 강조어(정말·진짜·그냥) · 「당신」 · lorem·John Doe.
- 수사·대비를 쓰지 않고 바로 말한다. 「X가 아니라 Y」는 「Y」로 쓴다.

**en**
- 금지어: delve, foster, leverage, utilize, facilitate, empower, streamline, robust, cutting-edge, paradigm shift, game changer, tapestry, realm, beacon, multifaceted, meticulous, intricate, paramount, transformative, elevate, embark, supercharge, harness, ever-evolving, seamless, effortless, blazing-fast, next-level, unlock the power, say goodbye to, meet your new.
- 대비 구문(「not just X, it's Y」 「X isn't A, it's B」), 「X theater」, 빈 문구(at the end of the day, when it comes to, at its core, in today's world, going forward, let's dive in …), 헛기침(here's the thing, let me be clear …), 은어(deep dive, circle back …).
- en 사이트에는 한글이 없다. 해요체·한국어 금지어 검사는 돌지 않는다.

이 목록의 출처: ko = DESIGN §9·§14-C, en = `kill-ai-slop`(scan.mjs tell 14·15) · `no-ai-slop`(Words to cut) · `stop-slop`(보류 스킬 `phrases.md`). 규칙을 바꾸면 `factory/stamp/content.mjs`의 `KO_BANNED`·`EN_BANNED`·`COMMON_BANNED`만 고친다.

## 윤문

1. 문구를 다 쓴다(화면에 보이는 글: `slots.copy` · FAQ · 공지 · 이미지 `alt`). 요청에 `site` 칸이 없으면 `site`는 쓰지 않는다.
2. ko 면 `humanize-korean`, en 이면 `no-ai-slop`(`stop-slop`이 설치돼 있으면 그것)을 기준으로 고친다. **문구가 짧으면(칸 대부분이 한 줄) 스킬을 호출하지 않고 금지 목록과 「검사가 막는 것」을 기준으로 직접 읽으며 고친다.** 의미·숫자·고유명사를 바꾸지 않는다. 사실 값(전화·가격·주소)은 손대지 않는다.
3. `kill-ai-slop`은 JSON 을 스캔하지 못한다(0개 스캔). 돌리려면 `slots.copy[].text`만 뽑은 `.md` 사본을 만들어 그 파일로 돌리고, 사본은 작업이 끝나면 지운다. 짧은 문구라 생략했으면 결과 보고에 「생략」이라고 적는다.
4. 윤문 뒤 글자 수를 다시 센다(`--check`가 센다).
5. 바꾼 문장은 결과 보고에 전·후 표로 남긴다. 바꾼 문장이 없으면 「없음」이라고 적는다.

## 문구 변형 (J2 `copyVariant`)

같은 섹션에 문구를 둘 이상 써서 비교하려면 최상위에 `copyVariants`를 둔다: `{ "<쪽>/<섹션>": "<id>" }`.

- 키는 요청 `sections`에 있는 것만이다.
- id 는 소문자·숫자·`-`, 첫 글자는 소문자나 숫자, 32자 이하다(예: `b`, `long-1`).
- 이 태그는 「이 콘텐츠가 그 섹션에 쓴 문구 판의 이름」이다. 다른 판을 만들 때는 같은 요청으로 `04-content.json`을 한 벌 더 쓰고 id 를 다르게 붙인다. 페이지 생성 단계가 이 값을 `withAttribution(analytics, { blockId, recipeId, copyVariant })`에 넘긴다.
- 비교하지 않으면 쓰지 않는다.

## 결과 모양 (local ko 예)

```json
{
  "archetype": "local",
  "locale": "ko",
  "business": { "name": "…", "address": "…", "phone": "확인 필요", "bizRegNo": "…" },
  "hours": [{ "day": "tu", "opens": "10:00", "closes": "20:00" }],
  "mapLinks": { "naver": "https://…", "kakao": "https://…" },
  "directions": { "transit": "…", "parking": "…" },
  "facts": { "menu": "…" },
  "slots": { "copy": [{ "id": "tagline", "role": "…", "text": "…" }], "images": [] },
  "copyVariants": { "home/hero-visit-info": "b" }
}
```

위는 모양만 보이는 예다. `phone`이 `확인 필요`인 것은 브리프에 전화번호가 없을 때만이다. 실제 칸은 요청과 원형 스키마를 따른다.

## 구획을 더한 뒤 이어 쓰기 (`pendingSlots` — 구획 수정)

사용자가 구획을 더하면(`--revise "FAQ 추가해줘"` → `--revise-pick`, factory/stamp/revise-structure.mjs) `04-content.json` 은 **이미 새 구획 순서로 맞춰져 있다**. 구획을 빼거나 순서를 바꾼 수정은 문구 작업이 없다 — 다음 찍어내기가 04 를 에이전트 없이 통과한다.

- `04-content.json` 을 처음부터 다시 쓰지 않는다. 기존 항목은 그대로 두고 새 구획의 칸만 채운다. 새 칸은 `--revise-pick` 이 쓴 요청의 `pendingSlots`(칸 경로 목록)에 있다 — 찍어내기를 다시 돌리면 요청 파일이 새로 쓰여 이 칸이 없어지지만, 검사 출력의 `문구가 비었다: <칸 경로>` 줄이 같은 목록이다.
- 새 칸의 항목은 요청 순서 자리에 이미 있다. 사실이 있는 칸은 `"text": ""` 이니 사실로 쓴다. 사실이 없는 칸(요청 `placeholder: true`)은 이미 정확히 자리 표시다 — 그대로 둔다(지어내지 않는다).
- 블록의 화면 문구 칸(`ui:`)은 항목이 없다. 요청 순서 자리에 직접 더한다.
- 구조 칸(`structureSlots`)이 새로 생겼으면 그 칸도 채운다.
- 끝나면 위 「순서」 6 의 검사를 돈다.

## 끝내는 조건

- `node factory/stamp/content.mjs --check <요청> <04-content.json>`이 종료 0 이다.
- 결과 보고에 그 출력(`통과 — 문제 0건`)과 윤문 전·후 표를 붙인다.
- 검사가 계속 떨어지는데 원인이 요청·스키마 쪽에 있어 보이면(예: 스키마가 자리 표시를 받지 못하는 칸) 값을 만들어 넣지 말고 막힌 줄과 함께 보고한다.
