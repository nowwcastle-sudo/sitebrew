import { loadBookingSlots, submitBooking } from "@/app/actions/booking"
import { BookingForm } from "@/components/product/booking-form"
import { bookCopy as copy } from "@/content/copy.ux.en"
import { bookingConfig, bookingEnabled, bookingServiceViews } from "@/lib/launch/booking"
import { turnstileSiteKey } from "@/lib/site-keys"

export const metadata = { title: "Book a time" }

// 예약 쪽: 서비스 → 날짜·시간 → 연락처 → 예약 번호. 로그인 없이 쓴다(공개 쪽). 영업시간·서비스·마감은 lib/launch/booking-config.ts 데이터가 정한다.
// 운영자 메일(BOOKING_OWNER_EMAIL)이 없으면 예약 접수만 꺼진다: 폼 대신 안내 한 줄을 그리고 서버 액션도 접수하지 않는다. 이미 받은 예약의 조회·취소(/book/manage)는 그대로 된다.
// data-booking 표지는 문의 쪽의 data-inquiry 와 같은 자리에 같은 뜻으로 둔다(disabled 면 배포 확인이 경고를 낼 수 있다). 봇 확인 위젯의 사이트 키는 서버가 읽어 넘긴다(live 에서만 있다).
export default function BookPage() {
  const enabled = bookingEnabled()
  const services = bookingServiceViews()
  return (
    <div data-booking={enabled ? "enabled" : "disabled"} className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <h1 id="book-title" className="font-heading text-2xl">
        {copy.title}
      </h1>
      {enabled ? (
        <>
          <p className="text-base leading-[1.7]">{copy.lead}</p>
          <BookingForm submit={submitBooking} load={loadBookingSlots} services={services} timeZone={bookingConfig.timeZone} turnstileSiteKey={turnstileSiteKey()} />
        </>
      ) : (
        <p data-testid="book-unavailable" className="text-base leading-[1.7]">
          {copy.unavailable}
        </p>
      )}
      <p className="text-base leading-[1.7]">
        {copy.manage.text}{" "}
        <a href="/book/manage" className="relative inline-flex min-h-11 items-center underline underline-offset-4">
          {copy.manage.label}
        </a>
      </p>
    </div>
  )
}
