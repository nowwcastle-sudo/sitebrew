import { checkoutEmailCopy as copy } from "@/content/copy.ux.en"

// 결제 화면(/upgrade) 위에서 영수증·청구 메일이 갈 주소를 보인다(A11 — 결제 직전). 서버 컴포넌트다: 서버가 읽은 세션의 주소를 그대로 보인다(가리지 않는다 — 본인 주소다).
// 확인 안 된 주소(`verified === false`)면 그 사실과 확인·고치기 길을 더한다 — 오타 주소로 영수증이 가는 것을 결제 전에 알아채게. 결제는 막지 않는다(운영자 결정 2026-10-07).
export function CheckoutEmailNote({ email, verified }: { email: string; verified?: boolean }) {
  const [before, after] = copy.line.split("{email}")
  return (
    <div data-checkout-email="" className="mx-auto mb-6 flex w-full max-w-2xl flex-col items-start gap-2 border px-4 py-3 md:px-6">
      <p className="text-base leading-[1.6]">
        {before}
        <strong data-address="">{email}</strong>
        {after}
      </p>
      {verified === false ? (
        <>
          <p data-unverified="" className="text-base leading-[1.6]">
            {copy.unverified}
          </p>
          <div className="flex flex-wrap gap-x-6">
            <a href={copy.confirm.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
              {copy.confirm.label}
            </a>
            <a href={copy.fix.href} className="relative inline-flex min-h-11 items-center text-base underline underline-offset-4">
              {copy.fix.label}
            </a>
          </div>
        </>
      ) : null}
    </div>
  )
}
