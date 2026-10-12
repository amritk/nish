#!/usr/bin/env bash
# Before/after binary size report for an Nish module + driver + runtime.
#   scripts/size-report.sh [--markdown] [--budgets] [module.ll] [driver.c]
#
# Prints one row per runtime .text* budget the gate measures, with its ceiling
# (from tests/runtime-budgets.js), the core's .rodata, and one row per build
# profile (debug, speed, size, and wasm when wasm-ld is available). --budgets
# stops after the runtime rows. --markdown emits a GitHub-flavoured table, used
# by CI for the job summary; the default is a plain aligned table. Linux and macOS.
set -euo pipefail
cd "$(dirname "$0")/.."

format=plain
budgets_only=0
args=()
for a in "$@"; do
  case "$a" in
    --markdown|--md) format=markdown ;;
    --budgets) budgets_only=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
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
    printf '%-36s %10s  %s\n' "$1" "$2" "$3"
  fi
}

if [ "$format" = markdown ]; then
  printf '| Profile | Bytes | Command |\n| --- | ---: | --- |\n'
else
  printf '%-36s %10s  %s\n' PROFILE BYTES COMMAND
fi
# The runtime budgets (docs/wp7-runtime.md, "Runtime additions and budget"): each runtime
# translation unit, in each configuration the gate measures, compiled alone at -Oz, the sum
# of its `.text*` sections, against its own ceiling. The gate is `node tests/run.js
# runtime-budget`; these rows are the same numbers for a reader, and the rows and their
# ceilings come from the table the gate reads, tests/runtime-budgets.js, because the two
# ceilings this script once wrote into its own labels stayed at 3,584 and 1,280 while the
# gate's moved to 3,606 and 1,536, and seven of the gate's nine rows were never here.
# `tests/run.js` checks that every row is printed, with its ceiling and the gate's number.
#
# It was reported here as the `text` *column* of `size` once, which also counts `.rodata`
# and the `.eh_frame` entries the size profile strips -- so this row read 4,696 against a
# 4,096 budget while the code it is about was at 2,775. Read-only data ships too, so it
# gets its own row rather than being folded in: Ryu's two power-of-five tables are 9,888
# bytes of it, and section GC keeps them out of any binary that never formats a double (WP15).
# `.text.unlikely.` is summed with `.text` because a linked binary pays for both, and a ceiling
# on `.text` alone can be met by moving code to another section instead of by shrinking it.
text_sum() {                             # text_sum <object>: every .text* section, summed
  size -A "$1" | awk '$1 ~ /^\.text/ { n += $2 } END { print n + 0 }'
}
sect() { size -A "$2" | awk -v s="$1" '$1 == s { print $2 }'; }
budgets=$(node tests/runtime-budgets.js)
while IFS=$'\t' read -r label src budget constant flags; do
  obj="build/size/$(printf '%s' "$label" | tr -c 'A-Za-z0-9' _).o"
  # shellcheck disable=SC2086 # the flags are words
  "${CC:-clang}" -Oz $flags -c "$src" -o "$obj"
  row "$label" "$(text_sum "$obj")" \
    "clang -Oz ${flags:+$flags }-c $src && size -A (.text*; budget $budget, $constant)"
done <<< "$budgets"
row rodata "$(sect .rodata build/size/runtime_c.o)" "the core object's .rodata (no budget; the Ryu tables live here)"
if [ "$budgets_only" = 1 ]; then exit 0; fi
# `scripts/build.sh` compiles runtime-os.c beside any runtime.c it is handed, so naming the
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
