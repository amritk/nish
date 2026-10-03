#!/usr/bin/env bash
# Records `net_quic_conn_replay`'s transcript: builds the program, runs it as a
# live server, completes a handshake and a stream echo against it with
# aioquic, and writes what the server saw and sent to `recording.ts`, which
# the replay checks byte for byte inside `npm test`. aioquic is the third
# party here, so this script is not part of `npm test`: run it by hand after a
# change that moves the server's bytes, with aioquic installed
# (`pip install aioquic`), and commit the new recording.
#
#   bash tests/link/net_quic_conn_replay/record.sh [python] [port]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
python="${1:-python3}"
port="${2:-4433}"
nish="${NISH:-$root/build/nish}"
out="$root/build/quic-record"
rm -rf "$out"
mkdir -p "$out"
"$nish" "$here/main.ts" -o "$out/" --link "$out/app" >/dev/null 2>&1
"$out/app" serve "$port" >"$out/transcript.txt" &
server=$!
sleep 0.5
status=0
"$python" "$here/aioquic-client.py" "$port" || status=$?
wait "$server" || status=$?
if [ "$status" -ne 0 ]; then
  echo "record: the exchange failed (exit $status); transcript in $out/transcript.txt" >&2
  exit 1
fi
{
  echo "// The transcript \`record.sh\` wrote: aioquic $("$python" -c 'import aioquic; print(aioquic.__version__)') against"
  echo "// the Nish echo server. Generated: re-record rather than edit by hand."
  echo "// \`c\` the time in milliseconds and a datagram the client sent, \`s\` one the"
  echo "// server sent, \`e\` the stream data the server echoed, \`x\` the error code the"
  echo "// client closed with."
  echo "export const transcript = (): string[] => ["
  sed 's/\\/\\\\/g; s/"/\\"/g; s/^/  "/; s/$/",/' "$out/transcript.txt"
  echo "];"
} >"$here/recording.ts"
echo "record: wrote $here/recording.ts ($(wc -l <"$out/transcript.txt") lines)"
