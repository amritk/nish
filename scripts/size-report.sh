#!/usr/bin/env bash
# Before/after binary size report for an AmritScript module + driver + runtime.
#   scripts/size-report.sh [--markdown] [module.ll] [driver.c]
#
# Prints the runtime.c budget row (its -Oz text size) and one row per build
# profile (debug, speed, size, and wasm when wasm-ld is available). --markdown
# emits a GitHub-flavoured table, used by CI for the job summary; the default
# is a plain aligned table. Linux and macOS.
set -euo pipefail
cd "$(dirname "$0")/.."

format=plain
args=()
for a in "$@"; do
  case "$a" in
    --markdown|--md) format=markdown ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) args+=("$a") ;;
  esac
done
ll=${args[0]:-build/add.ll}
driver=${args[1]:-examples/main.c}
mkdir -p build/size

bytes() { wc -c < "$1" | tr -d ' '; }   # macOS wc pads with spaces
row() {                                  # row <profile> <bytes> <command>
  if [ "$format" = markdown ]; then
    printf '| `%s` | %s | `%s` |\n' "$1" "$2" "$3"
  else
    printf '%-8s %10s  %s\n' "$1" "$2" "$3"
  fi
}

if [ "$format" = markdown ]; then
  printf '| Profile | Bytes | Command |\n| --- | ---: | --- |\n'
else
  printf '%-8s %10s  %s\n' PROFILE BYTES COMMAND
fi
# The runtime budget (docs/MASTER_PLAN.md section 2): `runtime.c` compiled alone at -Oz, the
# `text` column of `size` (code + read-only constants + unwind entries), must stay under 4 KB.
"${CC:-clang}" -Oz -c runtime/runtime.c -o build/size/runtime.o
row runtime "$(size build/size/runtime.o | awk 'NR == 2 { print $1 }')" "clang -Oz -c runtime/runtime.c && size runtime.o (text; budget 4096)"
for p in debug speed size; do
  scripts/build.sh "$ll" runtime/runtime.c "$driver" -o "build/size/app-$p" --profile "$p" >/dev/null
  row "$p" "$(bytes "build/size/app-$p")" "scripts/build.sh $ll runtime/runtime.c $driver --profile $p"
done
# The wasm profile needs wasm-ld; ask clang where it would look (it checks its own
# bin dir before PATH). Skip the row when the linker is not installed.
if [ -x "$("${CC:-clang}" -print-prog-name=wasm-ld)" ]; then
  scripts/build.sh "$ll" -o build/size/app.wasm --profile wasm >/dev/null
  row wasm "$(bytes build/size/app.wasm)" "scripts/build.sh $ll --profile wasm"
fi
