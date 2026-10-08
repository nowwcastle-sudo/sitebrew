// 레퍼런스 카드의 자유 서술(한국어)을 「패턴 id」로 바꾸는 정규화 표 — factory v1 Task 2.3 (빈틈 표, 레퍼런스 쪽).
//   카드(references/patterns-v2 모양)는 히어로·구획 이름·색 논리·모션 서술·상호작용·CTA 가 자유 문장이다. 이 표는 그 문장을
//   키워드 부분 문자열(소문자 정규화 뒤)로 읽어 「패턴」으로 세게 한다. 결정적이다 — 같은 카드는 늘 같은 id 목록을 낸다(정렬·중복 없음).
//   패턴마다: 어느 칸을 읽는지(fields) · 키워드(any 중 하나 + all 의 묶음마다 하나씩 − none 이 없어야) · 공장 인벤토리에서 이 패턴을 덮는 근거 토큰(covers)과
//   부분만 덮는 토큰(near) · 비었을 때의 제안(proposal) · 자기 예문(example — 시험이 표 자체를 양성 대조한다).
//   근거 토큰 이름(소문자): block:kind|variant|layout|media|motion:<값> · recipe:color|dynamics|motion|hero|signature|axes:<…> · axis:<축>:<값> ·
//   motion:tech|ease:<이름> · card:<효과 카드 id> · style:<스타일 id>|style:color:<K> · ui:<부품>. 읽는 쪽은 gap-matrix.mjs 의 loadInventory.
//   제3자 글은 옮기지 않는다 — 키워드는 우리가 고른 짧은 낱말이고, 카드 원문은 이미 우리 말로 정리된 관찰이다.

export const FIELDS = ['hero', 'sections', 'entrance', 'scroll', 'hover', 'transition', 'interaction', 'cta', 'color']
export const DIMS = ['hero', 'section', 'interaction', 'cta', 'entrance', 'scroll', 'hover', 'transition', 'color']
export const PROPOSAL_KINDS = ['block', 'recipe', 'motion', 'gate', 'rule', 'doc', 'launch-factory']
export const COVER_NAMESPACES = ['block', 'recipe', 'axis', 'motion', 'card', 'style', 'ui']
/** 이 이름공간의 토큰이 맞으면 공장이 실제로 갖고 있다(yes). 나머지(card·style)는 조사·사전만 있어 partial. */
export const CODE_NAMESPACES = ['block', 'recipe', 'axis', 'motion', 'ui']

// recipe.mjs COLOR_LOGIC_LABEL 과 같은 아홉(시험이 대조한다 — 이 표는 가볍게 읽히도록 복사해 둔다).
const COLOR_LABEL = { K1: '단일 액센트·중립 우세', K2: '다차원 팔레트', K3: '문서형 무채색', K4: '브루탈 두 모드', K5: '에디토리얼 럭셔리', K6: '색 면', K7: '듀오톤', K8: '색 블록', K9: '단색 램프' }
const COLOR_PROPOSAL = {
  K1: ['doc', '레시피 라이브러리에 이미 있다 — 새 산출물 없음'],
  K2: ['recipe', '다차원 팔레트(색 논리 K2) 레시피 한 벌 — 데이터가 많은 saas·dashboard 원형 후보'],
  K3: ['recipe', '문서형 무채색(K3) 레시피 한 벌 — 글이 주인공인 public·detail 원형 후보'],
  K4: ['recipe', '브루탈 두 모드(K4) 레시피 한 벌 — 대담안 후보, 동작 줄이기 정지와 대비 기준 필수'],
  K5: ['recipe', '에디토리얼 럭셔리(K5) 레시피 한 벌 — brand·commerce 원형 후보'],
  K6: ['doc', '레시피 라이브러리에 이미 있다 — 새 산출물 없음'],
  K7: ['doc', '레시피 라이브러리에 이미 있다 — 새 산출물 없음'],
  K8: ['doc', '레시피 라이브러리에 이미 있다 — 새 산출물 없음'],
  K9: ['recipe', '단색 램프(K9) 레시피 한 벌 — 린트 k9-mono 는 있고 shipped 레시피만 없다'],
}

const clean = (s) => String(s).normalize('NFC').toLowerCase().replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim()

/** 소문자 · NFC · 폭 0 글자 제거 · 공백 접기. 배열은 공백으로 이어 붙인다. 없으면 빈 문자열. */
export function normalizeText(v) {
  if (v == null) return ''
  if (Array.isArray(v)) return clean(v.map((x) => (x == null ? '' : String(x))).join(' '))
  return clean(v)
}

const k = (...a) => a // 키워드 묶음을 읽기 쉽게

const DEFAULT_FIELDS = { hero: ['hero'], section: ['sections'], interaction: ['interaction'], cta: ['cta'], entrance: ['entrance'], scroll: ['scroll'], hover: ['hover'], transition: ['transition'] }

const RAW = []
/** def(id, 이름표, { any, all, none, fields, covers, near, kind, summary, example }) */
function def(id, label, o) {
  const dim = id.split(':')[0]
  RAW.push({
    id, dim, label,
    fields: o.fields ?? DEFAULT_FIELDS[dim],
    match: { any: (o.any ?? []).map(clean), all: (o.all ?? []).map((g) => g.map(clean)), none: (o.none ?? []).map(clean) },
    covers: o.covers ?? [], near: o.near ?? [],
    proposal: { kind: o.kind, summary: o.summary },
    example: o.example,
  })
}
const SI = ['sections', 'interaction']

