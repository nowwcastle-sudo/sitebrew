// 시험 공용 재료 — 메모리 드라이버(가짜 저장소는 어댑터뿐이고 서비스 코드는 진짜다), 가짜 시계.
export const MB = 1024 * 1024

export function memoryDriver({ failDelete = false, failPresign } = {}) {
  const objects = new Map()
  const calls = { presign: [], delete: [], head: [] }
  return {
    objects,
    calls,
    presign(req) {
      calls.presign.push(req)
      if (failPresign) throw failPresign
      return { url: `https://mem.test/${req.key}?m=${req.method}&e=${req.expiresIn}`, headers: req.contentType ? { "content-type": req.contentType } : {}, expiresAt: new Date(req.now.getTime() + req.expiresIn * 1000) }
    },
    async head(key) {
      calls.head.push(key)
      return objects.get(key) ?? null
    },
    async delete(key) {
      calls.delete.push(key)
      if (failDelete) throw new Error("boom")
      objects.delete(key)
    },
    publicUrl: (key) => `https://cdn.test/${key}`,
  }
}

export function clock(iso) {
  const c = { at: new Date(iso) }
  c.now = () => c.at
  c.tick = (ms) => (c.at = new Date(c.at.getTime() + ms))
  return c
}
