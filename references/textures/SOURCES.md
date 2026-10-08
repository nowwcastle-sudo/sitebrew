> **Public export note.** The six Pexels photos and the six stamps derived from them listed below are NOT included in this repository (redistribution terms not confirmed). Only the two self-made grain masks (`glass-grain-{light,dark}.webp`) are present. Texture axis values X4~X8 therefore render without their photo layer until you add your own photos with the same file names.

# 질감 자산 출처

`references/textures/*.webp` 와 그 사본 `public/textures/*.webp` 의 출처다(사본이 같은 바이트인지는 `factory/scripts/texture-assets.test.mjs` 가 본다). 제3자 Pinterest·X·Instagram 이미지는 어디에도 쓰지 않았다. Higgsfield 생성도 쓰지 않았다. 파일마다 120 KB 이하다(시험이 본다).

## Pexels 사진 6장 (Pexels License — 출처 표기 없이 상업 이용 가능, 이 문서로 표기)

| 파일 | 쓰임 | Pexels 주소 | 촬영자 | 가공 |
|---|---|---|---|---|
| `cardboard-a.webp` (#16549277) | X4 골판지 A 면 · X6 라벨 종이 섬유 | https://www.pexels.com/photo/close-up-of-cardboard-canvas-surface-16549277/ | sergeispas | 잘라내기·크기 줄이기·WebP 손실 압축 |
| `cardboard-b.webp` (#479450) | X5 골판지 B 겉면 | https://www.pexels.com/photo/brown-cardboard-479450/ | icon0 com | 〃 |
| `cardboard-c.webp` (#18654893) | X6 골판지 C 상자 면 | https://www.pexels.com/photo/close-up-of-cardboard-surface-18654893/ | Heather Green | 〃 |
| `cardboard-edge.webp` (#1555199) | X5 위쪽 띠 · X6 아래쪽 띠(골판 단면) | https://www.pexels.com/photo/brown-and-black-cloth-1555199/ | Aleksandar Pasaric | 띠 한 줄만 잘라내기·WebP |
| `glass-a.webp` (#20886322) | X7 간유리 A 뒤 사진(튤립) | https://www.pexels.com/photo/selective-focus-on-tulips-20886322/ | Ruts Vakulenko | 잘라내기·크기 줄이기·WebP 손실 압축 |
| `glass-b.webp` (#20779987) | X8 간유리 B 뒤 사진(홍콩 밤거리) | https://www.pexels.com/photo/red-taxi-on-street-in-hong-kong-at-night-20779987/ | Margarita K | 〃 |

가공은 잘라내기·크기 줄이기·WebP 압축뿐이고 색 보정은 하지 않았다. 어두운 면의 밝기 낮춤은 CSS 필터로 건다. 간유리 C(#788716, Jacqueline Smith)는 운영자가 제외해 이 저장소에 없다.

## 직접 만든 자산 (제3자 이미지 없음 — 위 Pexels 사진에서 파생한 알파 마스크)

| 파일 | 만든 방법 |
|---|---|
| `cardboard-stamp-{a,b,c}-{light,dark}.webp` | PIL 로 그린 도장 모양(Malgun Gothic Bold · Arial Bold · Impact) 위에 `cardboard-a` 사진의 섬유 고주파 성분으로 잉크 빠짐을 만든 알파 마스크에, 잉크색(라이트 `#5a3318`·다크 `#f1d9b4`)과 불투명도(라이트 0.8·0.8·0.82 / 다크 0.75·0.75·0.7)를 구워 넣은 WebP |
| `glass-grain-{light,dark}.webp` | 모래분사 같은 미세 구멍(여러 크기 가우시안 노이즈와 드문 점) 192×192 알파 마스크, 가장자리를 감아 타일 이음이 없다. 라이트는 검정(불투명도 0.07), 다크는 흰색(0.07)을 구웠다 |

## 쓰는 법

CSS 는 `url(/textures/<파일>.webp)` 로 부른다 — 이 저장소의 검수대는 `public/textures/` 에서 서빙하고, 소비자는 `references/textures/*.webp`(또는 `public/textures/`)를 자기 `public/textures/` 로 복사한다(shadcn registry 는 이진 파일을 실을 수 없다). 파일이 없으면 사진 층만 빠지고 레시피 `card` 색 면이 남아 글자 대비는 지켜진다(이 경우 사진 질감은 그리지 못한다).
