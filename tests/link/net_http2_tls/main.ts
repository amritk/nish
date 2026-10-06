// `nish/net/http2-tls` over loopback. With no arguments it runs the checks in
// `checks.ts`, Nish clients against the carrier in one loop (also run under
// `--number-mode f64` by `tests/link/net_http2_tls_f64`). With `serve <n>` it
// is the server alone for a third-party client — `curl --http2`, `h2spec` —
// offering h2 and answering every GET with a short body and anything else by
// echoing its body: it prints `port <p>`, serves `n` connections, printing a
// line as each ends, and exits 0.
import { Http2Config } from "nish/net/http2";
import { H2_ALPN } from "nish/net/http2-tls";
import { tcpConfig } from "../net_tls_common/server";
import { tlsChecks } from "./checks";
import { H2Loop } from "./harness";

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

/** Serves `count` connections from third-party clients, then exits. */
const serve = (count: i32): i32 => {
  const lb = new H2Loop(tcpConfig([H2_ALPN]), new Http2Config(), 4);
  lb.serving = true;
  console.log(`port ${lb.port}`);
  while (lb.closed < count) {
    lb.failure = "";
    lb.step(toI32(-1));
  }
  lb.shutdown();
  return 0;
};

export const main = (): i32 => {
  if (process.argv.length === 3 && process.argv[1] === "serve") {
    const count: i32 = decimal(process.argv[2]);
    return count > 0 ? serve(count) : 2;
  }
  return tlsChecks();
};
