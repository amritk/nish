// The whole `nish/net/quic-packet` suite as one call, so that the default-mode
// and the f64 entries run the same checks.
import { Suite } from "nish/testing";
import { vectorChecks } from "./checks";
import { refusalChecks } from "./refusals";

export const quicPacketChecks = (): i32 => {
  const t = new Suite("quic-packet");
  vectorChecks(t);
  refusalChecks(t);
  return t.done();
};
