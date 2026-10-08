// 쿠키 설정 다시 열기 링크에 펼쳐 달 속성(공유 조각 block-shared-consent-open-attrs — REL11, launch-factory LFADA 발견).
// 일부러 "use client" 가 아니다: 서버 부품(footer/product-legal)이 값(상수)을 가져와 펼친다. "use client" 모듈에서 가져온 상수는 RSC 에서 값이 아니라
// 클라이언트 참조로 와서 펼쳐도 속성이 안 붙는다 — 서버 HTML 의 「쿠키 설정」 링크에 data-consent-open 이 없어 대화상자가 안 열렸다.
// 클릭을 듣고 쿠키 블록의 열기 함수를 부르는 브라우저 쪽 조각은 _shared/consent-open(useConsentOpener)에 그대로 있다.
/** 링크에 펼쳐 달 속성 — 서버 부품(푸터)이 쓴다. 클라이언트 조각이 없어도 href 가 동작한다 */
export const consentOpenAttrs = { "data-consent-open": "" } as const
