// 사실 자리 표시 글자(J12, 대장 C102) — mjs 쪽 정본은 factory/legal/drafts.mjs 의 PLACEHOLDER 하나다.
// TS 쪽 정본(content-core NEEDS_CHECK·NEEDS_CHECK_EN)과 같은 글자여야 하고, 시험(stamp-pages)이 둘을 맞춰 본다.
import { PLACEHOLDER } from '../legal/drafts.mjs'

export const NEEDS_CHECK_LITERALS = Object.values(PLACEHOLDER)
/** 값이 자리 표시 글자(앞뒤 공백 무시)인가. */
export const isNeedsCheck = (v) => typeof v === 'string' && NEEDS_CHECK_LITERALS.includes(v.trim())
