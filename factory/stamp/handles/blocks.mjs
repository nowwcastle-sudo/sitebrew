// 손잡이 갈래 → 블록 모듈 등록부 — 갈래 목록이 있는 유일한 곳이다(한 줄에 하나). 새 갈래는 모듈을 만들고 여기에 한 줄을 더한다.
//   handles.mjs 가 loadHandles 에서 이 목록으로 배선의 kind 를 검사하고, index.mjs 가 stepHead 에서 이 목록으로 블록을 부른다.
//   블록은 handles.mjs 를 읽지 않으므로(손잡이는 인자로 받는다) 이 파일을 handles.mjs 가 읽어도 순환 import 가 없다.
import * as order from './order.mjs'
import * as rank from './rank.mjs'
import * as palette from './palette.mjs'
import * as value from './value.mjs'

export const BLOCKS = { order, rank, palette, value }
