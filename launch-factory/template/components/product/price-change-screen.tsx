import Link from "next/link"
import { acceptPriceChange, cancel, session, subscription } from "@/app/actions/product"
import { RenewalConsentBlock } from "@/components/product/product-blocks"
import { SignInRequired } from "@/components/product/sign-in-required"
import { priceChangePageCopy as copy } from "@/content/copy.ux.en"

// 가격 변경 메일의 [동의]·[거절] 링크가 닿는 두 쪽의 공통 화면(F04). 두 쪽은 같은 블록(전후 가격·적용일·동의 기한 + 두 단추)을 보이고 제목만 다르다 —
// 어느 링크로 들어왔든 두 선택이 같은 무게로 보인다. 쪽을 열었다고 동의나 해지가 실행되지 않는다: 단추는 사람이 누른다(자동 제출 없음).
// 로그인이 필요하다 — 로그인 전이면 다른 보호된 쪽과 같은 로그인 안내(SignInRequired: 로그인 링크에 `next` 로 돌아올 주소를 단다 — B04)를 그린다.
// (LFADA) 예전에는 redirect() 였다. app/loading.tsx 때문에 쪽이 스트리밍으로 나가 이동이 HTTP 307 이 아니라 하이드레이션 뒤의 클라이언트 이동이라, 화면 관문(signed-out)이 이동이 끝나기 전에 재서 두 쪽이 실패했다 —
// 안내는 서버 HTML 에 로그인 링크가 이미 있어 늘 같은 결과다. 이메일 링크로 온 사람은 로그인 링크를 한 번 더 누른다(로그인하면 이 쪽으로 돌아온다).
export async function PriceChangeScreen({ mode, path }: { mode: "accept" | "decline"; path: string }) {
  const s = await session().catch(() => null)
  if (!(s?.ok && s.data)) return <SignInRequired next={path} />
  const sub = await subscription().catch(() => null)
  const text = copy[mode]
  const pending = sub?.ok ? sub.data?.pendingPriceChange : undefined
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      {pending ? (
        <>
          <h1 className="font-heading text-2xl">{text.title}</h1>
          <p className="text-base leading-[1.7]">{text.lead}</p>
          <RenewalConsentBlock subscription={subscription} acceptPriceChange={acceptPriceChange} cancel={cancel} />
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl">{sub?.ok ? copy.nothing.title : copy.failed.title}</h1>
          <p role={sub?.ok ? "status" : "alert"} className="text-base leading-[1.7]">
            {sub?.ok ? copy.nothing.body : copy.failed.body}
          </p>
          <Link href={copy.nothing.href} className="underline underline-offset-4">
            {copy.nothing.label}
          </Link>
        </>
      )}
    </div>
  )
}
