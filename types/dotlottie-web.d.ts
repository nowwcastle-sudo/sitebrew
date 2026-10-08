// 저장소 안 typecheck 용 좁은 모듈 선언(FV1 Task 5.6) — 선택 설치 의존 @lottiefiles/dotlottie-web 이 아직 설치되지 않아도(부모가 병합 뒤 npm install) typecheck 가 통과하게 한다.
// 소비자에게는 나가지 않는다(레지스트리 항목에 없다). 패키지가 설치돼도 같은 이름의 앰비언트 선언이 먼저 읽힌다 — motion-lottie.tsx 가 쓰는 만큼만 적는다.
declare module "@lottiefiles/dotlottie-web" {
  export class DotLottie {
    constructor(config: { canvas: HTMLCanvasElement; src: string; autoplay?: boolean; loop?: boolean })
    static setWasmUrl(url: string): void
    play(): void
    pause(): void
    setFrame(frame: number): void
    addEventListener(type: "load", listener: () => void): void
    destroy(): void
  }
}
