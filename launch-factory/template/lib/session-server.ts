// 서버 컴포넌트가 지금 세션을 읽는 한 곳(B02·B04). 한 요청 안에서 layout·page 가 함께 물어도 한 번만 읽는다(React cache).
// 세션이 없거나 읽기에 실패하면 null — 로그아웃·만료와 같게 다룬다(화면은 로그인 안내를 보인다).
import { cache } from "react"
import { session } from "@/app/actions/product"

export const currentSession = cache(async () => {
  const s = await session().catch(() => null)
  return s?.ok && s.data ? s.data : null
})
