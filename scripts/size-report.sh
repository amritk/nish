#!/usr/bin/env bash
# Before/after binary size report for an Nish module + driver + runtime.
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
    printf '%-10s %10s  %s\n' "$1" "$2" "$3"
  fi
}

if [ "$format" = markdown ]; then
  printf '| Profile | Bytes | Command |\n| --- | ---: | --- |\n'
else
  printf '%-10s %10s  %s\n' PROFILE BYTES COMMAND
fi
# The runtime budgets (docs/wp7-runtime.md, "Runtime additions and budget"): each of the two
# runtime translation units compiled alone at -Oz, the sum of its `.text*` sections, against
# its own ceiling. The gate is `node tests/run.js budget`; this row is the same number for a
# reader. It was reported here as the `text` *column* of `size` instead, which also counts
# `.rodata` and the `.eh_frame` entries the size profile strips -- so this row read 4,696
# against a 4,096 budget while the code it is about was at 2,775. Read-only data ships too, so
# it gets its own row rather than being folded in: Ryu's two power-of-five tables are 9,888
# bytes of it, and section GC keeps them out of any binary that never formats a double (WP15).
# `.text.unlikely.` is summed with `.text` because a linked binary pays for both, and a ceiling
# on `.text` alone can be met by moving code to another section instead of by shrinking it.
text_sum() {                             # text_sum <object>: every .text* section, summed
  size -A "$1" | awk '$1 ~ /^\.text/ { n += $2 } END { print n + 0 }'
}
sect() { size -A "$2" | awk -v s="$1" '$1 == s { print $2 }'; }
"${CC:-clang}" -Oz -c runtime/runtime.c -o build/size/runtime.o
"${CC:-clang}" -Oz -c runtime/runtime_os.c -o build/size/runtime_os.o
row runtime "$(text_sum build/size/runtime.o)" \
  "clang -Oz -c runtime/runtime.c && size -A (.text*; budget 3584)"
row runtime_os "$(text_sum build/size/runtime_os.o)" \
  "clang -Oz -c runtime/runtime_os.c && size -A (.text*; budget 1280)"
row rodata "$(sect .rodata build/size/runtime.o)" "the core object's .rodata (no budget; the Ryu tables live here)"
# `scripts/build.sh` compiles runtime_os.c beside any runtime.c it is handed, so naming the
# core here builds the whole runtime -- and `--gc-sections` then drops whatever this module
# never calls, which for `examples/add.ts` is all of it.
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
