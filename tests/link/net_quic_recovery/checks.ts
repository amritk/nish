// The checks of `nish/net/quic-recovery`, run by `main.ts` in the default
// number mode and by `tests/link/net_quic_recovery_f64` under
// `--number-mode f64`: the module on its own in `unit.ts`, inside the
// connection in `conn.ts`, the handshake flight under loss in
// `handshake.ts`, path MTU discovery in `pmtu.ts`, and the CUBIC
// controller in `cubic.ts`.
import { Suite } from "nish/testing";
import { recoveryConnChecks } from "./conn";
import { recoveryCubicChecks } from "./cubic";
import { recoveryHandshakeChecks } from "./handshake";
import { recoveryPmtuChecks } from "./pmtu";
import { recoveryUnitChecks } from "./unit";

/** Every check, in one suite. */
export const quicRecoveryChecks = (): i32 => {
  const t = new Suite("quic recovery");
  recoveryUnitChecks(t);
  recoveryConnChecks(t);
  recoveryHandshakeChecks(t);
  recoveryPmtuChecks(t);
  recoveryCubicChecks(t);
  return t.done();
};
