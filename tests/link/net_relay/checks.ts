// The checks of the relay in `examples/relay/`, run by `main.ts` in the
// default number mode and by `tests/link/net_relay_f64` under `--number-mode
// f64`.
import { Suite } from "nish/testing";
import { frameChecks } from "./frames";
import { grantChecks } from "./grants";
import { loopbackChecks } from "./loopback";
import { peerChecks } from "./peers";
import { setupChecks } from "./setup";

/** Every check, in one suite. */
export const relayChecks = (): i32 => {
  const t = new Suite("relay");
  frameChecks(t);
  grantChecks(t);
  setupChecks(t);
  peerChecks(t);
  loopbackChecks(t);
  return t.done();
};
