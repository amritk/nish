// Every carrier, a Nish server and a Nish client over loopback in one
// `pollWait` loop each: run by `main.ts` in the default number mode and by
// `tests/link/net_loopback_f64` under `--number-mode f64`.
import { Suite } from "nish/testing";
import { tlsChecks } from "./carrier-tls";
import { http1Checks } from "./carrier-http1";
import { websocketChecks } from "./carrier-websocket";
import { http2Checks } from "./carrier-http2";
import { quicChecks } from "./carrier-quic";
import { http3Checks } from "./carrier-http3";
import { webtransportChecks } from "./carrier-webtransport";

/** Every check, in one suite; answers the exit code. */
export const loopbackChecks = (): i32 => {
  const t = new Suite("net loopback");
  tlsChecks(t);
  http1Checks(t);
  websocketChecks(t);
  http2Checks(t);
  quicChecks(t);
  http3Checks(t);
  webtransportChecks(t);
  return t.done();
};
