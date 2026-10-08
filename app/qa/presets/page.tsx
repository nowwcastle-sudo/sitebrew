// /qa/presets — 스타일 프리셋 접촉 시트(P3-2 Task 16a). ?p=<프리셋 id> 면 그 칸만. 칸 그리기는 클라이언트 조각 sheet.tsx(컴파일된 부품이 base-ui 를 쓴다).
import { PresetSheet } from "./sheet"

export default async function QaPresetsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams
  return <PresetSheet only={p} />
}
