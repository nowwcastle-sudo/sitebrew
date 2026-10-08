export const EASES = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)", // 기본
  "in-out-whip": "cubic-bezier(0.76, 0, 0.24, 1)",
} as const
export type EaseName = keyof typeof EASES

export const TECH = {
  kinetic: { chars: 0.025 },
  stagger: { each: 0.06, perItem: 0.6 },
  whip: { total: 0.36 },
} as const
