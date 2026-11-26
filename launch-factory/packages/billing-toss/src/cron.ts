/** 인증은 앱의 기존 cron 규약이 맡는다. 서비스가 없는 경우 외부 호출을 하지 않는다. */
export async function handleTestTossCron(request: Request, authorized: (request: Request) => boolean, service: () => Promise<{ productId: string; ledger: { runDueBatch(productId: string, limit: number): Promise<unknown> } } | null>): Promise<Response> {
  const headers = { "Cache-Control": "no-store" }
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401, headers })
  try {
    const current = await service()
    if (!current) return Response.json({ status: "unavailable" }, { status: 404, headers })
    return Response.json(await current.ledger.runDueBatch(current.productId, 20), { headers })
  } catch { return Response.json({ status: "unavailable" }, { status: 503, headers }) }
}