// ── 히어로(첫 화면 구성) ───────────────────────────────────────────────────
def('hero:fullscreen-video', '전면 영상 위에 제목을 얹는 첫 화면', { any: k('전면 영상', '전폭 영상', '전체 화면 영상', '풀스크린 영상', '영상 히어로', '배경 영상', '영상 위', '착수 영상', '영상 전체', '영상 박스', '전면 동영상'), covers: k('block:media:video', 'block:variant:hero/kinetic-type-video'), kind: 'block', summary: '전면 영상 히어로 변형 — 포스터가 첫 칠, 보일 때만 재생, 동작 줄이기는 정지', example: '전면 영상 위에 큰 제목' })
def('hero:product-gallery-buy', '큰 상품 사진 열과 가격·구매 칸', { any: k('상품 사진', '제품 사진', '큰 상품', '썸네일 열', '사진 열', '갤러리', '클로즈업'), covers: k('block:kind:product-info', 'block:layout:spec-purchase'), kind: 'block', summary: '상품 사진 열 + 가격·구매 칸 첫 화면(detail 원형) 변형', example: '큰 상품 사진과 가격' })
def('hero:centered-headline', '중앙 정렬 한 줄 헤드라인', { any: k('중앙 정렬', '가운데 정렬', '한가운데', '중앙 헤드라인', '가운데 헤드라인', '중앙 굵은', '중앙에 굵은', '중앙 한 줄'), covers: k('block:variant:hero/centered-proof-panel', 'block:layout:centered-mark'), kind: 'block', summary: '중앙 정렬 한 줄 헤드라인 히어로 변형', example: '중앙 정렬 헤드라인' })
def('hero:oversize-type', '화면 폭을 채우는 초대형 글자', { any: k('초대형', '대형 로고타입', '화면 폭 가득', '대형 제목', '거대한 글자', '초거대'), covers: k('block:motion:oversize-crop', 'block:layout:grid-lines-baseline-word'), kind: 'block', summary: '초대형 타이포 히어로 변형 — 제목 길이 상한(titleMaxUnits)과 안전망 필수', example: '초대형 로고타입' })
def('hero:app-mockup', '앱·제품 화면 목업을 보이는 첫 화면', { any: k('목업', '앱 화면', '앱 창', '편집기 화면', '대시보드 화면', '제품 화면'), covers: k('block:variant:hero/leaking-app-panel', 'block:variant:hero/baseline-news-app-window', 'block:variant:hero/narrow-title-wide-window'), kind: 'block', summary: '제품 화면 목업 히어로 변형 — 목업 글은 06 mockupIssues 규칙을 따른다', example: '제품 목업이 오른쪽에 걸친 화면' })
def('hero:three-d-object', '3D 오브젝트가 있는 첫 화면', { any: k('3d'), near: k('style:3d-lite'), kind: 'block', summary: '히어로 3D 오브젝트 칸(scene3d) — 저폴리·정지 렌더 우선, 모바일은 포스터로 대체, 모션 예산 안', example: '3D 오브젝트가 떠 있는 장면' })
def('hero:illustration', '일러스트 중심 첫 화면', { any: k('일러스트'), near: k('style:illustrative'), kind: 'block', summary: '일러스트 히어로 칸 — 출처 생성 가능 칸(generated-ok)으로 선언하는 변형', example: '일러스트 풍경이 가득한 장면' })
def('hero:slide-carousel', '슬라이드 캐러셀 첫 화면', { any: k('슬라이드', '캐러셀'), covers: k('block:variant:hero/ken-burns-stills', 'block:variant:hero/vertical-title-slides', 'ui:carousel'), kind: 'block', summary: '히어로 슬라이드 변형(정지 버튼 포함)', example: '사진 슬라이드가 이어지는 화면' })
def('hero:left-fixed-menu', '왼쪽에 고정된 세로 메뉴', { any: k('세로 메뉴', '좌측 메뉴', '왼쪽 메뉴', '좌측 고정', '사이드바'), covers: k('ui:sidebar'), kind: 'block', summary: '왼쪽 고정 메뉴 + 오른쪽 본문 첫 화면 변형', example: '왼쪽 세로 메뉴를 고정한 홈' })
def('hero:split-columns', '좌우 두 칸으로 나눈 첫 화면', { all: [k('왼쪽', '좌측'), k('오른쪽', '우측')], covers: k('block:variant:hero/baseline-split', 'block:variant:hero/twin-panels'), kind: 'block', summary: '좌우 두 칸 히어로 변형', example: '왼쪽 사진, 오른쪽 제목' })
def('hero:quick-links-strip', '자주 찾는 서비스 아이콘 띠', { any: k('아이콘 띠', '자주찾기', '바로가기', '빠른 메뉴'), covers: k('block:variant:hero/identity-strip-banner'), kind: 'block', summary: '바로가기 아이콘 띠를 낀 공공 포털형 히어로 변형', example: '아래에 자주찾기 아이콘 띠' })
def('hero:map-first', '지도가 중심인 첫 화면', { any: k('지도'), near: k('block:kind:hours-location'), kind: 'block', summary: '지도 중심 첫 화면 변형 — 위치·영업시간 블록과 같은 자료를 읽는다', example: '지도가 첫 화면을 채운다' })
def('hero:photo-background', '사진을 깔고 제목을 얹는 첫 화면', { any: k('사진 위', '전폭 사진', '전면 사진', '사진 가득', '사진 배경'), covers: k('block:media:still', 'block:variant:hero/banded-full-bleed'), kind: 'block', summary: '전폭 사진 배경 히어로 변형', example: '전폭 사진 위에 제목' })
def('hero:text-only', '사진 없이 글만 있는 첫 화면', { any: k('글자만', '문장만', '텍스트만', '사진 없이'), covers: k('block:variant:hero/punch-in-statement', 'block:variant:hero/crop-marks-typed-title'), kind: 'block', summary: '글 중심(사진 없음) 히어로 변형', example: '사진 없이 굵은 문장만' })
def('hero:framed-card-inset', '액자·둥근 카드 안에 넣은 첫 화면', { any: k('둥근 모서리 카드', '액자', '프레임'), covers: k('block:variant:hero/framed-card-outline-title', 'block:variant:hero/staggered-oval-frame'), kind: 'block', summary: '액자형 히어로 변형', example: '액자처럼 든 영상' })

