// 로컬 폴더 드라이버 — **mock 전용**. 템플릿 경로 `/api/storage/local/[...key]` 가 handle() 을 부른다(live 에서는 그 경로가 404 라 닿지 않는다).
// 서비스 코드는 진짜이고 갈아 끼우는 것은 이 어댑터뿐이다: presign 은 sigv4.ts 로 서명한 상대 주소를 만들고, handle 은 같은 서명을 verifyPresigned 로 다시 계산해 받는다.
// 서명 비밀은 폴더 안 `.secret`(처음에 한 번 무작위로 만든다)라 모듈 사본이 여럿이어도·재시작해도 티켓이 통하고, 코드에 고정 비밀이 없다.
// 읽기: 공개 종류(avatar·image)는 서명 없이, 비공개는 서명 주소로만. 쓰기는 늘 서명 + 서명한 content-type + 가장 큰 정책 상한 이하의 몸통.
import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { CopyResult, ObjectInfo, Presign, PresignRequest, StorageDriver } from "./driver.ts"
import { isStorageKey } from "./key.ts"
import { STORAGE_KINDS, STORAGE_POLICY, type StorageKind } from "./policy.ts"
import { presignUrl, verifyPresigned } from "./sigv4.ts"

export interface LocalDriverOptions {
  /** 파일을 두는 폴더(템플릿은 `.tmp/uploads`) */
  dir: string
  /** 경로 앞부분. 기본 `/api/storage/local/` */
  routePrefix?: string
  now?: () => Date
}

export interface LocalDriver extends StorageDriver {
  /** 템플릿 경로 처리기가 요청을 그대로 넘긴다(PUT·GET) */
  handle(request: Request): Promise<Response>
}

// 서명에만 쓰는 가짜 종단점·버킷·지역. 주소는 상대 경로로 내보내므로 호스트는 밖에 보이지 않는다
const SIGN = { endpoint: "http://local.invalid", bucket: "local", region: "local", accessKeyId: "local" } as const
const MAX_BODY = Math.max(...STORAGE_KINDS.map((k) => STORAGE_POLICY[k].maxBytes))
const plain = (status: number) => new Response(null, { status })
/** 내용 태그 — S3 ETag 처럼 같은 내용이면 같고 내용이 바뀌면 달라진다 */
const etagOf = (body: Uint8Array) => `"${createHash("sha256").update(body).digest("hex")}"`

/** `.secret` 를 읽고, 없으면 무작위로 한 번 만든다(동시에 둘이 만들면 먼저 쓴 쪽 것을 쓴다) */
function loadSecret(dir: string): string {
  const file = join(dir, ".secret")
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(file, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e
  }
  return readFileSync(file, "utf8").trim()
}

async function readCapped(body: ReadableStream<Uint8Array> | null): Promise<Buffer | null> {
  if (!body) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of body) {
    size += chunk.length
    if (size > MAX_BODY) return null // for await 를 빠져나가면 스트림이 취소된다
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export function createLocalDriver(o: LocalDriverOptions): LocalDriver {
  const prefix = o.routePrefix ?? "/api/storage/local/"
  const now = o.now ?? (() => new Date())
  const secretAccessKey = loadSecret(o.dir)
  const pathOf = (key: string) => {
    if (!isStorageKey(key)) throw new Error("storage: invalid key")
    return join(o.dir, key)
  }
  const typeOf = async (file: string) => (await readFile(`${file}.type`, "utf8").catch(() => null)) ?? null
  /** 최종 키의 종류. 임시 키(uploads/pending/…)는 어느 종류도 아니라 undefined — 공개로 읽히지 않는다 */
  const kindOf = (key: string): StorageKind | undefined => {
    const head = key.slice(0, key.indexOf("/"))
    return (STORAGE_KINDS as readonly string[]).includes(head) ? (head as StorageKind) : undefined
  }
  const isPublicKey = (key: string) => {
    const kind = kindOf(key)
    return kind !== undefined && STORAGE_POLICY[kind].public
  }

  async function serve(key: string): Promise<Response> {
    const file = pathOf(key)
    const body = await readFile(file).catch(() => null)
    if (!body) return plain(404)
    const isPublic = isPublicKey(key)
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": (await typeOf(file)) ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "content-disposition": isPublic ? "inline" : "attachment",
        "cache-control": "no-store",
      },
    })
  }

  return {
    presign(req: PresignRequest): Presign {
      const signed = presignUrl({ method: req.method, ...SIGN, key: req.key, secretAccessKey, expiresIn: req.expiresIn, now: req.now, pathStyle: true, ...(req.method === "PUT" && req.contentType ? { headers: { "content-type": req.contentType } } : {}) })
      const u = new URL(signed.url)
      return { url: `${prefix}${req.key}${u.search}`, headers: signed.headers, expiresAt: signed.expiresAt }
    },
    async head(key): Promise<ObjectInfo | null> {
      const file = pathOf(key)
      const s = await stat(file).catch(() => null)
      if (!s?.isFile()) return null
      const body = await readFile(file).catch(() => null)
      return body ? { size: body.length, contentType: await typeOf(file), etag: etagOf(body) } : null
    },
    async copy(from, to, opts): Promise<CopyResult> {
      const src = pathOf(from)
      const body = await readFile(src).catch(() => null)
      if (!body) return "missing"
      // 읽은 바이트의 태그가 맞을 때만, 그 바이트를 그대로 쓴다(검사와 복사 사이에 파일이 바뀌어도 검사한 내용만 들어간다)
      if (etagOf(body) !== opts.ifMatch) return "changed"
      const dst = pathOf(to)
      await mkdir(dirname(dst), { recursive: true })
      await writeFile(dst, body)
      await writeFile(`${dst}.type`, (await typeOf(src)) ?? "")
      return "copied"
    },
    async delete(key) {
      const file = pathOf(key)
      await rm(file, { force: true })
      await rm(`${file}.type`, { force: true })
    },
    publicUrl: (key) => `${prefix}${key}`,

    async handle(request) {
      const url = new URL(request.url)
      if (!url.pathname.startsWith(prefix)) return plain(404)
      if (request.method !== "PUT" && request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET, PUT" } })
      let key: string
      try {
        key = decodeURIComponent(url.pathname.slice(prefix.length))
      } catch {
        return plain(404)
      }
      if (request.method === "GET" && !url.searchParams.has("X-Amz-Signature")) {
        if (!isStorageKey(key)) return plain(404)
        return isPublicKey(key) ? serve(key) : plain(403)
      }
      const verified = verifyPresigned({ method: request.method, url: `/${SIGN.bucket}/${url.pathname.slice(prefix.length)}${url.search}`, headers: { "content-type": request.headers.get("content-type") }, ...SIGN, secretAccessKey, now: now() })
      if (!verified.ok) return plain(403)
      if (!isStorageKey(verified.key)) return plain(404)
      if (request.method === "GET") return serve(verified.key)
      if (Number(request.headers.get("content-length")) > MAX_BODY) return plain(413)
      const body = await readCapped(request.body)
      if (!body) return plain(413)
      const file = pathOf(verified.key)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, body)
      await writeFile(`${file}.type`, request.headers.get("content-type") ?? "")
      return plain(200)
    },
  }
}
