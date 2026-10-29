#!/usr/bin/env bash
# Link one program twice under the speed profile and once under debug, and show
# each binary's GNU build-id note (readelf -n). The two speed ids must match:
# --build-id=sha1 hashes the output's bytes. tests/run.js's build_id section is
# the same check without readelf.
#
#   bash scripts/build-id-smoke.sh [<nish>]     (default: build/nish, then nish on PATH)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
nish=${1:-}
if [ -z "$nish" ]; then
  if [ -x "$root/build/nish" ]; then nish=$root/build/nish; else nish=nish; fi
fi
command -v readelf >/dev/null 2>&1 || { echo "build-id-smoke: readelf not found (binutils)" >&2; exit 2; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
src=$root/tests/link/build_id/program.ts
id_of() { readelf -n "$1" | sed -n 's/^ *Build ID: *//p'; }
for p in speed-a:speed speed-b:speed debug:debug; do
  log=$("$nish" "$src" -o "$work/${p%%:*}.ll" --link "$work/${p%%:*}" --profile "${p#*:}" 2>&1) ||
    { echo "$log" >&2; exit 1; }
  id=$(id_of "$work/${p%%:*}")
  [ "${#id}" = 40 ] || { echo "build-id-smoke: ${p%%:*} has no 20-byte build id: '${id}'" >&2; exit 1; }
  echo "${p%%:*}: $id"
done
[ "$(id_of "$work/speed-a")" = "$(id_of "$work/speed-b")" ] ||
  { echo "build-id-smoke: two speed links of one input differ" >&2; exit 1; }
echo "build-id-smoke: ok"
