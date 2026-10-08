// 시험 재료(cdp-exit-cleanup.test.mjs): Chrome 을 띄운 뒤 close() 를 부르지 않고 도구가 실패한 것처럼 바로 process.exit(1) 로 끝낸다 —
// 관문 도구의 실패 경로(워치독이 닫기를 5초만 기다리고 나가는 길 포함)에서 Chrome 과 임시 프로필이 남지 않는지 본다.
import { startChrome } from '../cdp.mjs'

const c = await startChrome([], { prefix: process.env.EXIT_CHROME_PREFIX || 'cdpexit-' })
console.log(`chrome-up ${c.proc.pid}`)
process.exit(1)
