# references/

SNS·드리블 수집 결과를 계획 2(레시피/블록)가 입력으로 쓰는 자리.

## 내용물

- `sites.json` — 사이트 인벤토리(53개). `design-rules\factory\reference_sites.json` 사본, 수집 에이전트 완료 시점 기준. 계획 2 시작 전에 최신본으로 갱신할 것.
- `sites.md` — 위 인벤토리의 사람이 읽는 버전(`design-rules\factory\reference_sites.md` 사본).
- `dribbble-summary.md` — 드리블 수집 요약(`design-rules\factory\dribbble\summary.md` 사본).
- `patterns/_template.md` — 패턴 카드 양식(스펙 §4).
- `patterns/*.md` — 드리블 패턴 카드 78장을 양식에 맞춰 이관한 것. `factory/scripts/import-cards.mjs`로 재생성 가능(원본: `design-rules\factory\dribbble\pattern_cards\`).
- `product-screens/` — **제품 화면 레퍼런스**(P3-6, 2026-10-03): 가입·로그인·계정·결제·메일·오류·접근성·모바일·문의·AX 화면을 만들거나 감사할 때 보는 1차 출처 포인터 76행(KRDS·GOV.UK·KWCAG 2.2·W3C·법제처·디지털정부 UI·UX 가이드라인 등, 주소는 전부 GET 200 확인). `sources.json`이 정본, `sources.md`는 영역별 표 + 감사 항목 ID(A01~N12)로 거꾸로 찾는 표, `README.md`는 읽는 법·주의·아직 없는 출처. 포인터만 — 원문·그림 없음. 원천 `design-rules\ux-audit\references-inbox.md`는 한 번 병합했다. `node factory/scripts/build-product-screens.mjs`로 표를 만든다(gen:all 밖).

## 가져오지 않은 것

- 이미지·`sns_media` 폴더·`shots.json`은 복사하지 않았다.
- `shots.json`(`design-rules\factory\dribbble\shots.json`)은 제3자 샷 제목·스튜디오 이름을 담고 있어 저장소에 들이지 않는다. 샷별 원본 메타데이터가 필요하면 그 경로를 직접 참조할 것 — 이 저장소 안에는 포인터만 남긴다.
- `motion/` — 모션 그래픽 레퍼런스(v0.0.9 조사, 2026-10-03): 효과 카탈로그 `effects.json`(25종·사례 1,855)·실사 사진·영상 배경 규칙 `video-backgrounds.json`(공통 규칙 + 배경 종류 9)·`sources.md` · hyperframes 웹 활용 `hyperframes/GUIDE.md`·`templates.json`·`examples/` · 모션 프롬프트 `prompts/`(허용 라이선스 원문 295 `prompts.jsonl`·`LICENSES.md`, 우리 말 패턴 카드 81 `patterns.json`, 쓰는 법 `INDEX.md`). 제3자 게시물 제목·제작자·주소는 저장소 밖 `design-rules\factory\motion\`에 둔다(위 원칙과 같다 — 포인터만): 프롬프트 색인 `linked-index.jsonl`(1,209줄) · 효과·영상 배경 사례 `cases.jsonl`(2,120줄 — 저장소 사례의 `ref` 로 찾는다) · 패턴 카드 링크 `pattern-links.json`(카드 id 열쇠).
