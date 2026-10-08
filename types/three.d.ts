// 저장소 안 typecheck 용 좁은 모듈 선언(FV1 Task 5.7 · 3D-GEN) — 3D 히어로 object-3d-orbit 이 동적 import 로만 부르는 three 와 GLTFLoader·DRACOLoader·RoomEnvironment 가 아직 설치되지 않아도(부모가 병합 뒤 npm install)
// typecheck 가 통과하게 한다. 소비자에게는 나가지 않는다(레지스트리 항목에 없다). three 는 자체 타입이 없어 소비자에 @types/three 가 없어도 빌드되도록 블록이 이 파일 안에서만 느슨하게 받는다.
// 여기서는 모듈이 있다는 사실만 알린다.
declare module "three"
declare module "three/examples/jsm/loaders/GLTFLoader.js"
declare module "three/examples/jsm/loaders/DRACOLoader.js"
declare module "three/examples/jsm/environments/RoomEnvironment.js"
