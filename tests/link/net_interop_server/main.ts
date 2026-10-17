// The Nish interop server (`server.ts`). With no arguments it runs the smoke
// checks in `checks.ts`: one request per protocol from the repository's
// scripted clients, in process over loopback (also run under `--number-mode
// f64` by `tests/link/net_interop_server_f64`). With `serve` it is the server
// the interop job drives (`.github/workflows/interop.yml`, `tests/interop/`):
//
//   main serve [--www <dir>] [--certs <dir>] [--testcase <name>]
//              [--host <addr>] [--port <udp>] [--h1-port <tcp>] [--h1s-port <tcp>]
//              [--h2-port <tcp>] [--slots <1-4096>] [--only h1|h1s|h2|h3]
//              [--hash-file <path>]
//
// `--slots` sizes every pool (64 by default; HTTP/1.1's stop at 500), and
// `--only` sizes just the one named, the others at one slot, for
// `bench/pool-rss.mjs`. It prints `ports quic <p> h1 <p> h1s <p> h2 <p>` and
// `sha256 <hex>` (the QUIC certificate's, also written to `--hash-file`),
// then serves until SIGTERM or SIGINT, and exits 0. A `--testcase` the server
// does not take exits 127 at once, the quic-interop-runner's "unsupported"; a
// malformed command line exits 2, a certificate directory it cannot use 3,
// and a QUIC port it cannot bind 1.
//
//   main h3-load <requests>
//
// times that many HTTP/3 requests in process, for `bench/h2load.mjs`
// (`load.ts`).
import { interopChecks } from "./checks";
import { serve } from "./cli";
import { h3Load } from "./load";

export const main = (): i32 => {
  if (toI32(process.argv.length) >= 2 && process.argv[1] === "serve") {
    return serve(process.argv);
  }
  if (toI32(process.argv.length) >= 2 && process.argv[1] === "h3-load") {
    return h3Load(process.argv);
  }
  return interopChecks();
};
