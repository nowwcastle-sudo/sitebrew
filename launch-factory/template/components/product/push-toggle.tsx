"use client"

import * as React from "react"

import type { ActionResult } from "@/components/contract/block-contract"
import { Button } from "@/components/ui/button"
import { pushCopy as copy } from "@/content/copy.ux.en"
import { derivePushState, pushSupported, urlBase64ToUint8Array, type PushState } from "@/lib/push-client"

// 이 기기의 웹 푸시 켜고 끄기(/account/notifications). 순수 계산은 lib/push-client.ts, 이 파일은 브라우저 API(서비스 워커·PushManager·Notification)와 서버 액션을 잇는다.
//   · 알림 허락 창은 사용자가 [Turn on notifications] 을 누를 때만 띄운다(쪽을 열 때 묻지 않는다).
//   · 켜기: /sw.js 등록 → 허락 → pushManager.subscribe → 서버에 구독 저장. 서버 저장이 실패하면 방금 만든 구독을 되돌려 「켜진 척」하지 않는다.
//   · 끄기: 브라우저 구독 해지 + 서버에서 지움. 브라우저 설정에서 막힌 상태(denied)는 코드로 못 푼다 — 설정 방법을 글로 안내한다.
type Phase = "checking" | PushState
const SW_URL = "/sw.js"

export function PushToggle({
  publicKey,
  subscribe,
  unsubscribe,
}: {
  /** 서버가 준 VAPID 공개키(pushPublicKey()). 쪽이 null 이면 이 컴포넌트를 그리지 않는다 */
  publicKey: string
  subscribe: (subscription: unknown) => Promise<ActionResult<object>>
  unsubscribe: (input: { endpoint: string }) => Promise<ActionResult<object>>
}) {
  const [state, setState] = React.useState<Phase>("checking")
  const [busy, setBusy] = React.useState<"enabling" | "disabling" | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const messageRef = React.useRef<HTMLParagraphElement>(null)

  const refresh = React.useCallback(async () => {
    const supported = pushSupported({ serviceWorker: "serviceWorker" in navigator, pushManager: "PushManager" in window, notification: "Notification" in window })
    if (!supported) return setState("unsupported")
    const subscribed = await navigator.serviceWorker
      .getRegistration(SW_URL)
      .then((registration) => registration?.pushManager.getSubscription())
      .then((existing) => !!existing)
      .catch(() => false)
    setState(derivePushState({ supported, permission: Notification.permission, subscribed }))
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const fail = (text: string) => {
    setMessage(text)
    void refresh()
  }
  const failureText = (r: Extract<ActionResult<object>, { ok: false }>) => (r.code === "signInRequired" ? copy.signedOut : copy.error)

  const enable = async () => {
    setBusy("enabling")
    setMessage(null)
    let created: PushSubscription | null = null
    try {
      const registration = await navigator.serviceWorker.register(SW_URL)
      await navigator.serviceWorker.ready
      if ((await Notification.requestPermission()) !== "granted") return fail(copy.denied)
      created = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const r = await subscribe(created.toJSON())
      if (!r.ok) {
        await created.unsubscribe().catch(() => false) // 서버가 모르는 구독은 남기지 않는다
        return fail(failureText(r))
      }
      setState("on")
    } catch {
      await created?.unsubscribe().catch(() => false)
      fail(copy.error)
    } finally {
      setBusy(null)
    }
  }

  const disable = async () => {
    setBusy("disabling")
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration(SW_URL)
      const current = await registration?.pushManager.getSubscription()
      if (current) {
        const r = await unsubscribe({ endpoint: current.endpoint })
        if (!r.ok) return fail(failureText(r))
        await current.unsubscribe()
      }
      setState("off")
    } catch {
      fail(copy.error)
    } finally {
      setBusy(null)
    }
  }

  React.useEffect(() => {
    if (message) messageRef.current?.focus()
  }, [message])

  const stateText = busy === "enabling" ? copy.enabling : busy === "disabling" ? copy.disabling : state === "checking" ? copy.checking : copy.states[state]
  return (
    <div data-testid="push-toggle" data-push-state={busy ?? state} className="flex flex-col gap-4">
      <p role="status" data-testid="push-state" className="text-base leading-[1.7]">
        {stateText}
      </p>
      {state === "blocked" ? <p data-testid="push-blocked" className="text-base leading-[1.7]">{copy.blocked}</p> : null}
      {state === "unsupported" ? <p data-testid="push-unsupported" className="text-base leading-[1.7]">{copy.unsupported}</p> : null}
      {message ? (
        <p ref={messageRef} tabIndex={-1} role="alert" data-testid="push-error" className="border border-destructive px-4 py-3 text-base leading-[1.6] outline-hidden focus-visible:ring-3 focus-visible:ring-ring">
          {message}
        </p>
      ) : null}
      {state === "off" || state === "on" || busy ? (
        <Button
          type="button"
          size="lg"
          variant={state === "on" || busy === "disabling" ? "outline" : "default"}
          disabled={busy !== null}
          focusableWhenDisabled
          data-testid={state === "on" || busy === "disabling" ? "push-disable" : "push-enable"}
          onClick={state === "on" ? disable : enable}
          className="self-start"
        >
          {busy === "enabling" ? copy.enabling : busy === "disabling" ? copy.disabling : state === "on" ? copy.disable : copy.enable}
        </Button>
      ) : null}
    </div>
  )
}
