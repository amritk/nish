// The checks of `nish/net/webtransport` and the WebTransport seam of
// `nish/net/http3`, run by `main.ts` in the default number mode and by
// `tests/link/net_webtransport_f64` under `--number-mode f64`: sessions,
// datagrams and streams in `sessions.ts`, closing and draining in
// `closing.ts`, every refusal in `refusals.ts`, the `wtransport` 0.7 exchange
// replayed in `golden.ts`, and the arena in `arena.ts`.
import { Suite } from "nish/testing";
import { wtArenaChecks } from "./arena";
import { closingChecks } from "./closing";
import { goldenChecks } from "./golden";
import { refusalChecks } from "./refusals";
import { sessionChecks } from "./sessions";

/** Every check, in one suite. */
export const wtChecks = (): i32 => {
  const t = new Suite("webtransport");
  sessionChecks(t);
  closingChecks(t);
  refusalChecks(t);
  goldenChecks(t);
  wtArenaChecks(t);
  return t.done();
};
