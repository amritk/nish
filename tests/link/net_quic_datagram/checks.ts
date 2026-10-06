// The checks of DATAGRAM frames and GSO batching, run by `main.ts` in the
// default number mode and by `tests/link/net_quic_datagram_f64` under
// `--number-mode f64`: RFC 9221 inside the connection in `datagram.ts`, and
// a flight sent with UDP_SEGMENT and read with UDP_GRO over loopback in
// `gso.ts`.
import { Suite } from "nish/testing";
import { datagramChecks } from "./datagram";
import { gsoChecks } from "./gso";

/** Every check, in one suite. */
export const quicDatagramChecks = (): i32 => {
  const t = new Suite("quic datagrams");
  datagramChecks(t);
  gsoChecks(t);
  return t.done();
};