// ── 구획 이름 ──────────────────────────────────────────────────────────────
def('section:announcement-bar', '맨 위 공지·프로모 띠', { any: k('공지띠', '공지 띠', '프로모 띠', '유틸리티 줄', '안내 띠', '프로모션 띠', '배너 띠'), covers: k('block:kind:announcement'), kind: 'block', summary: '맨 위 공지 띠 변형', example: '공지띠' })
def('section:cookie-consent', '쿠키 동의 안내', { fields: SI, any: k('쿠키'), covers: k('block:kind:consent'), kind: 'block', summary: '쿠키 동의 블록 변형', example: '쿠키 동의 카드' })
def('section:newsletter-signup', '뉴스레터·이메일 구독 띠', { fields: SI, any: k('뉴스레터', '이메일 가입', '구독 유도', '이메일 구독'), covers: k('block:kind:lead-capture'), kind: 'block', summary: '이메일 구독 띠 변형', example: '하단 뉴스레터 띠' })
def('section:chat-widget', '떠 있는 채팅 문의 단추', { fields: SI, any: k('챗봇', '메신저', '말풍선', '상담 위젯', '채팅 버튼', '채팅 문의', '채팅 도우미', '채팅 위젯', '채팅 마스코트', '플로팅 채팅', '채팅 아이콘', '채팅 열기'), near: k('block:layout:channel-sheet', 'block:kind:contact-form'), kind: 'block', summary: '떠 있는 채팅·메신저 문의 단추 — 첫 화면 가림과 접근성(WCAG 2.4.11) 기준을 먼저 정한다', example: '플로팅 채팅 단추' })
def('section:breadcrumb', '브레드크럼 경로 표시', { any: k('브레드크럼', '경로 표시'), covers: k('block:layout:crumb-strip', 'ui:breadcrumb'), kind: 'block', summary: '브레드크럼 줄 블록(경로 표시 한 줄)', example: '브레드크럼' })
def('section:search', '머리글 검색', { fields: SI, any: k('검색'), covers: k('ui:command', 'ui:input-group'), kind: 'block', summary: '머리글 검색 칸', example: '검색창' })
def('section:language-switch', '언어·국가 전환', { fields: SI, any: k('언어', 'kr·en', 'fr/en', 'en 전환', '국가 선택'), covers: k('ui:native-select', 'ui:select'), kind: 'block', summary: '언어 전환 단추(머리글)', example: '언어 선택' })
def('section:dropdown-nav', '드롭다운·메가 메뉴 내비', { fields: SI, any: k('드롭다운', '메가 메뉴'), covers: k('ui:navigation-menu'), kind: 'block', summary: '드롭다운 내비 변형', example: '내비 드롭다운' })
def('section:hamburger-menu', '햄버거 메뉴', { fields: SI, any: k('햄버거'), covers: k('ui:site-shell-nav', 'ui:sheet'), kind: 'block', summary: '좁은 화면 햄버거 메뉴', example: '모바일 햄버거' })
def('section:account-cart-links', '계정·장바구니 링크', { any: k('장바구니', '가방', '계정', '로그인'), covers: k('block:layout:account-bar', 'block:kind:account'), kind: 'block', summary: '계정·장바구니 머리글 줄', example: '계정 장바구니 링크' })
def('section:trust-badges', '신뢰·보증 배지', { any: k('신뢰', '보증', '만족 보장', '인증 배지', '수상 배지'), covers: k('block:kind:trust'), kind: 'block', summary: '신뢰 배지 줄 블록(보증·인증 표시)', example: '신뢰 아이콘 3개' })
def('section:countdown-timer', '카운트다운 띠', { any: k('카운트다운'), covers: k('block:layout:countdown-band-split'), kind: 'block', summary: '카운트다운 띠(실제 종료 시각에 묶인 것만)', example: '할인 카운트다운 띠' })
def('section:popup-modal', '팝업·모달', { fields: SI, any: k('팝업', '모달'), covers: k('ui:dialog', 'block:layout:exit-intent-dialog'), kind: 'rule', summary: '첫 화면을 가리는 팝업의 지연·닫기 기준', example: '쿠폰 팝업' })
def('section:faq', '자주 묻는 질문', { any: k('faq', '자주 묻는'), covers: k('block:kind:faq'), kind: 'block', summary: 'FAQ 블록(자주 묻는 질문 목록)', example: '자주 묻는 질문' })
def('section:pricing-table', '요금표', { any: k('요금', '플랜', '가격표'), covers: k('block:kind:pricing'), kind: 'block', summary: '요금표 블록(플랜 가격 비교)', example: '요금 플랜 표' })
def('section:reviews-ratings', '후기·평점', { any: k('후기', '리뷰', '평점'), covers: k('block:kind:review-list', 'block:kind:social-proof'), kind: 'block', summary: '후기 블록(평점과 고객 후기)', example: '고객 후기' })
def('section:logo-wall', '고객·파트너 로고 줄', { any: k('고객 로고', '파트너 로고', '로고 줄', '로고 띠', '로고 월', '로고 벽'), covers: k('block:variant:social-proof/logo-rail'), kind: 'block', summary: '로고 줄 블록(고객·파트너 로고 한 줄)', example: '고객 로고 줄' })
def('section:kpi-charts', '지표 카드·차트', { any: k('차트', '막대', '가동률', 'kpi', '지표 카드'), covers: k('block:kind:dashboard-panel', 'ui:chart'), kind: 'block', summary: '지표·차트 패널 블록', example: '12개월 막대 차트' })
def('section:location-hours', '위치·영업시간', { any: k('지도', '영업시간', '오시는', '매장 찾기'), covers: k('block:kind:hours-location'), kind: 'block', summary: '위치·영업시간 블록', example: '오시는 길 지도' })
def('section:sticky-buy-bar', '하단에 붙는 구매·행동 줄', { any: k('하단 고정', '고정 구매', '고정 줄', '플로팅 구매'), covers: k('block:layout:sticky-action-bar', 'block:layout:fixed-bottom-strip'), kind: 'block', summary: '하단 고정 행동 줄', example: '하단 고정 구매 줄' })
def('section:app-sidebar', '앱형 사이드바', { any: k('사이드바'), covers: k('ui:sidebar'), kind: 'block', summary: '앱 사이드바 부품', example: '사이드바' })
def('section:footer-sitemap', '푸터·사이트맵', { any: k('푸터', '사이트맵', '하단 링크'), covers: k('block:kind:footer'), kind: 'block', summary: '푸터 블록(사이트맵·법정 링크 줄)', example: '푸터' })
def('section:news-list', '소식·뉴스 목록', { any: k('뉴스', '소식', '보도', '공지 목록', '블로그'), covers: k('block:variant:content/list'), kind: 'block', summary: '날짜 붙은 목록 블록', example: '소식 목록' })
def('section:accessibility-widget', '접근성 설정 플로팅 단추', { fields: SI, any: k('접근성 메뉴', '접근성 플로팅', '접근성 버튼', '접근성 아이콘'), kind: 'block', summary: '접근성 설정(글자 크기·대비) 플로팅 위젯 — 켜짐 상태 저장·첫 화면 가림 기준 필수', example: '접근성 메뉴 아이콘' })
def('section:scroll-progress', '스크롤 진행 표시', { fields: SI, any: k('스크롤 진행', '진행 표시', '스크롤 표시'), near: k('ui:progress'), kind: 'motion', summary: '스크롤 진행 표시줄 — 움직임 줄이기에서는 정지 표시', example: '오른쪽 스크롤 진행 표시' })
def('section:steps-process', '단계·절차 안내', { any: k('단계 안내', '3단계', '절차', '순서 안내'), covers: k('block:layout:numbered-steps', 'block:layout:stepper'), kind: 'block', summary: '단계 안내 블록', example: '구매 후 3단계 안내' })
def('section:comparison', '비교 표', { any: k('비교'), covers: k('block:layout:compare-table'), kind: 'block', summary: '비교 표 블록(항목별 비교 표)', example: '플랜 비교 표' })
def('section:tabs-panels', '탭 패널', { fields: SI, any: k('탭으로', '탭 패널', '탭 목록', '탭 메뉴', '탭 전환', '탭 3', '탭 4', '탭 5', '탭 6', '탭 7', '탭 8', '탭과', '탭이'), covers: k('ui:tabs'), kind: 'block', summary: '탭 패널 부품(탭별 내용 전환)', example: '교정 탭 패널' })
def('section:quick-menu-rail', '화면 가장자리에 고정된 퀵 메뉴', { fields: SI, any: k('퀵 메뉴', '퀵바', '오른쪽 고정', '우측 고정', '맨 위로', '우측 퀵', '왼쪽 퀵', '고정 원형'), kind: 'block', summary: '가장자리 고정 퀵 메뉴(전화·상담·맨 위로) — 첫 화면 가림과 초점 가림(WCAG 2.4.11) 기준 필수', example: '오른쪽 고정 퀵 메뉴' })
def('section:notice-ticker', '공지가 한 줄씩 돌아가는 띠', { fields: SI, any: k('롤링', '속보 띠', '티커'), near: k('block:kind:announcement'), kind: 'block', summary: '공지 롤링 줄 변형 — 일시정지 단추와 동작 줄이기 정지 필수', example: '공지사항 롤링 줄' })
def('section:mascot-character', '마스코트·캐릭터', { fields: SI, any: k('마스코트', '캐릭터'), kind: 'block', summary: '마스코트·캐릭터 칸(출처 생성 가능 칸) — 상표·저작권 확인 문구 필수', example: '챗봇 마스코트' })
def('section:bottom-tab-bar', '화면 아래 탭 바', { any: k('하단 탭', '탭바', '하단 내비', '하단 메뉴'), covers: k('block:kind:bottom-tab'), kind: 'block', summary: '하단 탭 바 블록', example: '모바일 하단 탭바' })
def('section:product-grid', '상품 카드 격자', { any: k('상품 카드', '상품 격자', '타일 그리드', '카드 격자', '사진 타일'), covers: k('block:kind:product-list'), kind: 'block', summary: '상품 목록 블록', example: '상품 카드 격자' })

