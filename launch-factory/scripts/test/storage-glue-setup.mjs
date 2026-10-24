// 파일 올리기 접착 시험 도우미: 진짜 레지스트리 파일(lib/launch/storage.ts · app/api/storage/**/route.ts · app/api/cron/storage/route.ts)을 그대로 불러
// 앱 조립 모듈(auth·db·env·cron)만 대역으로 바꾼다. 조립은 프로세스에서 한 번만 캐시되므로 모드별 시험 파일을 따로 둔다.
import { mkdtempSync } from "node:fs"
import { registerHooks } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { db } from "@launch-factory/db"
import { importRegistryFile, installGlueStubs, stubs } from "./registry-glue.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const STORAGE_LIB = pathToFileURL(join(ROOT, "registry/feature-storage/files/lib/launch/storage.ts")).href

/** 시험용 가짜 저장소 설정 — 실제 키가 아니다 */
export const FAKE_STORAGE_ENV = { STORAGE_ENDPOINT: "https://s3.example.test", STORAGE_BUCKET: "demo-bucket", STORAGE_REGION: "auto", STORAGE_ACCESS_KEY_ID: "AKIDEXAMPLE", STORAGE_SECRET_ACCESS_KEY: "not-a-real-secret-key" }

/** 모드를 바꿀 수 있는 접착 환경. process.cwd() 를 임시 폴더로 옮겨 mock 폴더 드라이버가 저장소를 더럽히지 않게 한다 */
export async function setupStorageGlue({ mode, userId = null }) {
  const state = { mode, userId }
  const d = await db.local()
  process.chdir(mkdtempSync(join(tmpdir(), "lf-storage-glue-")))
  stubs.db = { database: async () => d }
  stubs.env = { env: () => ({ LF_MODE: state.mode }), optional: (n) => process.env[n] || undefined, required: (n) => process.env[n] ?? "" }
  stubs.auth = { authPort: async () => ({ session: async () => (state.userId ? { ok: true, data: { userId: state.userId } } : { ok: true, data: null }) }) }
  stubs.cron = { cronAuthorized: () => true, unauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }) }
  installGlueStubs({ auth: ["authPort"], db: ["database"], env: ["env", "optional", "required"], cron: ["cronAuthorized", "unauthorized"] })
  registerHooks({
    // 시험 대상 조립 모듈은 대역이 아니라 진짜 파일이다(경로 파일이 부르는 `@/lib/launch/storage`)
    resolve: (specifier, context, next) => (specifier === "@/lib/launch/storage" ? { url: STORAGE_LIB, shortCircuit: true } : next(specifier, context)),
  })
  const lib = await importRegistryFile("feature-storage/files/lib/launch/storage.ts")
  const route = (rel) => importRegistryFile(`feature-storage/files/app/api/${rel}/route.ts`)
  return { state, db: d, lib, route, close: () => d.$client.close() }
}

export const postJson = (url, body) => new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" }, body: JSON.stringify(body) })
