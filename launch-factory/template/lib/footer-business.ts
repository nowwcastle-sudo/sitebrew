import { businessInfo } from "@launch-factory/env"
import type { FooterBusiness } from "@/components/blocks/footer/product-legal"

// 바닥글 사업자 정보(K03)의 값 출처 한 곳. **값은 제품 설정에서 읽는다** — LF_BUSINESS_*·LF_MAIL_ORDER_NO·LF_HOSTING_PROVIDER 환경 변수(@launch-factory/env businessInfo).
// 공장 코드·문구 파일·시험에 실제 상호·번호·전화를 넣지 않는다(남도 쓰는 공장 — 대표 10-03). 비었거나 공백뿐인 칸은 businessInfo 가 없는 것으로 돌려주고, 블록이 값이 있는 칸만 그린다.
/** 설정의 칸 이름(regNo)을 블록의 칸 이름(registrationNo)으로 옮긴다 — 값은 그대로, 없는 칸은 없다 */
export function footerBusiness(env: Record<string, string | undefined> = process.env): FooterBusiness {
  const b = businessInfo(env)
  return { name: b.name, owner: b.owner, address: b.address, phone: b.phone, email: b.email, registrationNo: b.regNo, mailOrderNo: b.mailOrderNo, hostingProvider: b.hostingProvider }
}
