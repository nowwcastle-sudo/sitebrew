// 시험 공용 재료 — 메모리 드라이버(가짜 저장소는 어댑터뿐이고 서비스 코드는 진짜다), 가짜 시계.
export const MB = 1024 * 1024

/**
 * 객체는 { size, contentType, body?, etag? }. etag 를 안 주면 내용(body 또는 크기·형식)으로 정한다 — 같은 내용이면 같고 다시 올려 바뀌면 달라진다.
 * put(key, { body, contentType }) 은 서명한 PUT 주소로 올리는 일을 흉내 낸다(키만 맞으면 언제든 덮어쓴다 — 주소는 15분간 살아 있다).
 * copy: false 로 만들면 복사를 못 하는 드라이버(driver.copy 없음)가 된다. beforeCopy 는 head 와 copy 사이에 끼어드는 시험용 고리다.
 */
export function memoryDriver({ failDelete = false, failPresign, copy = true } = {}) {
  const objects = new Map()
  const calls = { presign: [], delete: [], head: [], copy: [] }
  const etagOf = (o) => o.etag ?? `"${o.body !== undefined ? Buffer.from(o.body).toString("hex") : `${o.size}:${o.contentType}`}"`
  const driver = {
    objects,
    calls,
    beforeCopy: null,
    put(key, { body, contentType }) {
      const bytes = Buffer.from(body)
      objects.set(key, { size: bytes.length, contentType, body: bytes })
    },
    presign(req) {
      calls.presign.push(req)
      if (failPresign) throw failPresign
      return { url: `https://mem.test/${req.key}?m=${req.method}&e=${req.expiresIn}`, headers: req.contentType ? { "content-type": req.contentType } : {}, expiresAt: new Date(req.now.getTime() + req.expiresIn * 1000) }
    },
    async head(key) {
      calls.head.push(key)
      const o = objects.get(key)
      return o ? { size: o.size, contentType: o.contentType, etag: etagOf(o) } : null
    },
    async delete(key) {
      calls.delete.push(key)
      if (failDelete) throw new Error("boom")
      objects.delete(key)
    },
    publicUrl: (key) => `https://cdn.test/${key}`,
  }
  if (copy) {
    driver.copy = async (from, to, { ifMatch }) => {
      calls.copy.push([from, to, ifMatch])
      await driver.beforeCopy?.(from)
      const o = objects.get(from)
      if (!o) return "missing"
      if (etagOf(o) !== ifMatch) return "changed"
      objects.set(to, { ...o })
      return "copied"
    }
  }
  return driver
}

export function clock(iso) {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
