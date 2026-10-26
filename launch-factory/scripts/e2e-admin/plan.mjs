// 관리 화면 브라우저 시험(scripts/e2e-admin)의 순수 부분 — 서버·브라우저 없이 시험한다(scripts/test/e2e-admin.test.mjs). 오케스트레이터는 run.mjs.
// 템플릿(template/)은 건드리지 않는다: 사본을 만들어 사본에서만 관리자 스위치를 켠다. 그래서 제품 템플릿의 해시 잠금·조립된 제품에는 아무 영향이 없다.
import { cleanEnv } from "../../template/scripts/ci/smoke-lib.mjs"

/** 시험 계정(=관리자=소유자). 서버의 소유자 메일 이름과 시드 이름에 같은 값을 준다 */
export const ADMIN_EMAIL = "admin@example.test"

/** 사본에 얹을 때 따라오지 말아야 할 것: 설치·빌드 부산물과 비밀값 파일 */
const SKIP = /(^|\/)(node_modules|\.next|\.tmp|\.env(\..*)?)(\/|$)/
export const copyFilter = (rel) => !SKIP.test(rel.split("\\").join("/"))

const FEATURES_OFF = /\{\s*twoFactor:\s*false,\s*admin:\s*false\s*\}/

/** features.ts 원문에서 관리자 스위치(2단계 인증 + 관리자)를 켠다. 모양이 달라졌으면 조용히 넘어가지 않고 던진다 — 그러면 관리자 구획이 안 열려 시험이 반쪽이 된다 */
export function withAdminFeatures(source) {
  if (!FEATURES_OFF.test(source)) throw new Error("lib/launch/features.ts 에서 `{ twoFactor: false, admin: false }` 를 찾지 못했다 — run.mjs 의 withAdminFeatures 를 새 모양에 맞춘다")
  return source.replace(FEATURES_OFF, "{ twoFactor: true, admin: true }")
}

/** 빌드 환경: 공급자·모드 이름을 지우고 mock 으로 */
export const buildEnv = (base = process.env) => cleanEnv(base, { LF_MODE: "mock", LF_ALLOW_MOCK_PROD: "1" })

/**
 * 서버 환경. 빌드 환경 + 결제 없음 · 메일 기록 파일 · 요청마다 다른 주소(x-test-ip)를 믿는 요청 제한 · 소유자 메일 둘 · 시드(preload) 설정.
 * 시드는 NODE_OPTIONS=--import 로 서버 프로세스에 얹는다(제품 코드는 그대로).
 */
export function serverEnv({ outbox, twoFactorFile, preload, base = process.env }) {
  if (!outbox || !twoFactorFile || !preload) throw new Error("serverEnv: outbox · twoFactorFile · preload 가 필요하다")
  return {
    ...buildEnv(base),
    LF_MOCK_SUB: "none",
    LF_MOCK_OUTBOX: outbox,
    LF_CLIENT_IP_HEADER: "x-test-ip",
    INQUIRY_OWNER_EMAIL: ADMIN_EMAIL,
    BOOKING_OWNER_EMAIL: ADMIN_EMAIL,
    ADMIN_SEED_EMAIL: ADMIN_EMAIL,
    ADMIN_SEED_2FA_FILE: twoFactorFile,
    NODE_OPTIONS: `--import=${preload}`,
  }
}

/** Playwright(시험 쪽) 환경 — cleanEnv 가 LF_* 를 지우므로 이름이 다르다 */
export const testEnv = ({ port, outbox, twoFactorFile, outDir, channel, base = process.env }) => ({
  ...cleanEnv(base),
  SMOKE_BASE_URL: `http://127.0.0.1:${port}`,
  SMOKE_OUTBOX: outbox,
  SMOKE_OUT: outDir,
  SMOKE_CHANNEL: channel ?? "",
  ADMIN_SEED_EMAIL: ADMIN_EMAIL,
  ADMIN_SEED_2FA_FILE: twoFactorFile,
})
