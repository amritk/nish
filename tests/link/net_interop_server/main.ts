// The Nish interop server (`server.ts`). With no arguments it runs the smoke
// checks in `checks.ts`: one request per protocol from the repository's
// scripted clients, in process over loopback (also run under `--number-mode
// f64` by `tests/link/net_interop_server_f64`). With `serve` it is the server
// the interop job drives (`.github/workflows/interop.yml`, `tests/interop/`):
//
//   main serve [--www <dir>] [--certs <dir>] [--testcase <name>]
//              [--host <addr>] [--port <udp>] [--h1-port <tcp>] [--h1s-port <tcp>]
//              [--h2-port <tcp>]
//              [--hash-file <path>]
//
// It prints `ports quic <p> h1 <p> h1s <p> h2 <p>` and `sha256 <hex>` (the
// QUIC certificate's, also written to `--hash-file`), then serves until
// SIGTERM or SIGINT, and exits 0. A `--testcase` the server does not take
// exits 127 at once, the quic-interop-runner's "unsupported"; a malformed
// command line exits 2, a certificate directory it cannot use 3, and a QUIC
// port it cannot bind 1.
import { interopChecks } from "./checks";
import { serve } from "./cli";

export const main = (): i32 => {
  if (toI32(process.argv.length) >= 2 && process.argv[1] === "serve") {
    return serve(process.argv);
  }
  return interopChecks();
};
