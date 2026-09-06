#!/usr/bin/env bash
# Smoke test: build every example program with `--link` in the `size` profile,
# run it, and print a table of binary sizes.
#
#   scripts/smoke.sh [examples-dir]      (default: examples/)
#   npm run smoke                        (builds dist/ first)
#
# A program is any examples/**/*.ts that declares `export function main`. It
# is expected to exit 0 unless it carries a `// smoke: exit <n>` comment. The
# script exits non-zero if any program fails to compile, link, or run with the
# expected status. Binaries and IR go to build/smoke/. Needs clang on PATH.
set -uo pipefail
cd "$(dirname "$0")/.."

examples=${1:-examples}
out=build/smoke
mkdir -p "$out"

if ! command -v clang >/dev/null 2>&1 && [ -z "${CC:-}" ]; then
  echo "error: smoke test needs clang on PATH (see docs/INSTALL.md)" >&2
  exit 3
fi

mapfile -t programs < <(grep -rl --include='*.ts' -E '^export function main\b' "$examples" | sort)
if [ ${#programs[@]} -eq 0 ]; then
  echo "error: no examples with \`export function main\` under $examples" >&2
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

  if ! node dist/index.js "$src" --link "$exe" --profile size >"$out/$name.log" 2>&1; then
    status="BUILD FAIL ($?)"
    failed=1
    sed 's/^/    /' "$out/$name.log" >&2
    rows+=("$(printf '%-24s %10s  %s' "$src" "-" "$status")")
    continue
  fi
  bytes=$(wc -c < "$exe" | tr -d ' ')   # macOS wc pads with spaces

  "$exe" >"$out/$name.out" 2>"$out/$name.err"
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
