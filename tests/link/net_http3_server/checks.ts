// The checks of `nish/net/http3-server`, run by `main.ts` in the default
// number mode and by `tests/link/net_http3_server_f64` under `--number-mode
// f64`: the connection-ID index and the timer wheel in `units.ts`, and the
// carrier across loopback in `loopback.ts`, a client whose port changes
// mid-connection in `rebind.ts`, and the idle and head clock in `clock.ts`.
import { Suite } from "nish/testing";
import { clockChecks } from "./clock";
import { loopbackChecks } from "./loopback";
import { rebindChecks } from "./rebind";
import { unitChecks } from "./units";

/** Every check, in one suite. */
export const serverChecks = (): i32 => {
  const t = new Suite("http3 server");
  unitChecks(t);
  loopbackChecks(t);
  rebindChecks(t);
  clockChecks(t);
  return t.done();
};
