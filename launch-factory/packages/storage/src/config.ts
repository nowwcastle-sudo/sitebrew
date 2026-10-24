// 환경 이름 → S3 드라이버 설정(순수). 필수 다섯 이름이 모두 있어야 설정이 나오고, 하나라도 없으면 undefined —
// 반쯤 켜진 저장소로 올리지 않고 올리기만 꺼진다(사이트는 켜진다). 값은 어디에도 싣지 않는다.
import type { S3DriverOptions } from "./driver-s3.ts"

export const STORAGE_REQUIRED_ENV = ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_REGION", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const
/** 선택: 경로식 주소(R2·MinIO 는 "true") · 공개 종류의 읽기 주소 앞부분(CDN·공개 도메인) */
export const STORAGE_OPTIONAL_ENV = ["STORAGE_PATH_STYLE", "STORAGE_PUBLIC_BASE_URL"] as const
export const STORAGE_ENV_NAMES = [...STORAGE_REQUIRED_ENV, ...STORAGE_OPTIONAL_ENV] as const

export function storageS3Config(read: (name: string) => string | undefined): S3DriverOptions | undefined {
  const [endpoint, bucket, region, accessKeyId, secretAccessKey] = STORAGE_REQUIRED_ENV.map(read)
  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) return undefined
  const publicBaseUrl = read("STORAGE_PUBLIC_BASE_URL")
  return { endpoint, bucket, region, accessKeyId, secretAccessKey, ...(read("STORAGE_PATH_STYLE") === "true" ? { pathStyle: true } : {}), ...(publicBaseUrl ? { publicBaseUrl } : {}) }
}
