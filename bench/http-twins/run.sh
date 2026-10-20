#!/usr/bin/env bash
# Times the Nish HTTP/1.1 server against its twins with bench/http.mjs.
#
#   bash bench/http-twins/run.sh                       every built twin
#   bash bench/http-twins/run.sh --rounds 7 --only json   arguments go to http.mjs
#   bash bench/http-twins/run.sh --cores 1,2,4         one table per core count
#
# bench/http1-server.ts is built twice, as `nish` and `nish-copy`; the two are
# byte-identical, so the spread between them is the noise band every other
# difference is read against. check.mjs runs first: a twin that does not answer
# what the Nish server answers is not timed. Build the twins with build.sh, and
# `build/nish` with `npm run build` (NISH names another compiler).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
cd "$root"

nish=${NISH:-build/nish}
[ -x "$nish" ] || npm run build
mkdir -p build/bench
"$nish" bench/http1-server.ts --link build/bench/h1 --profile speed
"$nish" bench/http1-server.ts --link build/bench/h1-copy --profile speed
cmp build/bench/h1 build/bench/h1-copy || {
  echo "run.sh: two builds of bench/http1-server.ts differ, so there is no noise band" >&2
  exit 1
}

node bench/http-twins/check.mjs

servers=(nish=build/bench/h1 nish-copy=build/bench/h1-copy)
for name in node-http uws bun go-nethttp go-fasthttp rust-hyper rust-actix nginx; do
  if [ -x "build/http-twins/$name/serve" ]; then
    servers+=("$name=build/http-twins/$name/serve")
  fi
done
exec node bench/http.mjs "$@" "${servers[@]}"
