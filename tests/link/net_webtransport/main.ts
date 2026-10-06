// `nish/net/webtransport` and the WebTransport seam of `nish/net/http3`.
// With no arguments it runs the checks in `checks.ts` (also run under
// `--number-mode f64` by `tests/link/net_webtransport_f64`). With
// `record [port]` it is the server alone, for one `wtransport` 0.7 client,
// and prints what that client sent (`record.ts`); `golden.ts` holds what it
// printed.
import { wtChecks } from "./checks";
import { record } from "./record";

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
  if ((argc === 2 || argc === 3) && process.argv[1] === "record") {
    const port: i32 = argc === 3 ? decimal(process.argv[2]) : 0;
    return port >= 0 && port <= 65535 ? record(port) : 2;
  }
  return wtChecks();
};
