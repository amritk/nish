// TLS over TCP: `nish/net/tls-tcp` serving an echo, and the Nish client of
// `tls-client.ts`, in one loop. A request, 300,000 bytes streamed both ways
// at once, rounds on a warm connection with the arena measured, the
// client's close_notify answered with the server's, and the memory a whole
// connection keeps, from accept to close.
import { Suite } from "nish/testing";
import { ascii } from "../net_tls_record_common/bytes";
import { h3IsPattern, h3Pattern } from "../net_http3/peer";
import { NqMeter } from "../net_quic_stream/arena";
import { CARRIER_TLS, TcpLoop } from "./tcp";
import { TlsClient } from "./tls-client";
import { textOf } from "../crypto_x509/hex";
import { ROUNDS, WARM, roundText } from "./common";

/** One echo of `bytes` through client `c`; whether it came back whole. */
const tlsEchoed = (c: TlsClient, bytes: u8[]): boolean => {
  c.send(bytes);
  if (!c.awaitPlain(toI32(bytes.length))) {
    return false;
  }
  return textOf(c.take(toI32(bytes.length))) === textOf(bytes);
};

/** A connection from handshake to close, with one echo, under `m`; whether it all went as it should. */
const tlsWholeConnection = (lp: TcpLoop, m: NqMeter): boolean => {
  lp.meter = m;
  const c = new TlsClient(lp);
  const noAlpn: string[] = [];
  const ok: boolean = c.handshake(noAlpn) && tlsEchoed(c, ascii("one more"));
  c.closeNotify();
  const alert: string = c.awaitAlert();
  const ended: boolean = lp.awaitEnd(c.index);
  lp.meter = null;
  return ok && alert === "1 0" && ended;
};

/** Every check of the TLS carrier. */
export const tlsChecks = (t: Suite): void => {
  const lp = new TcpLoop(CARRIER_TLS);
  const c = new TlsClient(lp);
  const noAlpn: string[] = [];
  t.ok("tls: a Nish client completes the handshake across loopback, the server's signature and Finished verified", c.handshake(noAlpn));
  t.ok("tls: a request is echoed", tlsEchoed(c, ascii("GET / over tls")));

  const body: u8[] = h3Pattern(toI32(300000));
  c.send(body);
  const whole: boolean = c.awaitPlain(toI32(300000)) && h3IsPattern(c.take(toI32(300000)));
  t.ok("tls: 300,000 bytes streamed both ways, the echo read while the body is still going out", whole && lp.echo.echoed >= toI64(300000));

  for (let k: i32 = 0; k < WARM; k++) {
    tlsEchoed(c, h3Pattern(toI32(1000)));
  }
  const rounds = new NqMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    if (tlsEchoed(c, ascii(roundText(k)))) {
      intact = intact + 1;
    }
  }
  lp.meter = null;
  t.eqI32("tls: fifty rounds on the warm connection come back intact", intact, ROUNDS);
  t.ok(`tls: and every server wake kept ${rounds.kept} bytes over them`, rounds.kept === toI64(0));

  c.closeNotify();
  t.eqStr("tls: the client's close_notify is answered with the server's", c.awaitAlert(), "1 0");
  t.ok("tls: the server saw the client's close and closed the socket", lp.awaitEnd(c.index) && lp.echo.peerCloses === 1 && lp.awaitClosed(toI32(1)) && lp.busy() === 0);

  const first = new NqMeter(false);
  const second = new NqMeter(false);
  const third = new NqMeter(true);
  const all: boolean = tlsWholeConnection(lp, first) && tlsWholeConnection(lp, second) && tlsWholeConnection(lp, third);
  t.ok("tls: three more connections through the slot, each handshaken, echoed and closed", all && lp.busy() === 0);
  console.log(`tls: a connection keeps ${first.kept}, ${second.kept} and ${third.kept} bytes, accept to close`);
  t.eqStr("tls: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};
