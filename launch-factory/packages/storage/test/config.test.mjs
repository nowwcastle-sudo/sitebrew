// 환경 이름 → S3 설정. 다섯 이름이 모두 있어야 켜지고, 하나라도 빠지면 올리기만 꺼진다(사이트는 켜진다).
import assert from "node:assert/strict"
import { test } from "node:test"
import { STORAGE_ENV_NAMES, storageS3Config } from "../src/config.ts"

const full = { STORAGE_ENDPOINT: "https://s3.example.test", STORAGE_BUCKET: "b", STORAGE_REGION: "auto", STORAGE_ACCESS_KEY_ID: "AKIDEXAMPLE", STORAGE_SECRET_ACCESS_KEY: "not-a-real-secret" }
const reader = (m) => (n) => m[n] || undefined

test("다섯 이름이 모두 있으면 설정이 나온다 — 선택 이름은 없으면 빠진다", () => {
  assert.deepEqual(storageS3Config(reader(full)), { endpoint: "https://s3.example.test", bucket: "b", region: "auto", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "not-a-real-secret" })
  const c = storageS3Config(reader({ ...full, STORAGE_PATH_STYLE: "true", STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test/" }))
  assert.equal(c.pathStyle, true)
  assert.equal(c.publicBaseUrl, "https://cdn.example.test/")
  assert.equal(storageS3Config(reader({ ...full, STORAGE_PATH_STYLE: "false" })).pathStyle, undefined)
})

test("하나라도 없거나 비면 undefined — 반쯤 켜진 저장소로 올리지 않는다", () => {
  assert.equal(storageS3Config(reader({})), undefined)
  for (const n of ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_REGION", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"]) {
    assert.equal(storageS3Config(reader({ ...full, [n]: "" })), undefined, n)
    assert.equal(storageS3Config(reader(Object.fromEntries(Object.entries(full).filter(([k]) => k !== n)))), undefined, n)
  }
})

test("이름 목록은 일곱 — 필수 다섯 + 선택 둘", () => {
  assert.equal(STORAGE_ENV_NAMES.length, 7)
})
