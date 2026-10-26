// launch-factory: 예약 안내의 다른 통로 — 전화번호로 예약한 사람에게 알림톡(없으면 문자)을 보낸다. feature-booking 의 같은 이름 파일(통로 없음)을 이 항목이 대신한다.
// 이메일로 예약한 사람은 메일이 이미 간다. 모두 안내용(정보성)이다 — 광고 문구를 섞지 않는다. 실패해도 예약은 그대로고, 서비스가 onError 로 알린다.
import type { BookingNotifier, BookingNoticeKind } from "@launch-factory/booking"
import { BOOKING_CONFIG } from "@/lib/launch/booking-config"
import { appUrl } from "@/lib/launch/config"
import { notifyKr, notifyKrEnabled } from "@/lib/launch/notify-kr"

const TEMPLATE: Record<BookingNoticeKind, string> = { received: "bookingRequested", confirmed: "bookingConfirmed", cancelled: "bookingCancelled", reminder: "bookingReminder" }

function whenText(startsAt: Date, locale: "ko" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", { timeZone: BOOKING_CONFIG.timeZone, dateStyle: "medium", timeStyle: "short" }).format(startsAt)
}

export const bookingNotifier: BookingNotifier = async ({ kind, booking, locale }) => {
  if (booking.contactKind !== "phone" || !notifyKrEnabled()) return
  const service = BOOKING_CONFIG.services.find((s) => s.id === booking.service)
  const result = await (await notifyKr()).send({
    to: booking.contact,
    template: TEMPLATE[kind],
    purpose: "transactional",
    idempotencyKey: `booking:${booking.id}:${kind}`,
    locale,
    vars: {
      ...(booking.name ? { name: booking.name } : {}),
      service: service?.name[locale] ?? booking.service,
      when: whenText(booking.startsAt, locale),
      reference: booking.reference,
      manageUrl: `${appUrl()}/book/manage`,
    },
  })
  // 보내지 못한 이유는 던져서 서비스가 onError 로 알리게 한다(중복·건너뜀은 정상이다)
  if (!result.ok && result.status === "failed") throw new Error(`notify-kr ${kind}: ${result.reason}`)
}
