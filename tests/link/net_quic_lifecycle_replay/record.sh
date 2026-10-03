#!/usr/bin/env bash
# Records `net_quic_lifecycle_replay`'s transcripts: builds the program, and
# for each scenario runs it as a live server and points
# `aioquic-client.py` at it, writing what the server saw and did to
# `recording-<scenario>.ts`, which the replay checks byte for byte inside
# `npm test`. aioquic is the third party here, so this script is not part of
# `npm test`: run it by hand after a change that moves the server's bytes,
# with aioquic installed (`pip install aioquic`), and commit the new
# recordings. Name scenarios to record only those.
#
#   bash tests/link/net_quic_lifecycle_replay/record.sh [python] [port] [scenario ...]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
python="${1:-python3}"
port="${2:-4434}"
shift $(($# > 2 ? 2 : $#))
scenarios=("$@")
if [ "${#scenarios[@]}" -eq 0 ]; then
  scenarios=(version retry keys idle reset)
fi
nish="${NISH:-$root/build/nish}"
out="$root/build/quic-lifecycle-record"
rm -rf "$out"
mkdir -p "$out"
"$nish" "$here/main.ts" -o "$out/" --link "$out/app" >/dev/null 2>&1
version="$("$python" -c 'import aioquic; print(aioquic.__version__)')"
for scenario in "${scenarios[@]}"; do
  "$out/app" serve "$port" "$scenario" >"$out/$scenario.txt" &
  server=$!
  sleep 0.5
  status=0
  "$python" "$here/aioquic-client.py" "$port" "$scenario" || status=$?
  wait "$server" || status=$?
  if [ "$status" -ne 0 ]; then
    echo "record: $scenario failed (exit $status); transcript in $out/$scenario.txt" >&2
    exit 1
  fi
  {
    echo "// The \`$scenario\` transcript \`record.sh\` wrote: aioquic $version against the Nish"
    echo "// server. Generated: re-record rather than edit by hand. \`c\` the time in"
    echo "// milliseconds, the client's address and a datagram it sent; \`t\` a timer the"
    echo "// server ran; \`l\` what the listener decided; \`e\` stream data echoed; \`k\` a"
    echo "// key update the server started; \`s\` a datagram the server sent; \`x\` the end."
    echo "export const ${scenario}Transcript = (): string[] => ["
    sed 's/\\/\\\\/g; s/"/\\"/g; s/^/  "/; s/$/",/' "$out/$scenario.txt"
    echo "];"
  } >"$here/recording-$scenario.ts"
  echo "record: wrote $here/recording-$scenario.ts ($(wc -l <"$out/$scenario.txt") lines)"
done
