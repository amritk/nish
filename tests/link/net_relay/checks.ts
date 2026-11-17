// The checks of the relay in `examples/relay/`, run by `main.ts` in the
// default number mode and by `tests/link/net_relay_f64` under `--number-mode
// f64`.
import { Suite } from "nish/testing";
import { frameChecks } from "./frames";
import { grantChecks } from "./grants";
import { loopbackChecks } from "./loopback";
import { peerChecks } from "./peers";
import { rebindChecks } from "./rebind";
import { setupChecks } from "./setup";

/**
 * Every check, in one suite.
 * @param dir the scratch directory the setup checks write under, one per
 *   program
 * @returns the suite's exit status
 */
export const relayChecks = (dir: string): i32 => {
  const t = new Suite("relay");
  frameChecks(t);
  grantChecks(t);
  setupChecks(t, dir);
  peerChecks(t);
  loopbackChecks(t);
  rebindChecks(t);
  return t.done();
};
