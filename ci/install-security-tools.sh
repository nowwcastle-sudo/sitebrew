#!/usr/bin/env bash
# 보안 점검 도구 4종을 고정 버전·SHA-256 으로 내려받는다(P3-8). 체크섬이 다르면 즉시 실패한다 — 액션이 아니라 바이너리를 직접 쓰는 이유는 security.md §1-A.
# 해시 출처: GitHub 릴리스 API 의 asset digest 와, 있는 것은 메인테이너의 체크섬 파일(gitleaks_*_checksums.txt · osv-scanner_SHA256SUMS · actionlint_*_checksums.txt)을 대조했다(2026-10-05).
# 버전을 올릴 때는 이 파일의 VERSION·SHA 를 같이 고친다(Dependabot 이 못 본다 — 분기에 한 번 운영자가 확인).
set -euo pipefail

BIN="${RUNNER_TEMP:-/tmp}/sectools/bin"
mkdir -p "$BIN"

fetch() { # <이름> <URL> <sha256> <tar|raw> <압축 안 파일>
  local name="$1" url="$2" sha="$3" kind="$4" member="${5:-}"
  local tmp; tmp="$(mktemp)"
  curl --fail --silent --show-error --location --retry 3 "$url" --output "$tmp"
  echo "$sha  $tmp" | sha256sum --check --status || { echo "::error::체크섬 불일치: $name ($url)"; exit 1; }
  if [ "$kind" = tar ]; then tar -xzf "$tmp" -C "$BIN" "$member"; else install -m 0755 "$tmp" "$BIN/$name"; fi
  rm -f "$tmp"
  echo "설치: $name (sha256 확인됨)"
}

fetch gitleaks   "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz" 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb tar gitleaks
fetch osv-scanner "https://github.com/google/osv-scanner/releases/download/v2.6.0/osv-scanner_linux_amd64" ca69b3d3cd08f889a49dc0a383122f71cc528b83803671df5fd874d97485b108 raw
fetch zizmor     "https://github.com/zizmorcore/zizmor/releases/download/v1.30.1/zizmor-x86_64-unknown-linux-gnu.tar.gz" e65324f4430c2717591937edcec90ccbefaf14c174f8ec9415e03ca875b46e1a tar zizmor
fetch actionlint "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz" 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 tar actionlint

if [ -n "${GITHUB_PATH:-}" ]; then echo "$BIN" >> "$GITHUB_PATH"; fi
"$BIN/gitleaks" version
"$BIN/osv-scanner" --version
"$BIN/zizmor" --version
"$BIN/actionlint" -version
