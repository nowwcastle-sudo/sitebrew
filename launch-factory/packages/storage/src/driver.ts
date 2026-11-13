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
  /** 객체 내용의 태그(S3 ETag). 같은 내용이면 같고 다시 올려 내용이 바뀌면 달라진다. 알려 주지 않는 저장소는 비운다 */
  etag?: string | null
}

/** copy 결과: copied 복사함 · changed 원본이 ifMatch 와 달라져 복사하지 않음(검사한 뒤 다시 올려 바뀜) · missing 원본이 없음 */
export type CopyResult = "copied" | "changed" | "missing"

export interface StorageDriver {
  /** 짧게 사는 서명 주소를 만든다(순수 — 저장소에 닿지 않는다) */
  presign(req: PresignRequest): Presign
  /** 객체의 실제 크기·형식·etag. 없으면 null */
  head(key: string): Promise<ObjectInfo | null>
  /** 객체를 지운다. 이미 없어도 성공이다 */
  delete(key: string): Promise<void>
  /** 공개 종류(avatar·image)의 읽기 주소 — 서명 없이 닿는 주소 */
  publicUrl(key: string): string
  /**
   * 원본 객체를 대상 키로 복사한다(원본은 그대로). 원본의 etag 가 ifMatch 일 때만 복사한다 — 검사한 바로 그 내용만 최종 키에 들어간다.
   * 복사를 지원하지 않는 드라이버는 이 함수를 비운다: 서비스가 그 드라이버에서는 PUT 키 = 최종 키로 동작한다(복사 없이는 올리기 주소 재사용을 막지 못한다 — 문서 G-storage).
   */
  copy?(from: string, to: string, opts: { ifMatch: string }): Promise<CopyResult>
}
