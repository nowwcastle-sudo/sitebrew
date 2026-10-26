import { pushPublicKey, subscribePush, unsubscribePush } from "@/app/actions/push"
import { PushToggle } from "@/components/product/push-toggle"
import { SignInRequired } from "@/components/product/sign-in-required"
import { pushCopy as copy } from "@/content/copy.ux.en"
import { currentSession } from "@/lib/session-server"

export const metadata = { title: "Device notifications" }

// 이 기기의 푸시 알림 쪽(로그인 필요). 구독은 사용자에게 묶인다 — 로그아웃·만료 상태면 다른 보호된 쪽과 같이 로그인 안내(돌아올 곳 포함, B04).
// 공개키가 null 이면 기능이 꺼진 제품이다(live 에서 VAPID 키가 없음): 단추 없이 안내 한 줄만 그린다.
export default async function DeviceNotificationsPage() {
  if (!(await currentSession())) return <SignInRequired next="/account/notifications" />
  const publicKey = await pushPublicKey()
  return (
    <div data-push={publicKey ? "enabled" : "disabled"} className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <h1 id="push-title" className="font-heading text-2xl">
        {copy.title}
      </h1>
      {publicKey ? (
        <>
          <p className="text-base leading-[1.7]">{copy.lead}</p>
          <PushToggle publicKey={publicKey} subscribe={subscribePush} unsubscribe={unsubscribePush} />
        </>
      ) : (
        <p data-testid="push-unavailable" className="text-base leading-[1.7]">
          {copy.unavailable}
        </p>
      )}
    </div>
  )
}
