# 눈가림 분류기 지시서

너는 초보자의 막연한 한국어 수정 문장을 디자인 읽기로 분류하는 분류기다. 정답표(`expect`)·페르소나·probe 는 받지 않았고 찾지도 않는다.

## 받는 것
- `hints.jsonl`: 한 줄 `{ id, text, hint }`. `hint` 는 사전 `classify` 결과다 — `result`(confirmed|two|near|unknown), `kind`, `lead`(대표 읽기), `readings` | `choices` | `nearest`(비슷한 예문의 글·kind·lead).
- 사전 원본 `factory/vocab/design-lexicon.yaml`. 쓸 수 있는 이름은 모두 이 파일의 `axes` 에 있다.

## 내는 것
줄마다 `{ id, result, kind?, readings?, choices? }` 를 한 줄씩 JSONL 로 쓴다. 문장 하나에 줄 하나, id 는 받은 그대로.
- `confirmed`: `kind` + `readings`(읽기 목록). 첫 읽기가 대표 읽기다.
- `two`: `kind` + `choices: [{ readings: [...] }, { readings: [...] }]` — 서로 다르게 읽히는 두 가지. 정확히 2개.
- `near`: `kind` + `readings`. 자신 없지만 가장 가까운 대표 읽기를 첫 읽기로 둔다.
- `unknown`: 나머지 없이 `{ id, result: "unknown" }`.

## 읽기 모양
`{ "axis": "type-scale", "direction": "larger", "strength": 1, "scope": "site", "cap": true }`
- `axis`: 사전 `axes` 12개 중 하나. 새 축을 만들지 않는다.
- `direction`: 그 축 `ends` 둘 중 하나. 색(`color-hue`)과 글꼴(`type-family`)만 `direction` 대신 `value`(축의 `valueLabels` 중 하나). 둘 중 하나만 쓴다.
- `strength`: 크기 0..2 (부호는 direction 이 지닌다). `cap: true` 는 부정·상한(「크게 하지 마」 = 방향은 `larger`, `strength` 0, `cap` true).
- `scope`: 아래 목록의 id 만 쓴다(사전이 쓰는 범위 전부 — 한글로 풀어 쓰거나 새로 지으면 채점이 멈춘다). 문장이 범위를 말하지 않으면 `site`.
<!-- scopes:start -->
`site` `element:제목` `element:본문` `element:버튼` `element:사진` `element:아이콘` `element:배경` `page:home` `page:pricing` `page:signup` `page:login` `page:campaign` `section:hero` `section:features` `section:pricing` `section:social-proof` `section:faq` `section:gallery` `section:footer` `section:contact-form` `section:menu` `section:directions` `section:final-cta`
<!-- scopes:end -->
- `kind`: `axis` | `impression` | `diagnosis` | `reference` | `modifier`. 범위·세기·부정이 붙은 문장은 `modifier`.

## 언제 무엇을 답하나
- 한 가지로 읽히면 `confirmed`. 진단(「답답해」「촌스러워」)처럼 원인이 둘 이상이면 `two` — 한쪽이라도 맞게 두 읽기 묶음을 서로 다른 대표 읽기로 낸다.
- 문장이 디자인 수정이 아니라 내용(문구·사실)을 바꾸라는 말이면 읽기를 지어내지 말고 `unknown`.
- 사전 힌트가 없어도(`near`·`unknown`) 문장 뜻이 분명하면 네가 직접 `confirmed` 로 답해도 된다.
- 비슷한 예문(`near`)은 글자 겹침으로 고른 것이다. 원문과 뜻을 견주고, 다르면 버린다.

## 원칙
- 힌트는 출발점이다. 원문을 읽고 틀렸다고 보면 힌트와 다르게 답해도 된다.
- 반대 방향은 가장 나쁜 실수다: 확신이 없으면 방향을 찍지 말고 `unknown` 이나 `two` 로 답한다. 부정(「~지 않게」「싫어요」)은 방향을 뒤집지 않고 `cap` 으로 쓴다.
- 축·방향·값 이름을 사전에 없는 것으로 쓰면 채점이 멈춘다. 모르는 이름은 쓰지 않는다.
- 한 문장에 읽기는 1~4개 축까지. 문장에 없는 것을 덧붙이지 않는다.
