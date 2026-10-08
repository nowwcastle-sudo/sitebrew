// security-headers.mjs 의 타입 선언 — next.config.ts 가 이 파일을 import 하므로 next build 의 타입 검사가 모듈을 알아야 한다.
export declare const BASE_CSP: string
export declare function securityHeaders(opts?: { dev?: boolean }): { key: string; value: string }[]
export declare function inlineScriptHashes(html: string): string[]
export declare function withScriptHashes(csp: string, hashes: string[]): string
export declare function patchRoutesManifest(manifest: { headers?: { headers?: { key: string; value: string }[] }[] }, hashes: string[]): number
