// 본문 상한 시험 공용 견본(CWE-400). 스트림 본문을 청크로 흘리고, 라우트가 지금까지 몇 바이트를 뽑아 갔는지 센다.
//   수정 전 코드는 request.text()/json()/formData() 가 스트림 끝까지 뽑아 가고(pulled === total), 수정 후에는 상한 근처에서 멈춘다.
export const CHUNK = 16 * 1024

/**
 * total 바이트를 CHUNK 씩 흘리는 POST 요청. pull 방식이라 읽는 쪽이 뽑아 간 만큼만 만들어진다(미리 쌓지 않는다 — highWaterMark 0).
 * headers 에 content-length 를 주면 그 값이 선언 길이다(작게 속이는 것도 시험할 수 있다). 주지 않으면 chunked 와 같다.
 */
export function streamPost(total, { url = "https://x.test/api/in", type = "application/json", headers = {}, fill = 97 } = {}) {
  let pulled = 0
  const body = new ReadableStream(
    {
      pull(controller) {
        if (pulled >= total) return controller.close()
        const n = Math.min(CHUNK, total - pulled)
        pulled += n
        controller.enqueue(new Uint8Array(n).fill(fill))
      },
    },
    { highWaterMark: 0 },
  )
  const req = new Request(url, { method: "POST", body, duplex: "half", headers: { "content-type": type, ...headers } })
  return { req, pulled: () => pulled }
}
