// The checks of `nish/net/http3`, run by `main.ts` in the default number mode
// and by `tests/link/net_http3_f64` under `--number-mode f64`: requests and
// responses in `requests.ts`, the stream errors and the write calls'
// refusals in `refusals.ts`, and the arena in `arena.ts`. The connection
// errors are `tests/link/net_http3_errors`'s.
import { Suite } from "nish/testing";
import { requestChecks } from "./requests";

/** Every check, in one suite. */
export const http3Checks = (): i32 => {
  const t = new Suite("http3");
  requestChecks(t);
  return t.done();
};
