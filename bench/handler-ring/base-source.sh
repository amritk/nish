#!/usr/bin/env bash
# The source ring-base builds: bench/handler-ring/server.ts without the lines
# between each `// bench:batch begin` and `// bench:batch end`, which set
# `HandlerLimits.minEvents` and `maxWaitMs` and print `batch ...`. A
# --base-compiler from before those fields (0.45.1 and older) refuses them,
# so ring-base runs the handler's plain wait and prints no `batch` line.
# `node tests/run.js handler-ring` builds this output with the seed.
#
#   bash bench/handler-ring/base-source.sh <out.ts>
set -euo pipefail
if [ $# -ne 1 ]; then
  echo "usage: base-source.sh <out.ts>" >&2
  exit 2
fi
src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/server.ts"
begins=$(grep -c '^ *// bench:batch begin$' "$src")
ends=$(grep -c '^ *// bench:batch end$' "$src")
# A marker renamed or dropped would leave the batch lines in, and the base
# build would fail far from here: refuse an unpaired or missing marker.
if [ "$begins" -eq 0 ] || [ "$begins" -ne "$ends" ]; then
  echo "base-source.sh: $src has $begins begin and $ends end markers" >&2
  exit 1
fi
sed '/^ *\/\/ bench:batch begin$/,/^ *\/\/ bench:batch end$/d' "$src" >"$1"
if grep -q 'limits\.\(minEvents\|maxWaitMs\)' "$1"; then
  echo "base-source.sh: $1 still names a batch field" >&2
  exit 1
fi
