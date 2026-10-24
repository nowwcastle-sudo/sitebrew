// 저장소 드라이버 — 서비스가 아는 입출력 구멍은 이 인터페이스 하나다(어댑터: driver-s3.ts · driver-local.ts). 서비스는 어떤 저장소인지 모른다.
export interface PresignRequest {
  method: "PUT" | "GET"
  key: string
  /** PUT 일 때 서명에 넣을 형식 — 올리는 쪽이 같은 content-type 머리를 보내야 한다 */
  contentType?: string
  /** 초 */
  expiresIn: number
  now: Date
}

export interface Presign {
  url: string
  /** 요청에 그대로 실어야 하는 머리 */
  headers: Record<string, string>
  expiresAt: Date
}

export interface ObjectInfo {
  size: number
  contentType: string | null
}

export interface StorageDriver {
  /** 짧게 사는 서명 주소를 만든다(순수 — 저장소에 닿지 않는다) */
  presign(req: PresignRequest): Presign
  /** 객체의 실제 크기·형식. 없으면 null */
  head(key: string): Promise<ObjectInfo | null>
  /** 객체를 지운다. 이미 없어도 성공이다 */
  delete(key: string): Promise<void>
  /** 공개 종류(avatar·image)의 읽기 주소 — 서명 없이 닿는 주소 */
  publicUrl(key: string): string
}
