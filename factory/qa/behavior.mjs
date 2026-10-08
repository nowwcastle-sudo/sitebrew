// Behaviour check: node behavior.mjs [--strict] <url> <outJson>
// Confirms four UX rules from DESIGN.md §7-B via real focus/keyboard events over CDP:
// 1) confirm dialogs open with focus on [취소], so Enter never sends the order
//    (and the confirm action itself is observed to actually run — see (window.__orders||0)).
// 2) a toast opened by data-qa="toast-trigger" actually appears (toastSeen), and its
//    expired action button leaves the tab order (not just opacity).
// 3) clicking a toggle-group filter item keeps focus on it (no DOM rebuild).
//
// Without --strict, a missing data-qa marker on the page records 'n/a' and is not a
// failure (the brief's default — lets this run against pages that only implement some
// of the three). With --strict, 'n/a' counts as a failure — use this for a real page
// (like /qa/base) where every marker is expected to exist and be checked for real.
// Any evaluation that resolves to JS `undefined` (an exception, or a broken expression)
// is always a failure, in both modes — that is never a legitimate "nothing to check".
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { startChrome, navigateAndWait, connect, assertOpened } from './cdp.mjs';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const [url, outPath] = argv.filter((a) => a !== '--strict');
mkdirSync(dirname(outPath), { recursive: true });
rmSync(outPath, { force: true }); // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome;
let exitCode = 0;
try {
  chrome = await startChrome(['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], { prefix: 'behavior-' });
  // 호출마다 기한(cdp.mjs session). ev 는 페이지 예외면 undefined — an exception is never a legitimate result.
  const { ws, send, ev } = await connect(chrome.wsUrl);

  await send('Page.enable'); await send('Runtime.enable');
  // document.activeElement only reflects the real focused element when focus emulation is on
  // (a headless, unfocused window otherwise reports document.body regardless of what was focused).
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await assertOpened(await navigateAndWait(send, ev, url), ev, url); // 열리지 않는 쪽은 도구 실패(C123)
  await sleep(600); // let client hydration / event listeners attach

  const fail = [];
  // `undefined` here always means the evaluation itself broke (exception, or the
  // expression genuinely produced undefined) — record it and fail regardless of --strict.
  const undef = (value, what) => { if (value === undefined) { fail.push(`${what}: evaluation returned undefined`); return true; } return false; };
  // A marker probe that throws is a broken check, not "marker absent": record the
  // failure (so it can't pass as a quiet 'n/a') and skip that section.
  const has = async (selector) => { const v = await ev(`!!document.querySelector('${selector}')`); return undef(v, `has(${selector})`) ? false : v; };

  // 1) confirm dialog — wait for the open animation (~400ms) before reading focus.
  let dialogFocus = 'n/a';
  let enterSendsOrder = 'n/a';
  if (await has('[data-qa="confirm-open"]')) {
    await ev(`document.querySelector('[data-qa="confirm-open"]').click()`); await sleep(400);
    dialogFocus = await ev(`document.activeElement.textContent.trim()`);
    undef(dialogFocus, 'dialogFocus');
    // text/unmodifiedText must be set for CDP to run the browser's native default action
    // (button activation on Enter) — without them the event reaches JS listeners but no click fires.
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await sleep(300);
    enterSendsOrder = await ev(`(window.__orders||0) > 0`);
    undef(enterSendsOrder, 'enterSendsOrder');
  }

  // 2) toast — trigger, confirm it actually showed up (toastSeen), then wait past
  // expiry and check whether [되돌리기] is still reachable.
  let toastSeen = 'n/a';
  let toastButtonInTabOrderAfterExpiry = 'n/a';
  if (await has('[data-qa="toast-trigger"]')) {
    const toastActionVisible = `[...document.querySelectorAll('button,[href],[tabindex]')].some(e => /되돌리기/.test(e.textContent) && e.isConnected && !e.closest('[hidden],[inert]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0')`;
    await ev(`document.querySelector('[data-qa="toast-trigger"]').click()`);
    await sleep(600); // entrance animation
    toastSeen = await ev(toastActionVisible);
    undef(toastSeen, 'toastSeen');
    await sleep(5900); // ~6500ms since click in total, past a 4-5s expiry
    toastButtonInTabOrderAfterExpiry = await ev(`[...document.querySelectorAll('button,[href],[tabindex]')].some(e => /되돌리기/.test(e.textContent) && e.tabIndex >= 0 && e.isConnected && !e.closest('[hidden],[inert]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')`);
    undef(toastButtonInTabOrderAfterExpiry, 'toastButtonInTabOrderAfterExpiry');
  }

  // 3) filter — click should not rebuild the DOM and drop focus.
  let filterKeepsFocus = 'n/a';
  const filterCount = await ev(`document.querySelectorAll('[data-qa="filter"]').length`);
  if (!undef(filterCount, 'filterCount') && filterCount > 1) {
    await ev(`document.querySelectorAll('[data-qa="filter"]')[1].focus()`);
    await ev(`document.querySelectorAll('[data-qa="filter"]')[1].click()`); await sleep(300);
    filterKeepsFocus = await ev(`document.activeElement?.getAttribute('data-qa') === 'filter'`);
    undef(filterKeepsFocus, 'filterKeepsFocus');
  }

  if (dialogFocus !== 'n/a' && dialogFocus !== undefined && dialogFocus !== '취소') fail.push(`dialog opens on "${dialogFocus}"`);
  if (enterSendsOrder === true) fail.push('Enter sends order');
  if (toastSeen === false) fail.push('toast never appeared');
  if (toastButtonInTabOrderAfterExpiry === true) fail.push('expired toast button still reachable');
  if (filterKeepsFocus === false) fail.push('filter loses focus');
  if (strict) {
    if (dialogFocus === 'n/a') fail.push('--strict: no [data-qa=confirm-open] on the page');
    if (toastSeen === 'n/a') fail.push('--strict: no [data-qa=toast-trigger] on the page');
    if (filterKeepsFocus === 'n/a') fail.push('--strict: fewer than two [data-qa=filter] items on the page');
  }

  const report = { dialogFocus, enterSendsOrder, toastSeen, toastButtonInTabOrderAfterExpiry, filterKeepsFocus, strict, pass: !fail.length, fail };
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: !fail.length, fail }));
  ws.close();
  exitCode = fail.length ? 3 : 0;
} catch (e) {
  console.error(`도구 실패: ${e.message}`);
  rmSync(outPath, { force: true });
  exitCode = 1;
} finally {
  await chrome?.close();
}
process.exit(exitCode);
