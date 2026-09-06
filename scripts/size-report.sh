#!/usr/bin/env bash
# Before/after binary size report for a StaticTS module + driver + runtime.
#   scripts/size-report.sh [module.ll] [driver.c]
set -euo pipefail
cd "$(dirname "$0")/.."
ll=${1:-build/add.ll}
driver=${2:-examples/main.c}
mkdir -p build/size
printf '%-8s %10s  %s\n' PROFILE BYTES COMMAND
for p in debug speed size; do
  scripts/build.sh "$ll" runtime/runtime.c "$driver" -o "build/size/app-$p" --profile "$p" >/dev/null
  printf '%-8s %10s  scripts/build.sh %s runtime/runtime.c %s --profile %s\n' \
    "$p" "$(wc -c < "build/size/app-$p")" "$ll" "$driver" "$p"
done
if command -v wasm-ld >/dev/null 2>&1; then
  scripts/build.sh "$ll" -o build/size/app.wasm --profile wasm >/dev/null
  printf '%-8s %10s  scripts/build.sh %s --profile wasm\n' wasm "$(wc -c < build/size/app.wasm)" "$ll"
fi
