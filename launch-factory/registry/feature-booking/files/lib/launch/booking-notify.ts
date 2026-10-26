// launch-factory: 예약 안내의 다른 통로(카카오 알림톡·문자). 기본은 없음 — 예약 확인·취소·알림은 메일로만 간다.
// feature-notify-kr 를 설치하면 이 파일을 그 항목의 것(알림톡·문자 통로)이 대신한다.
import type { BookingNotifier } from "@launch-factory/booking"

export const bookingNotifier: BookingNotifier | undefined = undefined
