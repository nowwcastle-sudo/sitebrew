// launch-factory: 예약 설정(계획 3b). 이 파일은 제품 것이다 — 레지스트리를 다시 받으면 덮어쓸지 묻는다.
// 영업시간·서비스·수용량·취소 마감은 코드가 아니라 이 데이터가 정한다. 모양은 @launch-factory/booking 의 BookingConfigSchema 가 켤 때 검사한다(틀리면 시작 때 던진다).
// 아래 값은 견본이다 — 제품의 서비스·시간으로 바꾼다. 서비스 하나 = id · 이름(ko·en) · 걸리는 시간 · 같은 시간에 받을 수 있는 수(capacity) · 한 예약 최대 인원.
import { bookingDepositEnabled } from "@/lib/launch/booking-deposit"

export const BOOKING_CONFIG = {
  /** IANA 시간대. 영업시간·휴무일·슬롯 날짜는 이 시간대의 달력으로 읽는다 */
  timeZone: "Asia/Seoul",
  /** "instant": 접수하면 바로 확정 · "request": 운영자이 확인(confirm)한 뒤 확정 */
  mode: "instant",
  services: [
    { id: "consultation", name: { ko: "상담", en: "Consultation" }, durationMin: 60, capacity: 1, partyMax: 1 },
    // 견본 — **mock 미리보기에서, 예약금 연결(feature-booking-deposit)이 있을 때만** 보이는 예약금 서비스(한 바퀴 시험이 결제 단계를 돈다). live 에는 나오지 않는다: 견본 서비스가 실제 결제를 일으키지 않게 한다.
    // 제품은 자기 서비스에 deposit(원)을 직접 적고 이 줄은 지운다.
    ...(process.env.LF_MODE === "mock" && bookingDepositEnabled() ? [{ id: "deposit-consultation", name: { ko: "우선 상담", en: "Priority consultation" }, durationMin: 60, capacity: 1, partyMax: 1, deposit: 10000 }] : []),
  ],
  /** 요일별 영업 구간 [시작, 끝]("HH:MM"). 없는 요일은 쉰다 */
  weekly: {
    mon: [["10:00", "18:00"]],
    tue: [["10:00", "18:00"]],
    wed: [["10:00", "18:00"]],
    thu: [["10:00", "18:00"]],
    fri: [["10:00", "18:00"]],
  },
  /** 휴무일("YYYY-MM-DD") */
  closedDates: [] as string[],
  /** 슬롯 간격(분) */
  slotStepMin: 30,
  /** 지금부터 이 시간(분) 안은 잡을 수 없다 */
  leadMinutes: 120,
  /** 오늘부터 며칠 앞까지 받는가 */
  horizonDays: 60,
  /** 시작 이 시간(분) 전까지만 예약한 사람이 직접 취소할 수 있다 */
  cancelBeforeMinutes: 120,
  /** 시작 이 시간(분) 전에 안내를 보낸다(0 이면 끔) */
  reminderBeforeMinutes: 1440,
  /** 예약 기록 보유 기간(일). 예약금 건은 서비스가 5년으로 늘린다 */
  retainDays: 365,
  // 예약금(선택). 서비스에 `deposit: 30000`(원, 정수)을 적으면 그 서비스는 접수 → 결제 대기 → 결제하면 확정이다. 0 이거나 없으면 예약금 없음.
  // 금액은 여기서만 정해진다 — 브라우저가 보낸 금액은 읽지 않는다. feature-booking-deposit(결제 중개)가 있어야 접수를 받는다.
  // 아래 규칙은 모두 선택이다(빠지면 기본값): 결제 대기 30분(결제 대기 예약도 자리를 차지한다) · 전액 환불은 취소 마감까지 · 마감 뒤 취소는 환불 없음 · 운영자가 취소하면 전액 환불(ownerCancelRefundPercent, 0~100).
  // depositPolicy: { holdMinutes: 30, fullRefundBeforeMinutes: 1440, laterRefundPercent: 50, ownerCancelRefundPercent: 100 },
}
