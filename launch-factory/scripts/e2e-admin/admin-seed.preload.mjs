// launch-factory: 관리 화면 시험(scripts/e2e-admin/admin.spec.ts)이 서버에 미리 얹는 시험 전용 도우미. next start 를 `NODE_OPTIONS=--import=<이 파일>` 로 띄울 때만 돈다.
// 하는 일: 가입한 시험 계정(ADMIN_SEED_EMAIL)의 메일을 「확인됨」으로 바꾸고 role 을 admin 으로 둔다. 2단계 인증 칸(two_factor_enabled)은 신호 파일(ADMIN_SEED_2FA_FILE)이 생긴 뒤에 켠다
//   — 로그인 전에 켜 두면 로그인이 세션 대신 2단계 요구로 끝나므로, 시험은 로그인한 다음 파일을 만든다.
// 왜 필요한가: 화면(가입 폼)에는 메일 확인 링크를 누를 길이 없고(링크는 메일 본문에만 있다) 관리자 역할과 2단계 인증은 DB 에서 직접 정하는 값이다(docs/runbook/admin.md 의 「첫 관리자」).
// 제품 코드는 건드리지 않는다. mock 모드(LF_MODE=mock)이고 ADMIN_SEED_EMAIL 이 있을 때만 켜지며, 아니면 아무 일도 하지 않는다.
import { existsSync } from "node:fs"

const email = process.env.ADMIN_SEED_EMAIL
const twoFactorFile = process.env.ADMIN_SEED_2FA_FILE

if (process.env.LF_MODE === "mock" && email) {
  const { PGlite } = await import("@electric-sql/pglite")
  // 서버가 만드는 PGlite 를 잡는다 — 인스턴스 하나(lib/launch/db.ts 가 globalThis 로 하나만 만든다). 쓰이는 첫 순간에 목록에 든다
  const dbs = new Set()
  for (const name of ["query", "exec"]) {
    const original = PGlite.prototype[name]
    PGlite.prototype[name] = function patched(...args) {
      dbs.add(this)
      return original.apply(this, args)
    }
  }
  let busy = false
  const timer = setInterval(async () => {
    if (dbs.size === 0 || busy) return
    busy = true
    try {
      const wantTwoFactor = Boolean(twoFactorFile && existsSync(twoFactorFile))
      for (const db of dbs) {
        // 이미 같은 값이면 쓰지 않는다 — 서버가 일하는 중에 사용자 행을 자꾸 건드리지 않는다
        const { rows } = await db.query(`SELECT role, email_verified, two_factor_enabled FROM "user" WHERE email = $1`, [email])
        const row = rows[0]
        if (!row) continue
        const done = row.role === "admin" && row.email_verified === true && (!wantTwoFactor || row.two_factor_enabled === true)
        if (!done) await db.query(`UPDATE "user" SET role = 'admin', email_verified = true${wantTwoFactor ? ", two_factor_enabled = true" : ""} WHERE email = $1`, [email])
        else if (wantTwoFactor) clearInterval(timer) // 마지막 값(2단계 인증)까지 두었으면 끝
      }
    } catch {
      // 표가 아직 없으면(첫 마이그레이션 전) 다음 주기에 다시 한다
    } finally {
      busy = false
    }
  }, 100)
  timer.unref()
}
