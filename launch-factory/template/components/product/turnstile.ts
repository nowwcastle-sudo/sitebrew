"use client"

import * as React from "react"

// 가입 폼의 봇 확인 위젯(LFFIX F1). 토큰(`cf-turnstile-response`)은 블록이 아니라 조립하는 쪽이 싣는다(web-factory 규약) —
// 블록은 signUp({method,email,password,consents}) 객체를 넘기므로 폼 숨은 입력으로는 닿지 않는다. 그래서 signUp 포트 메서드를 감싸 토큰 칸을 더한다.
// Cloudflare 문서(2026-10-03 확인, developers.cloudflare.com/turnstile/get-started/client-side-rendering/): 명시 렌더링 스크립트
// `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` → `turnstile.render(el, { sitekey, callback })` → 토큰은 callback·getResponse().
// 토큰은 300초 유효·1회용(서버 검증 후 다시 못 쓴다) → 제출마다 reset 하고, 만료되면 위젯이 스스로 새로 받는다(refresh-expired 기본 auto).
// appearance "interaction-only": 사람 확인이 눈에 안 띄게 끝나고, 상호작용이 필요할 때만 위젯이 보인다.
// A07: 확인이 끝나기 전에는 제출이 나가지 않는다 — 위젯이 푸는 동안 「확인 중」 글이 보이고(상태 checking), 그 동안 제출하면 끝날 때까지 기다린다(waiting).
// 끝내 토큰이 없으면 서버를 부르지 않고 「잠시 뒤 다시 시도」 글(formError)을 돌려준다 — 보이지 않는 확인에 「확인을 마치라」고 말하지 않는다.
import type { AuthPort } from "@/components/contract/ports"

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id?: string): void
  remove(id?: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | undefined
function loadTurnstile(): Promise<TurnstileApi> {
  return (loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    // 동적으로 끼운 스크립트는 load 가 끝나면 명시 렌더링 API 가 준비돼 있다. turnstile.ready() 는 async/defer 태그에서 던지므로(실측) 쓰지 않는다
    const done = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")))
    if (window.turnstile) return done()
    const s = document.createElement("script")
    s.src = SRC
    // nonce 를 이어 준다(Cloudflare 권고: api.js 태그에 nonce → Turnstile 이 불러오는 것들에 퍼뜨린다). strict-dynamic 이라 없어도 동작한다
    s.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? ""
    s.onload = done
    s.onerror = () => {
      loading = undefined
      reject(new Error("turnstile script blocked"))
    }
    document.head.append(s)
  }))
}

const WAIT_MS = 10_000
const STEP_MS = 100

/** 봇 확인 상태: off=위젯 없음(mock) · checking=푸는 중 · waiting=제출을 눌렀고 끝나길 기다리는 중 · ready=토큰 있음 · failed=스크립트가 막혔거나 오류 */
export type BotStatus = "off" | "checking" | "waiting" | "ready" | "failed"

/** 화면 글(문구 파일에서 받는다 — 이 파일은 글을 갖지 않는다) */
export interface BotCopy {
  checking: string
  waiting: string
  failed: string
  /** 기다려도 토큰이 없을 때 폼에 돌려주는 글 */
  notReady: string
}

/**
 * 제출 한 번: 토큰이 아직 없으면(위젯이 푸는 중) 끝날 때까지 기다린 뒤(waiting 상태가 보인다) 토큰 칸(`cf-turnstile-response`)을 더해 부르고, 끝나면 위젯을 새로 푼다(토큰은 1회용).
 * 기다려도 토큰이 없으면 서버를 부르지 않고 notReady 글로 실패를 돌려준다(위젯은 새로 푼다 — 다시 누르면 새 확인이 시작된다).
 */
