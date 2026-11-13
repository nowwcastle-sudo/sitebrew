// 문의 본문을 크기 제한 안에서만 읽는다(보안 E · WF-4). 예전에는 request.text() 로 전체를 읽은 뒤에 크기를 쟀다 — 큰 본문을 동시에 보내면
// 검사 전에 메모리·시간이 먼저 든다. 여기서는 ① content-length 가 숫자이고 한도를 넘으면 본문을 읽지 않고 거절하고
// ② 헤더가 없거나 거짓이어도 스트림을 바이트 수로 세다가 한도를 넘는 순간 reader.cancel() 로 끊는다.
// route.ts 는 Next 가 정한 이름(POST·runtime·dynamic …)만 내보낼 수 있어 이 함수를 따로 둔다(소개형 전달물에 route.ts 와 같이 복사된다 — deliver-intro.mjs).
export type CappedBody = { ok: true; text: string } | { ok: false; reason: "tooBig" | "badBody" }

export async function readCapped(request: Request, max: number): Promise<CappedBody> {
  const declared = request.headers.get("content-length")
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared.trim()) > max) {
    request.body?.cancel().catch(() => {})
    return { ok: false, reason: "tooBig" }
  }
  const body = request.body
  if (!body) return { ok: false, reason: "badBody" }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > max) {
        await reader.cancel().catch(() => {})
        return { ok: false, reason: "tooBig" }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: "badBody" }
  }
  const all = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.byteLength
  }
  return { ok: true, text: new TextDecoder().decode(all) }
}
