// 시계 고정(P3-4 Task 7 Step 1, 대장 A144) — 관문·촬영이 같이 쓰는 도우미. 카운트다운·「지금 영업 중」·오늘 강조 같은 시간 의존 화면이 두 번 찍어도 같게 한다.
//
// 고른 방법: 문서가 만들어질 때마다(Page.addScriptToEvaluateOnNewDocument) 자바스크립트 Date 를 고정 시각으로 바꾸는 스크립트를 심고,
//   Emulation.setTimezoneOverride 로 시간대를 고정한다(지역 시각을 읽는 「영업 중」 판정이 호스트 시간대를 타지 않게).
// 고르지 않은 방법: Emulation.setVirtualTimePolicy(가상 시간). 공식 프로토콜 정의(ChromeDevTools/devtools-protocol json/browser_protocol.json — 문서 사이트 chromedevtools.github.io/devtools-protocol/tot/Emulation/ 의 원본):
//   · 「Turns on virtual time for all frames (replacing real-time with a synthetic time source)」 — experimental 표시(안정 계약이 아니다).
//   · 정책 pause 는 「The virtual time base may not advance」 — 타이머(setTimeout·setInterval)·애니메이션 시계가 멈춰, 모션 키트의 등장 끝 신호·안전장치·글꼴 대기가 오지 않는다(관문의 기다림이 멈춘다).
//     advance 는 「virtual time base may fast forward」 — 타이머가 앞당겨 돌아 카운트다운이 촬영 순간마다 다른 값으로 건너뛴다. pauseIfNetworkFetchesPending 도 같은 위험에 네트워크 의존이 더해진다.
//   · initialVirtualTime 이 고정하는 것은 「base::Time::Now」, 곧 Date 하나다 — 우리가 필요한 것은 그것뿐이라 주입과 얻는 것이 같고 잃는 것(멈춤)만 더 크다.
//   · addScriptToEvaluateOnNewDocument 는 「Evaluates given script in every frame upon creation (before loading frame's scripts)」 — 페이지 스크립트보다 먼저 돈다(안정 명령).
//   실측(2026-10-01, Chrome 헤드리스, setInterval 100ms·setTimeout 500ms 쪽 — page-visual 작업 탐침): pause + initialVirtualTime → 문서가 끝내 그려지지 않았다(Date 만 고정, 쪽 본문 없음). advance → 2.5초 사이 tick 60만 번·Date 가 수 시간씩 건너뜀(카운트다운이 촬영 순간마다 다른 값).
//   잃는 것(이 방법): Date·Intl 만 고정되고 performance.now·requestAnimationFrame 시계는 그대로다 — 동작 줄이기로 찍으니 애니메이션은 정지 화면이라 문제없고, 시간 고정이 필요한 것은 Date 를 읽는 글뿐이다.
//
// 고정하는 것: Date.now()·new Date()·Date()(인자 없음) · Intl.DateTimeFormat#format·formatToParts(인자 없음 = 지금) · Intl.RelativeTimeFormat 은 값을 받으니 해당 없음.
//   인자가 있는 new Date(x)·Date.UTC·Date.parse·instanceof Date 는 그대로 동작한다.
export const PIN_AT = '2026-06-15T12:00:00+09:00' // 월요일 낮 — 「영업 중」이 켜진다
export const PIN_TIMEZONE = 'Asia/Seoul'

/** ISO 문자열(또는 ms 숫자) → 에폭 ms. 읽을 수 없으면 던진다. */
export function pinMs(at = PIN_AT) {
  const ms = typeof at === 'number' ? at : Date.parse(at)
  if (!Number.isFinite(ms)) throw new Error(`시계 고정 시각을 읽을 수 없다: ${at}`)
  return ms
}

/** 새 문서마다 돌릴 스크립트 글(순수 함수 — vm 에서도 시험한다). */
export function clockPinSource(at = PIN_AT) {
  const fixed = pinMs(at)
  return `(() => {
  const FIXED = ${fixed};
  const RealDate = Date;
  if (RealDate.__wfPinned) return;
  function PinnedDate(...args) {
    if (!new.target) return new RealDate(FIXED).toString();
    return args.length ? new RealDate(...args) : new RealDate(FIXED);
  }
  Object.setPrototypeOf(PinnedDate, RealDate);
  PinnedDate.prototype = RealDate.prototype;
  Object.defineProperty(RealDate.prototype, 'constructor', { value: PinnedDate, writable: true, configurable: true });
  PinnedDate.now = () => FIXED;
  PinnedDate.UTC = RealDate.UTC;
  PinnedDate.parse = RealDate.parse;
  PinnedDate.__wfPinned = FIXED;
  globalThis.Date = PinnedDate;
  const proto = Intl.DateTimeFormat.prototype;
  const fmt = Object.getOwnPropertyDescriptor(proto, 'format');
  if (fmt && fmt.get) Object.defineProperty(proto, 'format', { configurable: true, get() { const f = fmt.get.call(this); return (d) => f(d === undefined ? FIXED : d); } });
  const parts = proto.formatToParts;
  proto.formatToParts = function (d) { return parts.call(this, d === undefined ? FIXED : d); };
})();`
}

/**
 * CDP 세션(send)에 시계 고정을 건다. 이 뒤에 열리는 문서부터 적용된다(열려 있는 문서에는 runImmediately 로도 건다).
 * { at, timezone: null 이면 시간대는 건드리지 않는다 }. → { id, at, timezone, unpin() }
 */
export async function pinClock(send, { at = PIN_AT, timezone = PIN_TIMEZONE } = {}) {
  const source = clockPinSource(at)
  const added = await send('Page.addScriptToEvaluateOnNewDocument', { source, runImmediately: true })
  const id = added.result?.identifier
  if (!id) throw new Error(`시계 고정 스크립트를 심지 못했다: ${JSON.stringify(added.error ?? added.result)}`)
  if (timezone) {
    const tz = await send('Emulation.setTimezoneOverride', { timezoneId: timezone })
    if (tz.error) throw new Error(`시간대를 고정하지 못했다(${timezone}): ${tz.error.message}`)
  }
  return {
    id, at, timezone,
    unpin: async () => { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: id }); if (timezone) await send('Emulation.setTimezoneOverride', { timezoneId: '' }) },
  }
}
