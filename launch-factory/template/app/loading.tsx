import { StateScreenLoading } from "@/components/blocks/state-screen/loading"
import { loadingCopy } from "@/content/copy.shell.en"

// 쪽을 불러오는 동안(H01). 조용히 비워 두지 않는다 — web-factory v0.0.10 블록 `state-screen/loading`: 뼈대 줄 + 읽는 도구에 읽히는 「Loading」(role=status, 뿌리 aria-busy).
// 서버 컴포넌트·style 속성 없음(엄격 CSP 안전)이고 자바스크립트 없이도 그려진다. 뼈대의 깜빡임은 동작 줄이기를 따른다(블록의 skeleton 부품).
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <StateScreenLoading copy={loadingCopy} />
    </div>
  )
}
