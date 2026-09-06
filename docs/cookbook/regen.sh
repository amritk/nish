#!/usr/bin/env bash
# Regenerate the IR listings in docs/IR_COOKBOOK.md from docs/cookbook/*.ts.
#
#   docs/cookbook/regen.sh            compile every snippet and rewrite the doc
#   docs/cookbook/regen.sh --check    compile, but only report whether the doc
#                                     is up to date (exit 1 when it is not)
#
# Every snippet `docs/cookbook/<name>.ts` is compiled with
# `node dist/index.js <name>.ts -o build/cookbook/<name>/ [flags]`, where the
# flags come from `docs/cookbook/<name>.args` when that file exists. The module
# header (`; ModuleID`, `source_filename`) is stripped exactly as tests/run.js
# does for the goldens, and the result replaces everything between
#
#   <!-- cookbook:begin <name> -->
#   <!-- cookbook:end <name> -->
#
# in the doc: the flags line (if any), the TypeScript source in a ```ts fence,
# and the IR in a ```llvm fence. A snippet with no marker is reported and
# skipped; a marker with no snippet is an error. Needs Node only (no LLVM).
set -euo pipefail
cd "$(dirname "$0")/../.."

check=0
[ "${1:-}" = "--check" ] && check=1

doc=docs/IR_COOKBOOK.md
out=build/cookbook
mkdir -p "$out"
[ -f dist/index.js ] || npm run build >/dev/null

tmp="$out/IR_COOKBOOK.md.new"
cp "$doc" "$tmp"
status=0

for src in docs/cookbook/*.ts; do
  name=$(basename "$src" .ts)
  args=()
  if [ -f "docs/cookbook/$name.args" ]; then
    read -ra args < "docs/cookbook/$name.args"
  fi
  mkdir -p "$out/$name"
  if ! node dist/index.js "$src" -o "$out/$name/" "${args[@]}" >"$out/$name.log" 2>&1; then
    echo "error: $src does not compile:" >&2
    sed 's/^/  /' "$out/$name.log" >&2
    exit 1
  fi
  ll="$out/$name/$name.ll"
  block="$out/$name.md"
  {
    if [ ${#args[@]} -gt 0 ]; then printf 'Compiled with `%s`.\n\n' "${args[*]}"; fi
    printf '```ts\n'
    cat "$src"
    printf '```\n\n```llvm\n'
    # Same header rule as tests/run.js: drop `;` comment lines and source_filename, then leading blanks.
    grep -v -e '^;' -e '^source_filename' "$ll" | sed '/./,$!d'
    printf '```\n'
  } > "$block"

  if ! grep -q "^<!-- cookbook:begin $name -->\$" "$doc"; then
    echo "warning: docs/cookbook/$name.ts has no <!-- cookbook:begin $name --> marker in $doc" >&2
    continue
  fi
  awk -v name="$name" -v block="$block" '
    $0 == "<!-- cookbook:begin " name " -->" {
      print
      while ((getline line < block) > 0) print line
      close(block)
      skipping = 1
      next
    }
    $0 == "<!-- cookbook:end " name " -->" { skipping = 0 }
    !skipping { print }
  ' "$tmp" > "$tmp.next"
  mv "$tmp.next" "$tmp"
done

# Every marker must have a snippet behind it.
while read -r marker; do
  name=${marker#<!-- cookbook:begin }
  name=${name% -->}
  if [ ! -f "docs/cookbook/$name.ts" ]; then
    echo "error: $doc has a marker for '$name' but docs/cookbook/$name.ts does not exist" >&2
    status=1
  fi
done < <(grep '^<!-- cookbook:begin ' "$doc")

if [ "$check" -eq 1 ]; then
  if ! diff -u "$doc" "$tmp" >"$out/IR_COOKBOOK.diff"; then
    echo "error: $doc is out of date; run docs/cookbook/regen.sh (diff in $out/IR_COOKBOOK.diff)" >&2
    status=1
  else
    echo "$doc is up to date"
  fi
else
  mv "$tmp" "$doc"
  echo "rewrote $doc"
fi
exit "$status"