// ── 상호작용 ───────────────────────────────────────────────────────────────
def('interaction:carousel-controls', '캐러셀 이전·다음·정지 조작', { any: k('캐러셀', '슬라이드 점', '이전·다음', '좌우 화살표', '일시정지', '인디케이터'), covers: k('ui:carousel'), kind: 'block', summary: '캐러셀 조작(정지 단추 포함)', example: '캐러셀 좌우 화살표' })
def('interaction:theme-toggle', '다크·라이트 테마 전환', { any: k('다크 모드', '테마 전환', '라이트 모드', '다크·'), covers: k('ui:switch', 'ui:toggle'), kind: 'block', summary: '테마 전환 단추(선택 저장, 첫 칠 전에 적용)', example: '다크 모드 전환' })
def('interaction:scroll-hint', '아래로 내려가라는 작은 신호', { fields: SI, any: k('스크롤 안내', '스크롤 유도', '아래로 이동 화살표', '아래 화살표', '스크롤 힌트'), kind: 'motion', summary: '첫 화면 스크롤 신호(작은 화살표·선) — 반복 애니메이션은 5초 정지 규칙', example: '스크롤 안내 화살표' })
def('interaction:skip-intro', '도입 연출 건너뛰기', { fields: ['sections', 'interaction', 'cta'], any: k('skip', '건너뛰기'), kind: 'rule', summary: '도입·프리로더 연출에는 건너뛰기 단추를 둔다(관문 후보)', example: '도입 중 Skip 버튼' })
def('interaction:sound-toggle', '소리 켜기·끄기', { any: k('소리 켜', '소리 끄', '음소거', '사운드'), kind: 'block', summary: '영상 히어로의 소리 켜기 단추 — 기본 음소거', example: '소리 켜기 버튼' })
def('interaction:filter-sort', '필터·정렬', { any: k('필터', '정렬'), covers: k('block:layout:bars-filter-list', 'block:layout:toolbar-table-pager'), kind: 'block', summary: '필터·정렬 줄(목록 위 조작 줄)', example: '필터와 정렬' })
def('interaction:option-picker', '색상·사이즈 고르기', { any: k('스와치', '사이즈', '색상 선택', '옵션 선택', '색상 썸네일'), covers: k('block:kind:product-info'), kind: 'block', summary: '옵션 고르기(상품 정보 블록)', example: '색상 스와치와 사이즈' })
def('interaction:cursor-effect', '커서 연출', { any: k('커서'), near: k('card:custom-cursor-morph'), kind: 'motion', summary: '커서 연출 — 터치·동작 줄이기에서는 끈다', example: '커서가 모양을 바꾼다' })
def('interaction:export-copy', '내보내기·복사', { any: k('내보내기', 'csv', '복사'), near: k('block:layout:select-column-action-bar'), kind: 'block', summary: '내보내기·복사 단추', example: '복사·CSV 내보내기' })
def('interaction:dismiss-for-today', '오늘 하루 보지 않기', { any: k('오늘 하루', '오늘 열지'), near: k('block:variant:announcement/dismissible-inline', 'block:layout:exit-intent-dialog'), kind: 'block', summary: '「오늘 하루 보지 않기」 닫기 선택(팝업 블록의 선택 칸)', example: '오늘 하루 보지 않기' })
def('interaction:quiz', '퀴즈형 안내', { any: k('퀴즈'), kind: 'block', summary: '퀴즈형 추천 블록 — 수요가 작으면 보류', example: '커피 퀴즈 버튼' })
def('interaction:map-markers', '지도 마커 조작', { any: k('마커', '지도 위'), near: k('block:kind:hours-location'), kind: 'block', summary: '지도 마커 조작(위치 블록의 선택 칸)', example: '지도 마커 클릭' })
def('interaction:hover-preview', '가리키면 미리보기', { any: k('호버 미리보기', '미리보기 카드', '선택 미리보기', '호버 상세', '이미지 트레일'), near: k('card:hover-image-trail'), kind: 'motion', summary: '가리키면 열리는 미리보기(터치에서는 탭으로 대체)', example: '목록 선택 미리보기' })

