import { cancelBooking, lookupBooking } from "@/app/actions/booking"
import { BookingManage } from "@/components/product/booking-manage"
import { bookingManageCopy as copy } from "@/content/copy.ux.en"
import { bookingConfig } from "@/lib/launch/booking"
import { hasUrl } from "@/lib/launch/enabled"

export const metadata = { title: "Look up or cancel a booking", robots: { index: false } }

// 예약 조회·취소 쪽: 예약 번호 + 연락처로 내 예약을 보고, 마감 전이면 직접 취소한다. 로그인 없이 쓰는 공개 쪽이다.
// 예약 접수가 꺼져 있어도(bookingEnabled() false) 이 쪽은 그대로 된다 — 서버가 이미 받은 예약의 조회·취소를 허용한다. 꺼지는 것은 /book 뿐이다.
export default function BookingManagePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <h1 id="manage-title" className="font-heading text-2xl">
        {copy.title}
      </h1>
      <p className="text-base leading-[1.7]">{copy.lead}</p>
      <BookingManage lookup={lookupBooking} cancel={cancelBooking} timeZone={bookingConfig.timeZone} contactHref={hasUrl("/contact") ? "/contact" : undefined} />
    </div>
  )
}
