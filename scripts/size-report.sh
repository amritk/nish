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
    printf '%-8s %10s  %s\n' "$1" "$2" "$3"
  fi
}

if [ "$format" = markdown ]; then
  printf '| Profile | Bytes | Command |\n| --- | ---: | --- |\n'
else
  printf '%-8s %10s  %s\n' PROFILE BYTES COMMAND
fi
# The runtime budget (docs/MASTER_PLAN.md section 2): `runtime.c` compiled alone at -Oz, its
# `.text` section, must stay under 4 KB. That section is what the note names, and it was
# reported here as the `text` *column* of `size` instead, which also counts `.rodata` and the
# `.eh_frame` entries the size profile strips -- so this row read 4,696 against a 4,096 budget
# while the section it is about was at 2,775. Read-only data ships too, so it gets its own row
# rather than being folded in: Ryu's two power-of-five tables are 9,888 bytes of it, and section
# GC keeps them out of any binary that never formats a double (WP15).
"${CC:-clang}" -Oz -c runtime/runtime.c -o build/size/runtime.o
sect() { size -A build/size/runtime.o | awk -v s="$1" '$1 == s { print $2 }'; }
row runtime "$(sect .text)" "clang -Oz -c runtime/runtime.c && size -A runtime.o (.text; budget 4096)"
row rodata "$(sect .rodata)" "the same object's .rodata (no budget; the Ryu tables live here)"
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
