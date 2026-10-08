import * as React from "react"

// 서버 렌더 첫 화면의 등장 번쩍임 막기(motion-gsap). 서버가 그린 HTML 은 JS 가 오기 전에 끝 모양으로 먼저 칠해지고, 하이드레이션 뒤
// 장면이 시작 상태를 입히면 「끝 모양 → 숨김 → 등장」이 된다. 머리(<head>)에 이 부품 하나를 두면:
//   ① 스크립트가 첫 칠 전에 돈다 — JS 가 돌고 동작 줄이기가 아닐 때만 <html data-motion="on">.
//   ② CSS 가 그 표지 아래에서만 등장 대상([data-enter])을 숨긴다. 장면이 시작한 구획([data-wf-scene] 안)은 숨기지 않는다 —
//      useGsapScene 이 같은 작업 안에서 시작 상태를 입히므로 그 사이 칠이 없다.
//   ③ 안전장치: 문서 파싱이 끝난 때(DOMContentLoaded)부터 failsafeMs 안에 시작하지 못한 구획은 드러낸다(data-motion="late").
//      절대 상한(Task 16 — 리뷰 14 #7): 스트리밍 문서는 DOMContentLoaded 가 늦어 가림도 늦게 풀린다(JS 실패 + 꼬리 6초 = 7.7초 숨음). 그래서 머리 파싱 때부터
//      failsafeMs + MOTION_FAILSAFE_CAP_EXTRA_MS(2.5초) 타이머도 함께 건다 — 둘 중 먼저 오는 쪽이 드러낸다.
//      기본은 운영 1.5초 · 개발 8초(next dev 는 청크가 커서 하이드레이션이 5초 안팎 — 운영 값이면 개발 중에 등장을 한 번도 못 본다).
//      그 뒤 하이드레이션된 서버 HTML 장면은 등장을 끝 상태로 건너뛴다(속성 상태로 판정 — 늦게 스트리밍된 HTML 도 같다).
//      개발에서는 건너뛸 때 console.info 한 줄을 남긴다.
// JS 가 없거나 동작 줄이기면 아무것도 숨기지 않는다. data-enter="keep" 은 움직이지만 숨기지 않는 대상이다(공공 원형의 누르는 요소 등).
// 쓰는 법(Next App Router): app/layout.tsx 의 <html suppressHydrationWarning> 안 <head><MotionBoot /></head>. 스크립트가 html 속성을 바꾸므로
// suppressHydrationWarning 이 필요하다(next-themes 와 같다). 서버 컴포넌트다(상태 없음).
// 엄격 CSP(nonce): 미들웨어(Next 16 은 proxy.ts)가 요청마다 nonce 를 만들어 CSP 머리와 요청 머리 x-nonce 에 싣고, 레이아웃이
// `const nonce = (await headers()).get("x-nonce") ?? undefined` 로 읽어 <MotionBoot nonce={nonce} /> 로 넘긴다. nonce 가 없으면 CSP 가
// 인라인 스크립트·스타일을 막아 가림이 꺼진다(번쩍임으로 돌아갈 뿐, 내용이 숨지는 않는다).
export const MOTION_FAILSAFE_MS = 1500
export const MOTION_FAILSAFE_DEV_MS = 8000
export const MOTION_FAILSAFE_CAP_EXTRA_MS = 2500
export const failsafeDefault = (env: string | undefined = process.env.NODE_ENV) => (env === "production" ? MOTION_FAILSAFE_MS : MOTION_FAILSAFE_DEV_MS)

// 첫 화면 구획(P3-4 PERF2, 대장 C233): 쪽이 첫 화면 구획을 [data-wf-first] 로 감싸면(찍어낸 사이트는 gen-pages 가 쪽의 첫 블록을 `<div data-wf-first className="contents">` 로 감싼다)
// 그 안의 등장 대상은 data-enter="keep" 처럼 첫 칠부터 보인다 — 히어로가 아닌 첫 구획(상세 쪽의 상품 제목·소개 글 등)이 LCP 후보일 때 하이드레이션 뒤로 밀리지 않게.
// 잃는 것은 히어로 keep 과 같다: 그 구획의 서버 렌더 등장 연출(use-gsap-scene settleKept 가 끝 상태로 둔다). 첫 화면 밖 구획은 그대로 숨었다 등장한다.
export const MOTION_GATE_CSS =
  'html[data-motion="on"] [data-enter]:not([data-enter="keep"], [data-wf-first] [data-enter], [data-wf-first][data-enter], [data-wf-scene] [data-enter], [data-wf-scene][data-enter]){visibility:hidden}'