export async function signWithToken(
  input: Parameters<AuthPort["signUp"]>[0],
  io: {
    signUp: AuthPort["signUp"]
    enabled: boolean
    takeToken(): string
    peekToken(): string
    reset(): void
    waitMs?: number
    stepMs?: number
    onWaiting?(waiting: boolean): void
    notReady?: string
  },
): ReturnType<AuthPort["signUp"]> {
  if (!io.enabled) return io.signUp(input)
  const step = io.stepMs ?? STEP_MS
  if (!io.peekToken()) io.onWaiting?.(true)
  for (let waited = 0; !io.peekToken() && waited < (io.waitMs ?? WAIT_MS); waited += step) await new Promise((r) => setTimeout(r, step))
  io.onWaiting?.(false)
  if (!io.peekToken()) {
    io.reset()
    return { ok: false, formError: io.notReady ?? "We couldn't confirm you're human yet. Wait a moment, then try again.", retryable: true }
  }
  try {
    return await io.signUp({ ...input, "cf-turnstile-response": io.takeToken() } as typeof input)
  } finally {
    io.reset()
  }
}

/** 토큰이 올 때까지 잠깐 기다린다(위젯이 푸는 중). 끝까지 없으면 빈 글자를 돌려준다 — 서버가 「확인하지 못했어요」를 준다 */
export async function takeTokenWhenReady(io: { takeToken(): string; peekToken(): string; waitMs?: number; stepMs?: number }): Promise<string> {
  const step = io.stepMs ?? STEP_MS
  for (let waited = 0; !io.peekToken() && waited < (io.waitMs ?? WAIT_MS); waited += step) await new Promise((r) => setTimeout(r, step))
  return io.takeToken()
}

/** 위젯을 `box` 에 그리고 토큰을 들고 있는다. siteKey 가 없으면(mock) 아무것도 하지 않는다. 가입(useTurnstile)과 문의 폼이 함께 쓴다 */
export function useTurnstileWidget(siteKey: string | undefined) {
  const box = React.useRef<HTMLDivElement>(null)
  const widget = React.useRef<string | null>(null)
  const token = React.useRef("")
  const [status, setStatus] = React.useState<BotStatus>(siteKey ? "checking" : "off")
  React.useEffect(() => {
    if (!siteKey || !box.current) return
    let dead = false
    const el = box.current
    loadTurnstile()
      .then((api) => {
        if (dead) return
        widget.current = api.render(el, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (t: string) => {
            token.current = t
            setStatus("ready")
          },
          "expired-callback": () => {
            token.current = ""
            setStatus("checking")
          },
          "error-callback": () => {
            token.current = ""
            setStatus("failed")
          },
        })
      })
      .catch(() => setStatus("failed")) // 스크립트가 막히면 토큰이 오지 않는다 — 「확인 중」 대신 실패 글을 보인다(제출은 서버를 부르지 않고 같은 글로 끝난다)
    return () => {
      dead = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
      token.current = ""
    }
  }, [siteKey])
  return {
    box,
    enabled: !!siteKey,
    status,
    takeToken: () => {
      const t = token.current
      token.current = "" // 1회용이다 — 같은 토큰을 두 번 보내지 않는다
      return t
    },
    peekToken: () => token.current,
    reset: () => {
      if (widget.current) window.turnstile?.reset(widget.current)
      setStatus((s) => (s === "failed" ? s : "checking")) // 새 토큰을 푸는 중
    },
    onWaiting: (waiting: boolean) => setStatus((s) => (waiting ? "waiting" : s === "waiting" ? "checking" : s)),
  }
}

/** 위젯을 `box` 에 그리고, signUp 을 감싸 제출 때마다 새 토큰을 싣는다. siteKey 가 없으면(mock) 아무것도 하지 않고 signUp 을 그대로 돌려준다 */
export function useTurnstile(siteKey: string | undefined, signUp: AuthPort["signUp"], copy?: BotCopy) {
  const { box, enabled, status, takeToken, peekToken, reset, onWaiting } = useTurnstileWidget(siteKey)
  // takeToken·peekToken·reset·onWaiting 은 ref 와 setState 만 써서 렌더마다 새 함수여도 동작이 같다
  const wrapped = React.useCallback<AuthPort["signUp"]>(
    (input) => signWithToken(input, { signUp, enabled, takeToken, peekToken, reset, onWaiting, ...(copy ? { notReady: copy.notReady } : {}) }),
    [signUp, enabled, copy],
  )
  return { box, signUp: wrapped, status }
}
