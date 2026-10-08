// icon-label 고정물(lint-ui.test.mjs): 줄 번호가 기대값이다 — 줄을 옮기면 테스트도 고친다.
export const bad = [
  <Button size="icon"><XIcon /></Button>,
  <Button size={"icon-sm"}><XIcon /></Button>,
  <Button size={`icon-xs`}><XIcon /></Button>,
  <Button size={size}><XIcon /></Button>,
  <Prim.Clear render={render ?? <Button size={size} />}><XIcon /></Prim.Clear>,
]
export const good = [
  <Button size={"sm"}>저장</Button>,
  <div data-size={size} />,
  <Button size={size} aria-label="닫기"><XIcon /></Button>,
  <Prim.Close render={render ?? <Button size={size} />}><XIcon /><span className="sr-only">닫기</span></Prim.Close>,
  <Button size={size} /* icon-label: 쪽 번호 글자가 children 으로 온다 */ {...props} />,
]