// 화면 안 등장 대상(QFIX3-PERF): [data-wf-first] 는 구획 개수로 첫 화면을 가정하지만 구획의 높이는 모른다 — 쪽의 셋째 구획·둘째 구획의 글이 375 첫 화면에 들면
// 그 글(LCP 후보)이 하이드레이션까지 가려져, 모바일 모의 LCP 가 JS 150~380 KB 를 4G 로 다시 받는 시간(3.8~5.6 s, 관측 LCP 는 0.3~0.6 s)을 통째로 먹었다.
// 그래서 문서 파싱이 끝난 때(첫 칠 전) 머리 스크립트가 화면 안(뷰포트와 겹침)에 든 가려진 등장 대상을 찾아 ① 가림 CSS 의 :not() 목록에 더하고
// (속성을 달지 않는다 — React 하이드레이션이 보는 DOM 은 그대로, 앱이 정한 visibility 도 덮지 않는다) ② window.__wfFold 에 싣는다(use-gsap-scene 이 이 대상의 등장을
// 끝 상태로 둔다 — 첫 구획 keep 과 같다). 잃는 것: 그 대상의 서버 렌더 등장 연출. 화면 밖 구획은 그대로 숨었다 등장한다. display:contents 감싸개는 자식으로 판정한다.
export const motionBootScript = (failsafeMs: number, capExtraMs: number = MOTION_FAILSAFE_CAP_EXTRA_MS) =>
  `(function(d,w,ms,cap){var h=d.documentElement;try{if(h.hasAttribute("data-motion")||w.matchMedia("(prefers-reduced-motion: reduce)").matches)return}catch(e){return}` +
  `h.setAttribute("data-motion","on");var late=function(){if(h.getAttribute("data-motion")==="on")h.setAttribute("data-motion","late")};w.setTimeout(late,ms+cap);` +
  `var seen=function(e){var r=e.getBoundingClientRect();if(!r.width&&!r.height){for(var c=e.firstElementChild;c;c=c.nextElementSibling)if(seen(c))return 1;return 0}return r.bottom>0&&r.top<w.innerHeight};` +
  `var path=function(e){var s=[];while(e&&e!==h){var i=1,n=e;while(n=n.previousElementSibling)i++;s.unshift(e.nodeName.toLowerCase()+":nth-child("+i+")");e=e.parentElement}return"html>"+s.join(">")};` +
  `var fold=function(){try{var st=d.querySelector("style[data-wf-motion-gate]");if(!st||h.getAttribute("data-motion")!=="on")return;` +
  `var q=d.querySelectorAll('[data-enter]:not([data-enter="keep"])'),els=[],sel=[];` +
  `for(var i=0;i<q.length;i++){var e=q[i];if(e.closest("[data-wf-first],[data-wf-scene]")||!seen(e))continue;els.push(e);sel.push(path(e))}` +
  `if(sel.length){w.__wfFold=els;st.textContent=st.textContent.replace(":not(",":not("+sel.join(",")+",")}}catch(e){}};` +
  `var arm=function(){fold();w.setTimeout(late,ms)};if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",arm,{once:true});else arm()})(document,window,${Number(failsafeMs)},${Number(capExtraMs)})`

export function MotionBoot({ failsafeMs, nonce }: { failsafeMs?: number; nonce?: string }) {
  const ms = failsafeMs ?? failsafeDefault()
  return (
    <>
      <style data-wf-motion-gate="" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: MOTION_GATE_CSS }} />
      <script data-wf-motion-boot="" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: motionBootScript(ms) }} />
    </>
  )
}
