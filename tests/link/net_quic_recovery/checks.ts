// The checks of `nish/net/quic-recovery`, run by `main.ts` in the default
// number mode and by `tests/link/net_quic_recovery_f64` under
// `--number-mode f64`: the module on its own in `unit.ts`, and inside the
// connection in `conn.ts`.
import { Suite } from "nish/testing";
import { recoveryConnChecks } from "./conn";
import { recoveryUnitChecks } from "./unit";

/** Every check, in one suite. */
export const quicRecoveryChecks = (): i32 => {
  const t = new Suite("quic recovery");
  recoveryUnitChecks(t);
  recoveryConnChecks(t);
  return t.done();
};
