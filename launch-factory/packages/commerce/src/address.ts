// 배송지 검사 — 순수 함수. 칸마다 문제 이름(required·invalid·too_long)만 돌려주고, 사람 글은 포트가 i18n 에서 읽는다.
// 알려진 칸만 남긴다(입력의 다른 칸은 버린다). 앞뒤 공백은 자른다.
import type { ShippingAddress } from "@launch-factory/contract"
import { ADDRESS_LIMITS } from "./rules.ts"

export type AddressProblem = "required" | "invalid" | "too_long"
export type AddressCheck = { ok: true; address: ShippingAddress } | { ok: false; fields: Partial<Record<keyof ShippingAddress, AddressProblem>> }

const PHONE = /^\+?[\d\s\-().]+$/
const POSTCODE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/

const own = (o: Record<string, unknown>, k: string): string | undefined => {
  const v = Object.hasOwn(o, k) ? o[k] : undefined
  return typeof v === "string" ? v.trim() : undefined
}

export function checkAddress(input: unknown): AddressCheck {
  const fields: Partial<Record<keyof ShippingAddress, AddressProblem>> = {}
  const o = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const out: Partial<ShippingAddress> = {}

  const take = (key: keyof ShippingAddress, required: boolean, valid?: (v: string) => boolean) => {
    const v = own(o, key)
    if (!v) {
      if (required) fields[key] = "required"
      return
    }
    if (v.length > ADDRESS_LIMITS[key]) fields[key] = "too_long"
    else if (valid && !valid(v)) fields[key] = "invalid"
    else out[key] = v
  }
  take("recipient", true)
  take("phone", true, (v) => PHONE.test(v) && /^\d{8,15}$/.test(v.replace(/\D/g, "")))
  take("postcode", true, (v) => POSTCODE.test(v))
  take("address1", true)
  take("address2", false)
  take("note", false)

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return { ok: true, address: out as ShippingAddress }
}
