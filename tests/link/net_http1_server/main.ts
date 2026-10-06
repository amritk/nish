// `nish/net/http1-server` over loopback. With no arguments it runs the checks
// in `checks.ts`, Nish clients against both carriers in one loop (also run
// under `--number-mode f64` by `tests/link/net_http1_server_f64`). With
// `serve <n>` it is the servers alone, for a third-party client — curl, the
// Autobahn suite's server cases — with the caps of `checks.ts`'s
// `testConfig` and its routes (`/hello`, `/echo`, `/big`, `/ws`): it prints
// `port <plain> <tls>`, serves `n` connections, printing a line as each ends,
// and exits 0. A fixed port is `serve <n> <plain port> <tls port>`.
import { H1_ALPN } from "nish/net/http1-server";
import { tcpConfig } from "../net_tls_common/server";
import { serverChecks, testConfig } from "./checks";
import { H1Loop } from "./harness";

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

/** Serves `count` connections from third-party clients on the ports given (0 for any), then exits. */
const serve = (count: i32, plainPort: i32, tlsPort: i32): i32 => {
  const lb = new H1Loop(testConfig(), tcpConfig([H1_ALPN]), 16, plainPort, tlsPort);
  lb.serving = true;
  console.log(`port ${lb.plainPort} ${lb.tlsPort}`);
  while (lb.closed < count) {
    lb.failure = "";
    lb.step(toI32(-1));
  }
  lb.shutdown();
  return 0;
};

export const main = (): i32 => {
  const argc: i32 = toI32(process.argv.length);
  if ((argc === 3 || argc === 5) && process.argv[1] === "serve") {
    const count: i32 = decimal(process.argv[2]);
    const plainPort: i32 = argc === 5 ? decimal(process.argv[3]) : 0;
    const tlsPort: i32 = argc === 5 ? decimal(process.argv[4]) : 0;
    return count > 0 && plainPort >= 0 && tlsPort >= 0 ? serve(count, plainPort, tlsPort) : 2;
  }
  return serverChecks();
};
