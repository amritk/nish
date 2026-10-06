// The checks of QUIC streams, run by `main.ts` in the default number mode
// and by `tests/link/net_quic_stream_f64` under `--number-mode f64`: a
// multiplexed transfer in `transfer.ts`, flow control in `flow.ts`, limits,
// endings and refusals in `refusals.ts`, and QUIC-3's arena checks in
// `arena.ts`.
import { Suite } from "nish/testing";
import { arenaChecks } from "./arena";
import { flowChecks } from "./flow";
import { refusalChecks } from "./refusals";
import { transferChecks } from "./transfer";

/** Every check, in one suite. */
export const quicStreamChecks = (): i32 => {
  const t = new Suite("quic streams");
  transferChecks(t);
  flowChecks(t);
  refusalChecks(t);
  arenaChecks(t);
  return t.done();
};
