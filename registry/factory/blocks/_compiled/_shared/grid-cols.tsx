export function gridCols(n: number, { prefer = [3, 2, 4], max = 4 }: { prefer?: number[]; max?: number } = {}): number {
  if (n <= 1) return 1
  if (n <= 3) return n
  const options = prefer.filter((c) => c <= max)
  for (const c of options) if (n % c !== 1) return c
  return options[0] ?? 3
}
