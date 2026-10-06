// `nish/net/http3-server` over loopback. With no arguments it runs the checks
// in `checks.ts`: the connection-ID index and the timer wheel, and Nish
// clients against the carrier in one loop (also run under `--number-mode f64`
// by `tests/link/net_http3_server_f64`). With `serve <n>` it is the server
// alone, for a third-party client — `curl --http3`, the quic-interop-runner's
// http3 case — offering h3 with the P-256 test certificate of
// `net_tls_common` (so a client is told to trust it, or not to check): it
// prints `port <p>`, serves `n` connections, printing a line as each ends, and
// exits 0. A fixed port is `serve <n> <port>`.
import { serverChecks } from "./checks";
import { serve } from "./serve";

/** The decimal number `text` spells, or -1. */
const decimal = (text: string): i32 => {
  let n: i32 = 0;
  const length: i32 = toI32(text.length);
  if (length === 0 || length > 6) {
    return -1;
  }
  for (let k: i32 = 0; k < length; k++) {
    const digit: i32 = toI32(text.charCodeAt(k)) - 48;
    if (digit < 0 || digit > 9) {
      return -1;
    }
    n = n * 10 + digit;
  }
  return n;
};

export const main = (): i32 => {
  const argc: i32 = toI32(process.argv.length);
  if ((argc === 3 || argc === 4) && process.argv[1] === "serve") {
    const count: i32 = decimal(process.argv[2]);
    const port: i32 = argc === 4 ? decimal(process.argv[3]) : 0;
    return count > 0 && port >= 0 && port <= 65535 ? serve(count, port) : 2;
  }
  return serverChecks();
};
