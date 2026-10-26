// 얹기 단계 등록부 — 한 줄이 블록 하나(run(state, deps) → state). 순서가 실행 순서다.
// 블록을 더하면 모듈 하나를 만들고 아래에 한 줄을 더한다. 규칙 표는 rules.json·url-map.json 에 있다.
import * as catalogFromSite from "./catalogFromSite.mjs"
import * as copy from "./copy.mjs"
import * as cssTheme from "./cssTheme.mjs"
import * as drop from "./drop.mjs"
import * as envLocal from "./envLocal.mjs"
import * as keep from "./keep.mjs"
import * as layoutMerge from "./layoutMerge.mjs"
import * as mergeDeps from "./mergeDeps.mjs"
import * as mergeLines from "./mergeLines.mjs"
import * as packageName from "./packageName.mjs"
import * as plan from "./plan.mjs"
import * as rename from "./rename.mjs"
import * as rootMeta from "./rootMeta.mjs"
import * as replace from "./replace.mjs"
import * as scripts from "./scripts.mjs"
import * as template from "./template.mjs"
import * as urlMap from "./urlMap.mjs"
import * as vendor from "./vendor.mjs"

export const BLOCKS = [
  plan, // 규칙에 없는 파일·url-map 에 없는 충돌을 하나도 쓰기 전에 던진다
  template,
  keep,
  replace,
  copy,
  mergeLines,
  urlMap, // 시안 쪽 가져오기·버리기와 링크 고치기 — replace·copy 가 가져온 파일을 모두 본 뒤에
  rename, // 가져온 시안 파일의 import 를 고치므로 가져오기가 모두 끝난 뒤에
  cssTheme,
  layoutMerge,
  drop, // 고른 기능에 없는 쪽·API·cron 을 지우고 lib/launch/enabled.json 을 쓴다(vendor 는 남은 소스만 훑는다)
  catalogFromSite, // 상점이 켜졌으면 상품표를 시안 products 로 — 켜짐 판정은 drop 과 같은 표를 읽는다
  mergeDeps,
  packageName,
  rootMeta, // 제품 이름·OG 언어 — layoutMerge 가 쓴 layout 과 복사된 copy.en.ts 를 모두 본 뒤에
  scripts,
  vendor,
  envLocal,
]