// ── CTA ────────────────────────────────────────────────────────────────────
def('cta:single-primary', '주 버튼 하나', { any: k('주 버튼', '단일', '하나'), none: k('없음'), covers: k('block:kind:final-cta', 'block:layout:cta-underline-guarantee'), kind: 'block', summary: '단일 주 버튼 마무리 띠', example: '주 버튼 하나' })
def('cta:pill-button', '알약 모양 버튼', { any: k('알약'), covers: k('axis:button:b4'), kind: 'recipe', summary: '알약 단추 축 값을 쓰는 레시피', example: '알약 버튼' })
def('cta:outline-button', '외곽선 버튼', { any: k('외곽선', '윤곽'), covers: k('ui:button'), kind: 'doc', summary: '외곽선 단추(부품에 있음)', example: '외곽선 버튼' })
def('cta:none-first-screen', '첫 화면에 행동 버튼 없음', { any: k('cta 없음', '버튼 없이', '행동 버튼 없', '버튼 없음'), covers: k('block:variant:hero/identity-strip-banner', 'block:variant:hero/crosshair-quadrants'), kind: 'rule', summary: '정보 먼저 첫 화면(버튼 없음)은 공공·브랜드 원형 허용 — 규칙에 한 줄', example: 'CTA 없음, 메뉴 링크 2개' })
def('cta:repeat-in-nav', '머리글에도 반복되는 행동 버튼', { any: k('내비에도', '내비의', '우상단', '상단 우측', '헤더에도', '상단 반복', '반복'), covers: k('ui:site-shell'), kind: 'doc', summary: 'SiteShell 머리글 행동 칸', example: '내비에도 가입 반복' })
def('cta:primary-secondary-pair', '주 버튼 + 보조 버튼 한 쌍', { any: k('보조', '외곽선 보조', '두 버튼', '버튼 둘', '주 버튼과'), covers: k('block:kind:final-cta'), kind: 'block', summary: '주·보조 버튼 쌍', example: '주 버튼과 윤곽 보조 버튼' })
def('cta:phone-booking', '전화·예약 버튼', { any: k('전화', '통화', '예약'), covers: k('block:layout:split-booking-bar', 'block:kind:contact-form'), kind: 'block', summary: '전화·예약 행동 줄(통화 바로 연결)', example: '통화 예약 버튼' })
def('cta:sticky-floating', '고정·플로팅 행동 버튼', { any: k('고정', '플로팅'), covers: k('block:layout:sticky-action-bar'), kind: 'block', summary: '화면 아래 고정 행동 줄(구매·예약)', example: '하단 고정 버튼' })
def('cta:free-start', '무료 시작·가입 버튼', { any: k('무료 시작', '무료 가입', '무료 체험', '무료로'), covers: k('block:kind:final-cta'), kind: 'block', summary: '무료 시작 마무리 띠', example: '상단 무료 시작' })
def('cta:app-download', '앱·파일 받기(다운로드) 버튼', { any: k('앱 받기', '앱스토어', '다운로드', '설치 버튼', '크롬 추가'), kind: 'block', summary: '앱 스토어·확장 설치 배지형 행동 버튼 — 스토어 상표 사용 규칙을 먼저 확인', example: '앱스토어 버튼' })
def('cta:demo-request', '데모 요청', { any: k('데모'), covers: k('block:kind:contact-form', 'block:kind:lead-capture'), kind: 'block', summary: '데모 요청 폼(이름·메일 최소 칸)', example: '데모 요청 버튼' })
def('cta:add-to-cart', '장바구니 담기', { any: k('add to cart', '장바구니'), covers: k('block:layout:spec-purchase', 'block:kind:product-info'), kind: 'block', summary: '장바구니 담기 칸(상품 정보 블록)', example: '장바구니 버튼' })
def('cta:text-link-only', '글자 링크만 있는 행동', { any: k('텍스트 링크', '링크만', '밑줄'), covers: k('block:layout:inline-links', 'block:layout:quiet-link-row'), kind: 'block', summary: '글자 링크 줄(버튼 없이 링크만)', example: '텍스트 링크만' })

