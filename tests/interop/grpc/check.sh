#!/bin/bash
# interop.yml's `grpc` job: calls the Nish gRPC server (`/grpc-server serve`,
# `tests/link/net_grpc_interop`) with grpcurl, then a short ghz run, over its
# TLS listener and over its h2c one, and fails on any answer it does not
# expect. ghz is a stability check, not a benchmark: no throughput is printed.
#
#   tests/interop/grpc/check.sh GRPCURL GHZ TLS_PORT H2C_PORT
#
# The server signs with the test leaf, which no root trusts: grpcurl's
# `-insecure` and ghz's `--skipTLS` skip verification, and `-plaintext` and
# `--insecure` are h2c. The server offers no reflection, so both read
# `benchmark.proto` beside this script.
set -u

if [ $# -ne 4 ]; then
  echo "usage: $0 GRPCURL GHZ TLS_PORT H2C_PORT" >&2
  exit 2
fi
grpcurl=$1
ghz=$2
tls_port=$3
h2c_port=$4
protos=$(dirname "$0")
service=benchmark.BenchmarkService
# The server's deadline cap (CAP_MS in serve.ts) is 1 s; Slow asks for 10.
slow_max_s=10
slow_within_ms=5000
ghz_calls=2000

failed=0
pass() { echo "PASS  $1"; }
fail() {
  echo "FAIL  $1"
  failed=$((failed + 1))
}

# call LISTENER_FLAG PORT METHOD JSON [grpcurl flags...]: sets out, err, code, ms.
call() {
  local flag=$1 port=$2 method=$3 data=$4
  shift 4
  local start
  start=$(date +%s%N)
  out=$("$grpcurl" -import-path "$protos" -proto benchmark.proto "$flag" "$@" \
    -d "$data" "127.0.0.1:$port" "$service/$method" 2> "$errfile")
  code=$?
  ms=$((($(date +%s%N) - start) / 1000000))
  err=$(cat "$errfile")
}

# expect_sum NAME A B SUM: GetSum answers SumReply { result: SUM } and exits 0.
expect_sum() {
  local name=$1 a=$2 b=$3 sum=$4
  call "$flag" "$port" GetSum "{\"a\":$a,\"b\":$b}"
  local got
  got=$(printf '%s' "$out" | jq -c '.result // 0' 2> /dev/null)
  if [ "$code" -eq 0 ] && [ "$got" = "$sum" ]; then
    pass "$name: GetSum $a + $b = $sum"
  else
    fail "$name: GetSum $a + $b: exit $code, result '$got', stderr: $err"
  fi
}

# expect_status NAME METHOD EXIT CODE MESSAGE [grpcurl flags...]: grpcurl
# exits 64 + the status and prints its code and message.
expect_status() {
  local name=$1 method=$2 exit_code=$3 status=$4 message=$5
  shift 5
  call "$flag" "$port" "$method" '{}' "$@"
  local want
  want=$(printf 'ERROR:\n  Code: %s\n  Message: %s' "$status" "$message")
  if [ "$code" -eq "$exit_code" ] && [ "$err" = "$want" ]; then
    pass "$name: $method: $status, message '$message'"
  else
    fail "$name: $method: want exit $exit_code, $status '$message'; got exit $code, stderr: $err"
  fi
}

errfile=$(mktemp)
report=$(mktemp)
trap 'rm -f "$errfile" "$report"' EXIT

for listener in "TLS -insecure --skipTLS $tls_port" "h2c -plaintext --insecure $h2c_port"; do
  read -r name flag ghz_flag port <<< "$listener"
  expect_sum "$name" 2 3 5
  expect_sum "$name" -5 3 -2
  expect_status "$name" Denied 71 PermissionDenied "no 100% é"
  expect_status "$name" Missing 69 NotFound ""
  # grpcurl calls with a 10 s deadline (-max-time 10); the server holds the
  # call and answers DEADLINE_EXCEEDED with no message once its capped
  # deadline has passed.
  # grpc-go's own timeout would say "context deadline exceeded", and come
  # only after 10 s.
  expect_status "$name" Slow 68 DeadlineExceeded "" -max-time "$slow_max_s"
  if [ "$ms" -lt "$slow_within_ms" ]; then
    pass "$name: Slow: answered by the server's deadline, under $slow_within_ms ms"
  else
    fail "$name: Slow: took $ms ms; the server's cap is 1000"
  fi

  "$ghz" "$ghz_flag" --import-paths "$protos" --proto benchmark.proto \
    --call "$service/GetSum" -d '{"a":2,"b":3}' -c 10 -n "$ghz_calls" \
    -O json "127.0.0.1:$port" > "$report" 2> "$errfile"
  ghz_code=$?
  ok=$(jq -c '[.count, (.statusCodeDistribution | keys), .statusCodeDistribution.OK]' "$report" 2> /dev/null)
  if [ "$ghz_code" -eq 0 ] && [ "$ok" = "[$ghz_calls,[\"OK\"],$ghz_calls]" ]; then
    pass "$name: ghz: $ghz_calls GetSum calls, 10 at a time, every one OK"
  else
    fail "$name: ghz: exit $ghz_code, [count, statuses, OK] $ok; errors: $(jq -c '.errorDistribution' "$report" 2> /dev/null) $(cat "$errfile")"
  fi
done

echo "grpc interop: $failed failed"
[ "$failed" -eq 0 ]
