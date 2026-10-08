"use client"

import * as React from "react"

import { lottiePlan } from "@/registry/factory/motion/motion-scale"
import { usePauseOffscreen } from "@/registry/factory/motion/use-pause-offscreen"
import { useReducedMotion } from "@/registry/factory/motion/use-reduced-motion"

// Lottie(.lottie·.json) 재생(항목 motion-lottie — 선택 설치, 효과 카드 lottie-playback). 재생기 @lottiefiles/dotlottie-web 은 이 파일을 쓰는 순간에만 동적 import 로 내려받는다
// (첫 화면 JS 예산 밖 — 정적 import 없음). 규칙은 순수 계획 lottiePlan(motion-scale)이 정한다:
//   · 동작 줄이기(또는 M0)면 첫 프레임에서 멈춘 그림(autoplay false) — 재생 단추도 없다.
//   · 화면 밖·숨은 탭이면 멈춘다(usePauseOffscreen). 사용자 정지(paused)도 같다.
//   · 무한 반복이거나 한 바퀴가 5초를 넘으면 멈춤 단추가 필요하다 → onNeedsPause(true) 로 알린다. 단추는 부르는 쪽이 _shared/loop-pause 로 달고 paused 를 되먹인다.
// 재생기는 wasm 을 기본으로 외부 CDN 에서 받는다 — 엄격 CSP(script-src 'self')·개인정보를 위해 wasmUrl 에 같은 출처 주소를 주면 setWasmUrl 로 그쪽을 쓴다.
// 좁은 로컬 타입으로만 받는다 — 패키지가 설치되기 전에도 typecheck 가 통과한다(types/dotlottie-web.d.ts 가 이 저장소 안 모듈 선언).
type Player = {
  play(): void
  pause(): void
  setFrame(frame: number): void
  addEventListener(type: "load", listener: () => void): void
  destroy(): void
}
type PlayerClass = { new (config: { canvas: HTMLCanvasElement; src: string; autoplay?: boolean; loop?: boolean }): Player; setWasmUrl?: (url: string) => void }

async function loadPlayerClass(): Promise<PlayerClass> {
  const mod = (await import("@lottiefiles/dotlottie-web")) as unknown as { DotLottie: PlayerClass }
  return mod.DotLottie
}

export type LottiePlaybackProps = {
  // 애니메이션 주소(같은 출처 권장).
  src: string
  // 그림의 뜻(읽기 도구용). decorative 면 비운다.
  label?: string
  decorative?: boolean
  loop?: boolean
  // 한 바퀴 길이(초) — 반복이 아닐 때 멈춤 단추 판정에 쓴다.
  loopSeconds?: number
  // 같은 출처의 wasm 주소(선택).
  wasmUrl?: string
  // 사용자 정지(부르는 쪽 단추 상태).
  paused?: boolean
  // 멈춤 단추가 필요한지 알린다(5초 넘는 자동 재생일 때 true).
  onNeedsPause?: (needs: boolean) => void
  className?: string
}

export function LottiePlayback({ src, label, decorative = false, loop = true, loopSeconds, wasmUrl, paused = false, onNeedsPause, className }: LottiePlaybackProps) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const [player, setPlayer] = React.useState<Player | null>(null)
  const reduced = useReducedMotion()
  const offscreen = usePauseOffscreen(wrap)
  const { autoplay, firstFrameOnly, pauseButton } = lottiePlan({ reducedMotion: reduced, loop, loopSeconds })

  React.useEffect(() => {
    onNeedsPause?.(pauseButton)
  }, [pauseButton, onNeedsPause])

  // 재생기 만들기: 동작 줄이기여도 첫 프레임을 그려야 하므로 만든다(autoplay 는 늘 꺼 두고 아래 효과가 정한다).
  React.useEffect(() => {
    const node = canvas.current
    if (!node) return
    let dead = false
    let inst: Player | null = null
    loadPlayerClass()
      .then((DotLottie) => {
        if (dead) return
        if (wasmUrl) DotLottie.setWasmUrl?.(wasmUrl)
        inst = new DotLottie({ canvas: node, src, autoplay: false, loop })
        const made = inst
        made.addEventListener("load", () => { if (!dead) setPlayer(made) })
      })
      .catch(() => {
        // 재생기를 못 받으면 빈 칸으로 둔다 — 글이 아니라 장식 그림이라 쪽은 그대로 읽힌다.
      })
    return () => {
      dead = true
      inst?.destroy()
    }
  }, [src, loop, wasmUrl])

  // 재생 상태: 정지 갈래는 첫 프레임, 아니면 화면 안·사용자 정지 아님일 때만 재생.
  React.useEffect(() => {
    if (!player) return
    try {
      if (firstFrameOnly) {
        player.pause()
        player.setFrame(0)
      } else if (autoplay && !paused && !offscreen) player.play()
      else player.pause()
    } catch {
      // 이미 정리된 재생기(src 가 바뀌는 사이)면 무시한다.
    }
  }, [player, firstFrameOnly, autoplay, paused, offscreen])

  const state = firstFrameOnly ? "still" : paused || offscreen ? "paused" : "playing"
  return (
    <div ref={wrap} data-wf-lottie={state} className={className}>
      <canvas ref={canvas} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} />
    </div>
  )
}