// ── 모션: 등장 ─────────────────────────────────────────────────────────────
def('entrance:preloader-intro', '프리로더·도입 장면', { any: k('로딩', '프리로더', '퍼센트'), none: k('로딩 없이'), kind: 'motion', summary: '첫 방문 도입(프리로더) 장면 — 1.2초 이내·건너뛰기·LCP 비차단·동작 줄이기 정지', example: '로딩 퍼센트가 뜬 뒤 본 화면' })
def('entrance:fade-in', '서서히 나타남', { any: k('페이드', '서서히 나타'), covers: k('block:motion:rise', 'motion:ease:out'), kind: 'motion', summary: '페이드 등장(키트 기본)', example: '약 0.5초에 페이드인' })
def('entrance:blur-to-sharp', '흐림에서 선명으로', { any: k('흐릿', '블러', '선명해'), near: k('motion:tech:whip'), kind: 'motion', summary: '흐림 → 선명 등장 도우미 — 휩 팬의 흐림 값을 재사용, 글은 숨기지 않는다', example: '흐릿한 제목이 선명해짐' })
def('entrance:typed-text', '글자가 타자 치듯 나타남', { any: k('타자', '타이핑', '글자 섞임', '디코드', '스크램블'), covers: k('block:variant:hero/crop-marks-typed-title'), near: k('card:text-scramble'), kind: 'motion', summary: '타자·스크램블 글자 등장', example: '타자 치듯 헤드라인 완성' })
def('entrance:word-stagger', '낱말·요소가 차례로 나타남', { any: k('어절', '낱말', '차례로', '순서대로', '순으로', '간격으로'), covers: k('block:motion:stagger-in', 'motion:tech:stagger', 'block:motion:split-text'), kind: 'motion', summary: '순차 등장(키트 stagger)', example: '어절이 순서대로 나타남' })
def('entrance:rise-from-below', '아래에서 올라옴', { any: k('아래서 올라', '아래에서 올라', '밑에서 올라', '올라옴', '올라온다'), covers: k('block:motion:rise'), kind: 'motion', summary: '아래에서 올라오는 등장(키트 rise)', example: '카드가 아래서 올라옴' })
def('entrance:popup-after-delay', '시간이 지나 뜨는 팝업·쿠키 상자', { any: k('팝업', '쿠키 상자', '모달', '쿠키 패널', '쿠키 카드'), covers: k('ui:dialog', 'block:kind:consent'), kind: 'rule', summary: '지연 팝업은 첫 화면 가림 기준 안에서만', example: '약 1.5초에 쿠키 패널이 올라옴' })
def('entrance:mask-reveal', '가림막이 열리며 드러남', { any: k('가림막', '마스크', '열리고', '열림', '펼쳐'), covers: k('block:motion:clip-reveal'), kind: 'motion', summary: '마스크 리빌(키트 clip-reveal)', example: '가림막이 열리며 장면이 드러남' })
def('entrance:scale-up-intro', '작은 것이 커지며 등장', { any: k('커지고', '커지며', '확대되'), covers: k('block:motion:punch-in'), kind: 'motion', summary: '확대 등장(키트 punch-in)', example: '점이 커지며 원이 됨' })
def('entrance:video-fade-in', '영상이 서서히 드러남', { any: k('영상이 페이드', '영상이 나타', '영상이 서서히', '영상 자리'), covers: k('block:media:video'), kind: 'block', summary: '영상 포스터 → 영상 전환', example: '영상이 페이드인됨' })

