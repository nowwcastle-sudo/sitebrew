// 시험 재료(cdp-close.test.mjs): Chrome 을 띄운 채 끝없이 기다리는 「멈춘 관문 도구」. runTool 의 시간 초과가 이 트리를 거두는지 본다.
import { startChrome } from '../cdp.mjs'

await startChrome([], { prefix: process.env.HANG_CHROME_PREFIX || 'cdphang-' })
console.log('chrome-up')
setInterval(() => {}, 1 << 30)
