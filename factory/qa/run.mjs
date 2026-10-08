// Runner: node run.mjs [--strict] <url> <outDir>
// Runs ux-gate.mjs and behavior.mjs against one URL (async spawn, in sequence) and
// merges their exit codes into outDir/report.json. Exits 0 only if both passed.
// --strict forwards to behavior.mjs: a missing data-qa marker ('n/a') then fails
// instead of being skipped — use this for a real page where every marker is expected.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './cdp.mjs'; // --session <장면>(UXGATE1)을 argv 에서 떼어 내고 WF_SESSION 으로 자식(ux-gate·behavior)에 물려준다 — 인자가 없으면 아무것도 안 한다.

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const [url, outDir] = argv.filter((a) => a !== '--strict');
mkdirSync(outDir, { recursive: true });

const run = (args) => new Promise((res) => {
  const p = spawn(process.execPath, args, { stdio: 'inherit' });
  p.on('exit', (code) => res(code));
});

const gateDir = join(outDir, 'gate');
const behaviorPath = join(outDir, 'behavior.json');
rmSync(join(outDir, 'report.json'), { force: true }); // 앞 실행의 결과를 도구 실패 뒤에 남기지 않는다

const gate = await run([join(here, 'ux-gate.mjs'), url, gateDir]);
const behaviorArgs = strict ? ['--strict', url, behaviorPath] : [url, behaviorPath];
const behavior = await run([join(here, 'behavior.mjs'), ...behaviorArgs]);

// 자식이 0(통과)도 3(판정 실패)도 아니면 도구 실패다(열리지 않는 쪽·CDP 기한 초과 …, C123) — 판정처럼 3 으로 읽히지 않게 report.json 없이 1 로 끝낸다.
const broken = [['ux-gate', gate], ['behavior', behavior]].filter(([, c]) => c !== 0 && c !== 3);
if (broken.length) {
  console.error(`도구 실패: ${broken.map(([n, c]) => `${n} 종료 ${c}`).join(' · ')} — 판정이 아니다`);
  process.exit(1);
}

const pass = gate === 0 && behavior === 0;
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ gate, behavior, strict, pass }, null, 2));
console.log(JSON.stringify({ gate, behavior, strict, pass }));
process.exit(pass ? 0 : 3);