// ── 모션: 스크롤 ───────────────────────────────────────────────────────────
def('scroll:parallax-depth', '시차·깊이 스크롤', { any: k('시차', '패럴랙스', '깊이', '겹겹'), covers: k('block:motion:parallax', 'block:motion:pointer-depth'), kind: 'motion', summary: '패럴랙스(키트 parallax)', example: '배경이 시차로 움직임' })
def('scroll:pin-scrub', '고정하고 스크롤로 진행', { any: k('고정된 채', '스크럽', '스크롤 연동', '카메라 연출', '스크롤에 따라'), covers: k('block:motion:scrub-timeline'), kind: 'motion', summary: '스크롤 스크럽 타임라인(키트 scrub-timeline)', example: '스크롤 연동 카메라 연출' })
def('scroll:sticky-stack', '카드가 겹쳐 쌓임', { any: k('겹쳐 쌓', '쌓이', '스택', '덮고 올라', '덮으며'), covers: k('block:motion:sticky-stack'), kind: 'motion', summary: '스티키 스택(키트 sticky-stack)', example: '카드가 겹쳐 쌓임' })
def('scroll:header-shrink', '스크롤하면 줄어드는 머리글', { any: k('헤더가 한 줄', '헤더가 줄', '헤더가 작아', '헤더 축소', '내비가 줄', '헤더가 접'), kind: 'recipe', summary: '스크롤 시 줄어드는 머리글 — 헤더 축(H)의 새 값 후보, 고정 높이 기준 유지', example: '스크롤하면 헤더가 한 줄로 줄어듦' })
def('scroll:marquee-flow', '끊임없이 흐르는 띠', { any: k('흘러감', '흘러가', '끊임없이', '마키', '무한 반복', '띠가 흐'), near: k('card:marquee-strip'), kind: 'motion', summary: '마키 띠 — 5초 넘는 반복은 정지 단추(loop-pause) 필수', example: '로고 줄이 끊임없이 흘러감' })
def('scroll:horizontal-scroll', '가로로 스크롤되는 구획', { any: k('가로로 스크롤', '가로 스크롤', '옆으로 스크롤', '가로 이동'), near: k('card:horizontal-scroll'), kind: 'motion', summary: '가로 스크롤 구획 기법 — 키보드·터치 대안과 동작 줄이기 세로 배치 필수', example: '가로 스크롤 갤러리' })
def('scroll:bg-theme-shift', '구획마다 배경색이 바뀜', { any: k('바탕과 로고', '바탕이', '배경이 어두', '배경색', '색이 바뀌', '배경 색'), kind: 'motion', summary: '스크롤 구획별 배경색 전환 — 대비 기준을 구획마다 지킨다', example: '스크롤하면 바탕과 로고 색이 바뀜' })
def('scroll:scene-swap-3d', '스크롤로 바뀌는 3D 장면', { any: k('3d가', '3d 오브젝트', '원반', '터널', '배경 3d'), near: k('style:3d-lite'), kind: 'motion', summary: '스크롤 연동 3D 장면 — 모바일 정지 대체와 모션 예산 필수', example: '스크롤하면 배경 3D가 터널로 바뀜' })
def('scroll:section-reveal', '구획이 스크롤에 따라 드러남', { any: k('올라옴', '올라오고', '올라온다', '나타남', '차례로', '아래에서'), covers: k('block:motion:rise', 'block:motion:play-on-view', 'block:motion:stagger-in'), kind: 'motion', summary: '구획 등장(키트 rise·play-on-view)', example: '스크롤하면 제목이 아래에서 올라옴' })
def('scroll:count-up', '숫자가 올라감', { any: k('숫자가 올라', '카운트'), covers: k('block:motion:count-up'), kind: 'motion', summary: '숫자 올라가기(키트 count-up)', example: '숫자가 올라감' })
def('scroll:snap-sections', '한 화면씩 끊어 넘김', { any: k('한 화면씩', '풀페이지', '스냅'), kind: 'motion', summary: '구획 스냅 스크롤 — 키보드·보조기술 이동과 충돌하지 않는 기준 먼저', example: '한 화면씩 스냅' })
def('scroll:smooth-inertia', '관성 스무스 스크롤', { any: k('관성', '부드럽게 스크롤', '스무스'), near: k('card:smooth-scroll-inertia'), kind: 'motion', summary: '관성 스크롤 — 기본 끔, 동작 줄이기에서 끈다', example: '관성 스무스 스크롤' })

// ── 모션: 호버 ─────────────────────────────────────────────────────────────
def('hover:fill-wipe', '채워지는 호버', { any: k('채워', '차오르', '면으로', '반전'), covers: k('ui:button'), kind: 'doc', summary: '단추 호버 채움(부품 훅)', example: '닿으면 알약이 면으로 채워짐' })
def('hover:preview-follow', '따라다니는 미리보기', { any: k('미리보기', '따라다', '트레일'), near: k('card:hover-image-trail'), kind: 'motion', summary: '호버 이미지 트레일·미리보기 — 터치에서는 정지 그림', example: '프로젝트 화면 미리보기가 열림' })
def('hover:glow-edge', '빛나는 테두리', { any: k('빛나', '무지개', '글로우', '발광'), kind: 'rule', summary: '빛나는 테두리 호버 — 스타일 사전에서 neon-glow 가 금지라 쓰지 않는다는 규칙 한 줄(수요가 크면 재검토)', example: '무지개 테두리가 빛남' })
def('hover:magnetic-pull', '끌려오는 단추', { any: k('자석', '끌려', '마그네틱'), covers: k('block:motion:magnetic-cta'), kind: 'motion', summary: '마그네틱 CTA(키트 magnetic-cta)', example: '단추가 커서에 끌려옴' })
def('hover:color-shift', '색이 바뀌는 호버', { any: k('색이 바뀜', '밑줄', '초록으로', '색이'), covers: k('ui:button'), kind: 'doc', summary: '색 바뀜 호버(부품 훅)', example: '메뉴에 올리면 색이 바뀜' })
def('hover:image-zoom', '사진 확대 호버', { any: k('확대', '줌인'), near: k('block:motion:ken-burns'), kind: 'motion', summary: '호버 사진 확대 — 켄 번스 수치 재사용', example: '사진이 천천히 확대됨' })
def('hover:submenu-open', '하위 메뉴가 열림', { any: k('하위 메뉴', '드롭다운', '메뉴에 올리'), covers: k('ui:navigation-menu', 'ui:dropdown-menu'), kind: 'doc', summary: '하위 메뉴(부품)', example: '상단 메뉴에 올리면 하위 메뉴가 열림' })

