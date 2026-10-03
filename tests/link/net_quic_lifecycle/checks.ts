// The checks of `net_quic_lifecycle`, run by `main.ts` in the default number
// mode and by `tests/link/net_quic_lifecycle_f64` under `--number-mode f64`.
import { Suite } from "nish/testing";
import { keyChecks } from "./keys";
import { listenerChecks } from "./listener";
import { timerChecks } from "./timers";

/** Runs every check and answers the exit code. */
export const quicLifecycleChecks = (): i32 => {
  const t = new Suite("quic lifecycle");
  listenerChecks(t);
  timerChecks(t);
  keyChecks(t);
  return t.done();
};
