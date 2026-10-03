// `nish/net/tls-tcp` over loopback. With no arguments it runs the checks in
// `checks.ts`, a Nish client against the carrier in one loop (also run under
// `--number-mode f64` by `tests/link/net_tls_record_tcp_f64`). With
// `serve <n>` it is the server alone for a third-party client: it prints
// `port <p>`, serves `n` connections — an echo, or an HTTP answer to a GET —
// printing a line as each ends, and exits 0. The `net_tls_tcp` block of
// tests/run.js drives that mode with openssl s_client and curl.
import { tcpConfig } from "../net_tls_common/server";
import { Loopback, SIGN_LEAF } from "./harness";
import { tcpChecks } from "./checks";

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
  const lb = new Loopback(tcpConfig(["http/1.1"]), 4, SIGN_LEAF);
  lb.serving = true;
  console.log(`port ${lb.port}`);
  while (lb.closed < count) {
    // A third-party client may take its time between steps; only the
    // harness's own deadline (tests/run.js) bounds the wait here.
    lb.failure = "";
    lb.step(-1);
  }
  lb.shutdown();
  return 0;
};

export const main = (): i32 => {
  if (process.argv.length === 3 && process.argv[1] === "serve") {
    const count: i32 = decimal(process.argv[2]);
    return count > 0 ? serve(count) : 2;
  }
  return tcpChecks();
};