// ── 모션: 전환 ─────────────────────────────────────────────────────────────
def('transition:video-montage-cut', '여러 영상이 컷으로 바뀜', { any: k('하드컷', '컷 전환', '컷으로', '영상이 바뀜', '클립이', '컷이 바뀌'), near: k('block:media:video'), kind: 'block', summary: '여러 클립이 컷으로 이어지는 히어로 영상 — 클립 합 3MB 예산 안, 첫 클립이 포스터', example: '영상이 1초마다 하드컷으로 바뀜' })
def('transition:crossfade-slides', '사진·슬라이드가 서로 녹아듦', { any: k('크로스페이드', '슬라이드가', '사진으로', '사진이 바뀜', '배경 사진', '교체'), covers: k('block:layout:ken-burns-stills', 'block:motion:ken-burns'), kind: 'block', summary: '크로스페이드 슬라이드(켄 번스 변형)', example: '배경 사진이 약 5초에 다른 사진으로 바뀜' })
def('transition:auto-advance', '정해진 간격으로 다음으로 넘어감', { any: k('마다', '넘어감', '넘어가', '다음 슬라이드'), covers: k('ui:carousel'), kind: 'block', summary: '자동 넘김 캐러셀(정지 단추 포함)', example: '약 3초 간격으로 다음 슬라이드로 넘어감' })
def('transition:bg-color-cycle', '배경색이 순서대로 바뀜', { any: k('배경 색이', '배경색이', '바탕 색', '색이 순'), kind: 'motion', summary: '배경색 순환 장면 — 순환 주기 3초 이상·깜빡임 기준 안', example: '배경 색이 약 2초마다 바뀜' })
def('transition:object-swap-3d', '3D 오브젝트가 바뀜', { any: k('3d', '오브젝트'), near: k('style:3d-lite'), kind: 'motion', summary: '3D 오브젝트 교체 장면 — 정지 대체 필수', example: '3D 오브젝트가 교체됨' })
def('transition:text-swap', '문구가 바뀜', { any: k('문구가', '제목도 함께', '자막이', '문구 바뀜'), covers: k('block:motion:whip-in', 'block:motion:kinetic-type'), kind: 'motion', summary: '문구 교체(키트 whip-in·kinetic-type)', example: '슬라이드마다 문구가 바뀜' })
def('transition:page-transition', '쪽 전환', { any: k('페이지 전환', '뷰 전환'), covers: k('recipe:dynamics:view-transition', 'block:motion:view-transition'), kind: 'motion', summary: '쪽 전환(view-transition 기법)', example: '페이지 전환이 부드럽다' })
def('transition:shape-morph', '모양이 갈라지고 합쳐짐', { any: k('갈라', '합쳐', '모양이 바뀌', '원으로', '반원'), near: k('card:custom-cursor-morph'), kind: 'motion', summary: '모양 변형 장면 — SVG 변형, 동작 줄이기 정지 프레임', example: '반원으로 갈라졌다 합쳐짐' })
def('transition:card-slide', '카드가 한 칸씩 밀림', { any: k('한 칸씩', '밀려'), covers: k('ui:carousel'), kind: 'block', summary: '한 칸씩 밀리는 카드 줄', example: '카드가 한 칸씩 밀려 들어옴' })

// ── 색 논리 K1~K9 (카드의 colorLogic 값과 같을 때) ─────────────────────────
for (const [key, label] of Object.entries(COLOR_LABEL)) {
  const [kind, summary] = COLOR_PROPOSAL[key]
  const low = key.toLowerCase()
  RAW.push({
    id: `color:${low}`, dim: 'color', label: `색 논리 ${key} ${label}`, fields: ['color'],
    match: { any: [], all: [], none: [], equals: low },
    covers: [`recipe:color:${low}`], near: [`style:color:${low}`],
    proposal: { kind, summary }, example: key,
  })
}

export const PATTERNS = Object.freeze(RAW.map((p) => Object.freeze(p)))
const BY_ID = new Map(PATTERNS.map((p) => [p.id, p]))
export const patternById = (id) => BY_ID.get(id)

const FIELD_OF_MOTION = ['entrance', 'scroll', 'hover', 'transition']

/** 카드 → 칸별 정규화 문자열. 카드가 어떤 모양이든 던지지 않는다. */
export function cardView(card) {
  const c = card ?? {}
  const m = c.motion ?? {}
  const out = {
    hero: normalizeText(c.structure?.hero),
    sections: normalizeText(c.structure?.sections),
    interaction: normalizeText(c.interaction),
    cta: normalizeText(c.cta?.pattern),
    color: normalizeText(c.colorLogic),
  }
  for (const f of FIELD_OF_MOTION) out[f] = normalizeText(m[f])
  return out
}

const has = (text, words) => words.some((w) => text.includes(w))

function matches(p, view) {
  const text = p.fields.map((f) => view[f]).join(' ')
  const m = p.match
  if (m.equals !== undefined) return view.color === m.equals
  if (!text) return false
  if (m.any.length > 0 && !has(text, m.any)) return false
  if (!m.all.every((g) => has(text, g))) return false
  if (has(text, m.none)) return false
  return true
}

/** 카드 → 패턴 id 목록(정렬·중복 없음). */
export function extractPatterns(card) {
  const view = cardView(card)
  return PATTERNS.filter((p) => matches(p, view)).map((p) => p.id).sort()
}

/** 모양이 안 맞는 카드: 적합도 0.5 미만 · 자기 원형이 fit.archetypes 에 없음 · fit 없음. */
export function isMisfit(card) {
  const fit = card?.fit
  if (!fit || typeof fit.score !== 'number' || !Array.isArray(fit.archetypes)) return true
  return fit.score < 0.5 || !fit.archetypes.includes(card.archetype)
}
