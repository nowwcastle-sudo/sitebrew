// bridge.js 소스 읽기(v0.2.6 T3) — 중계(proxy.mjs)가 내주는 bridge 에 대시보드 출처를 박는다. bridge 는 이 값 하나만 부모로 믿는다(bridge.js 머리 설명).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ORIGIN_PLACEHOLDER = '__SITEBREW_DASHBOARD_ORIGIN__'
const BRIDGE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'bridge.js')

/** @param {string} dashboardOrigin 예: http://127.0.0.1:53211 @returns {string} 출처가 박힌 bridge 소스 */
export function bridgeSourceFor(dashboardOrigin) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(dashboardOrigin)) throw new Error(`대시보드 출처가 127.0.0.1 주소가 아니다: ${dashboardOrigin}`)
  const src = readFileSync(BRIDGE_FILE, 'utf8')
  if (!src.includes(`'${ORIGIN_PLACEHOLDER}'`)) throw new Error('bridge.js 에 출처 자리표시자가 없다')
  return src.replace(`'${ORIGIN_PLACEHOLDER}'`, JSON.stringify(dashboardOrigin))
}
