// tsc 고정물(kits.test.mjs): IconButton 은 label 이 없으면 타입 오류다. 아래 @ts-expect-error 가 「쓰이지 않음」이 되면
// (label 이 선택으로 풀리면) tsc 가 TS2578 로 멈춘다. 이 파일은 저장소 tsconfig 에서 빠진다(fixtures 제외) — 테스트가 따로 돌린다.
import { IconButton } from "@/registry/factory/ui/icon-button"
import { Trash, X } from "@/registry/factory/icons/lucide"

export const named = <IconButton icon={Trash} label="삭제" />

// @ts-expect-error — label 이 없으면 아이콘 버튼에 이름이 없다(WCAG 4.1.2)
export const unnamed = <IconButton icon={X} />
