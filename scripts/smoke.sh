#!/usr/bin/env bash
# Smoke test: build every example program with `--link` in the `size` profile,
# run it, and print a table of binary sizes.
#
#   scripts/smoke.sh [examples-dir]      (default: examples/)
#   npm run smoke                        (builds dist/ first)
#   NISH=build/nish scripts/smoke.sh     with that compiler instead of stage0
#
# NISH names the compiler, run as scripts/nish-compiler.sh says: a native
# `nish` directly and a Node entry point under node. Unset, it is stage0,
# dist/index.js.
#
# A program is any examples/**/*.ts that declares `export const main`. It
# is expected to exit 0 unless it carries a `// smoke: exit <n>` comment; a
# `// smoke: argv <args>` comment passes those arguments on its command line
# (process.argv). The script exits non-zero if any program fails to compile,
# link, or run with the expected status. Binaries and IR go to build/smoke/.
# Needs clang on PATH.
set -uo pipefail
cd "$(dirname "$0")/.."

examples=${1:-examples}
out=build/smoke
mkdir -p "$out"

# shellcheck source=scripts/nish-compiler.sh
. scripts/nish-compiler.sh
nish_compiler "${NISH:-dist/index.js}"

if ! command -v clang >/dev/null 2>&1 && [ -z "${CC:-}" ]; then
  echo "error: smoke test needs clang on PATH (see docs/INSTALL.md)" >&2
  exit 3
fi

# Either spelling declares the entry (docs/wp22-arrow-functions.md): the arrow
# `export const main = (...) => ...` is the form the corpus is written in, and
# `export function main` is still legal.
#
# `mapfile` would say this in one line and is a bash 4 builtin: macOS ships
# bash 3.2 (Apple will not ship GPLv3) and this script runs there too, since
# WP19 G3 wants the matrix on both operating systems. `while read` over the
# same pipeline is the portable spelling, and the process substitution keeps
# the loop out of a subshell so `programs` survives it.
programs=()
while IFS= read -r program; do
  programs+=("$program")
done < <(grep -rl --include='*.ts' -E '^export (function main\b|const main[[:space:]]*=)' "$examples" | sort)
if [ ${#programs[@]} -eq 0 ]; then
  echo "error: no examples with \`export const main\` under $examples" >&2
  exit 1
fi

failed=0
rows=()
for src in "${programs[@]}"; do
  # examples/multi/main.ts -> multi_main; examples/hello.ts -> hello
  name=$(printf '%s' "${src#"$examples"/}" | sed -e 's/\.ts$//' -e 's#/#_#g')
  exe="$out/$name"
  want=$(sed -n 's#^// smoke: exit \([0-9][0-9]*\).*#\1#p' "$src" | head -n 1)
  want=${want:-0}
  # `// smoke: args <flags>` passes extra compiler flags (e.g. --number-mode f64).
  extra=$(sed -n 's#^// smoke: args \(.*\)#\1#p' "$src" | head -n 1)
  # shellcheck disable=SC2086
  if ! "${compiler[@]}" "$src" $extra --link "$exe" --profile size >"$out/$name.log" 2>&1; then
    status="BUILD FAIL"
    failed=1
    sed 's/^/    /' "$out/$name.log" >&2
    rows+=("$(printf '%-24s %10s  %s' "$src" "-" "$status")")
    continue
  fi
  bytes=$(wc -c < "$exe" | tr -d ' ')   # macOS wc pads with spaces

  # `// smoke: argv <args>` is the program's command line (WP7 process.argv).
  argv=$(sed -n 's#^// smoke: argv \(.*\)#\1#p' "$src" | head -n 1)
  # shellcheck disable=SC2086
  "$exe" $argv >"$out/$name.out" 2>"$out/$name.err"
  got=$?
  if [ "$got" -eq "$want" ]; then
    status="ok (exit $got)"
  else
    status="RUN FAIL (exit $got, expected $want)"
    failed=1
    sed 's/^/    /' "$out/$name.err" >&2
  fi
  rows+=("$(printf '%-24s %10s  %s' "$src" "$bytes" "$status")")
done

printf '%-24s %10s  %s\n' PROGRAM BYTES STATUS
printf '%s\n' "${rows[@]}"
if [ "$failed" -ne 0 ]; then
  echo "smoke: FAILED" >&2
  exit 1
fi
echo "smoke: ${#programs[@]} program(s) built (size profile) and ran"
