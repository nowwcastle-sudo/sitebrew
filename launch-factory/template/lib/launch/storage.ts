// launch-factory: 파일 올리기 조립. 브라우저가 저장소(S3 호환: AWS S3·R2·MinIO)에 직접 PUT 한다 — 서버는 짧은 서명 티켓만 만들고, 끝낼 때 실제 크기·형식을 다시 확인한다.
// 저장소 설정(STORAGE_*)이 하나라도 없으면 live 에서 **올리기만 꺼진다**(사이트는 켜진다): storageEnabled() 가 false 이고 서비스는 provider_unavailable 로 거절한다.
// mock 은 폴더(.tmp/uploads)에 쓰는 로컬 드라이버로 같은 서비스 코드를 돌린다 — 그 경로(app/api/storage/local)는 live 에서 404 다.
import { join } from "node:path"
import { hitRateLimit } from "@launch-factory/db"
import { createRateLimiter, ipAddressFromEnv, warnNoIpOnce } from "@launch-factory/security/rate-limit"
import { createS3Driver, createStorageHandlers, createStorageService, storageS3Config, type StorageDriver, type StorageHandlers, type StorageService } from "@launch-factory/storage"
import type { LocalDriver } from "@launch-factory/storage/local"
import { authPort } from "@/lib/launch/auth"
import { database } from "@/lib/launch/db"
import { env, optional } from "@/lib/launch/env"

interface Built {
  service: StorageService
  handlers: StorageHandlers
  local: LocalDriver | null
}

let cached: Promise<Built> | undefined

const live = (): boolean => env().LF_MODE === "live"

/** 올리기를 받는가. live 는 저장소 설정이 다 있을 때만, mock 은 늘 켜진다. 데이터베이스에 닿지 않는다 */
export const storageEnabled = (): boolean => !live() || storageS3Config(optional) !== undefined

/** 로그인한 사용자 id(없으면 null). 세션을 못 읽으면 로그아웃과 같게 본다 */
async function sessionUserId(): Promise<string | null> {
  try {
    const s = await (await authPort()).session()
    return s.ok && s.data && !s.data.impersonatedBy ? s.data.userId : null
  } catch {
    return null
  }
}

async function build(): Promise<Built> {
  const db = await database()
  let driver: StorageDriver | undefined
  let local: LocalDriver | null = null
  if (live()) {
    const config = storageS3Config(optional)
    if (config) driver = createS3Driver(config)
  } else {
    const { createLocalDriver } = await import("@launch-factory/storage/local")
    driver = local = createLocalDriver({ dir: join(process.cwd(), ".tmp", "uploads") })
  }
  const service = createStorageService({
    db,
    ...(driver ? { driver } : {}),
    // 믿을 IP 머리는 환경이 정한다(대장 D205). 인증·보안·문의 항목과 같은 함수라 같은 사람을 같은 IP 로 센다
    limiter: createRateLimiter({ store: { hit: (key, windowMs, now) => hitRateLimit(db, key, windowMs, now) }, ipAddress: ipAddressFromEnv(process.env), onNoIp: warnNoIpOnce() }),
  })
  return { service, handlers: createStorageHandlers({ service, userId: sessionUserId }), local }
}

const built = (): Promise<Built> => (cached ??= build())

export const storage = async (): Promise<StorageService> => (await built()).service
export const storageHandlers = async (): Promise<StorageHandlers> => (await built()).handlers
/** 로컬 폴더 드라이버. **live 에서는 null** — 경로(app/api/storage/local)가 404 를 낸다 */
export const storageLocal = async (): Promise<LocalDriver | null> => (live() ? null : (await built()).local)
