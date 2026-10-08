// launch-factory: 인증의 선택 조각 스위치. 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
// admin 은 twoFactor 가 필요하다(관리자는 2단계 인증을 켠 사람뿐이다). 둘 다 꺼져 있으면 관리자 경로는 열리지 않는다(feature-admin 이 이유를 알린다).
export const AUTH_FEATURES: { twoFactor: boolean; admin: boolean } = { twoFactor: false, admin: false }
