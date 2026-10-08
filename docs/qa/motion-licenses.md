# 모션 라이브러리 라이선스 표 (P3-1 Task 11, 2026-09-28)

모션 키트 항목 `motion-gsap`(registry/factory/motion — GSAP 장면 훅·기법 도우미)은 npm `gsap`에 의존한다. 폰트처럼 「라이선스를 먼저 확인한다」(DESIGN §14-D)를 따른다.

- **판정:** GSAP 「Standard 'No Charge' License」, 2025-04-30 발효. 코어와 모든 플러그인(이 키트가 쓰는 ScrollTrigger·SplitText·CustomEase 포함)을 상업 용도까지 무료로 쓸 수 있다.
- **제외 조항:** 하나뿐이다. Webflow와 경쟁하는 노코드 시각 애니메이션 빌더에는 쓸 수 없다. web-factory는 코드 레지스트리(설치형 부품·레시피)이고 시각 빌더가 아니므로 해당하지 않는다.
- **확인:**
  - 컨트롤러가 1차 출처 https://gsap.com/licensing/ 를 2026-09-28에 읽었다(Task 11 브리프).
  - 설치한 패키지 자체의 `package.json` 도 확인했다(2026-09-28, `node_modules/gsap/package.json`). `version` 은 `3.15.0`, `license` 는 `Standard 'no charge' license: https://gsap.com/standard-license.` 이다.
- **버전:** `package.json`의 `dependencies.gsap`은 `3.15.0`으로 정확히 고정했다(`^` 없음). `gen-kits.mjs`가 이 값을 레지스트리 항목 `motion-gsap`의 `dependencies`(`gsap@3.15.0`)로 옮긴다. 소비자가 항목을 설치하면 같은 버전이 깔린다.

| 항목 | 라이브러리 | 버전 | 쓰는 플러그인 | 라이선스 | 1차 출처 | 제외 조항 해당 |
|---|---|---|---|---|---|---|
| `block-hero-object-3d-orbit`(FV1 Task 5.7, 쓰는 블록 안에서만 설치) | three.js (`three`) | 0.186.1(정확히 고정, 2026-09-24 게시 — 2026-10-10 기준 16일 된 판; 그 뒤에 게시된 판 없음) | 없음(`WebGLRenderer` + 기본 지오메트리·재질만, 동적 import — 3D 를 켤 때만 내려받는다) | MIT (`npm view` license 필드) | https://www.npmjs.com/package/three · https://github.com/mrdoob/three.js/blob/dev/LICENSE | 해당 없음 |
| `motion-lottie`(선택 설치, FV1 Task 5.6) | dotLottie 재생기 (`@lottiefiles/dotlottie-web`) | 0.80.0(정확히 고정, 2026-08-28 게시 — 2026-10-10 기준 43일 된 판; 최신 0.81.0 은 2026-10-06 게시라 2주가 안 돼 쓰지 않는다) | 없음(동적 import — 쓰는 컴포넌트에서만 내려받는다) | MIT (`npm view` license 필드) | https://www.npmjs.com/package/@lottiefiles/dotlottie-web · https://github.com/LottieFiles/dotlottie-web | 해당 없음 |
| `motion-gsap` | GSAP (`gsap`) | 3.15.0(정확히 고정) | ScrollTrigger · SplitText · CustomEase | Standard 'No Charge' License(2025-04-30 발효) — 상업 무료, 모든 플러그인 포함 | https://gsap.com/licensing/ · https://gsap.com/standard-license | 아니오(코드 레지스트리 — 노코드 시각 빌더 아님) |
