#!/usr/bin/env bash
# CI 메모리 실측(P3-8): `start` 는 5초마다 free -m 의 사용·가용(MB)을 .tmp/ci/mem.log 에 쌓고, `report` 는 최고 사용·최저 가용을 낸다(단계 요약에도 쓴다).
set -euo pipefail
LOG=".tmp/ci/mem.log"
case "${1:-}" in
  start)
    mkdir -p .tmp/ci
    : > "$LOG"
    ( while true; do free -m | awk 'NR==2 { printf "%s %s %s\n", strftime("%H:%M:%S"), $3, $7 }' >> "$LOG"; sleep 5; done ) > /dev/null 2>&1 &
    echo "MEM_SAMPLER_PID=$!" >> "${GITHUB_ENV:-/dev/null}"
    ;;
  report)
    if [ -n "${MEM_SAMPLER_PID:-}" ]; then kill "$MEM_SAMPLER_PID" 2>/dev/null || true; fi
    if [ -s "$LOG" ]; then
      peak=$(awk '{ if ($2 > m) m = $2 } END { print m }' "$LOG")
      low=$(awk 'NR == 1 || $3 < l { l = $3 } END { print l }' "$LOG")
      n=$(wc -l < "$LOG")
      echo "peak used memory: ${peak} MB · lowest available: ${low} MB · samples: ${n}"
      if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '### memory\n\npeak used %s MB · lowest available %s MB · %s samples\n' "$peak" "$low" "$n" >> "$GITHUB_STEP_SUMMARY"; fi
    fi
    ;;
  *) echo "사용: mem-sampler.sh start|report" >&2; exit 2 ;;
esac
