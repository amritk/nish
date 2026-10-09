// HTTP/1.1 over TLS: `nish/net/http1-server`'s TLS pool with ALPN
// `http/1.1`, answered by `H1App`, and the TLS client of `tls-client.ts`
// reading responses with the HTTP/1.1 lane's own `ClientReader`. A GET, a
// 300,000-byte POST echoed chunked while it is still going out, keep-alive
// rounds with the arena measured, the client's close_notify answered, and a
// `Connection: close` request that the server ends, with the memory that
// whole connection keeps.
import { Suite } from "nish/testing";
import { H1_ALPN } from "nish/net/http1-server";
import { ascii, join } from "../net_tls_record_common/bytes";
import { h3IsPattern, h3Pattern } from "../net_http3/peer";
import { ClientReader } from "../net_http1_server/harness";
import { sameBytes } from "../crypto_x509/hex";
import { CARRIER_H1, TcpLoop } from "./tcp";
import { TlsClient } from "./tls-client";
import { LbMeter, ROUNDS, WARM, roundText } from "./common";

/** The next response client `c` reads, whole or as far as the stream went, its bytes taken off `plain`. */
export const h1Response = (c: TlsClient): ClientReader => {
  const r = new ClientReader(false);
  while (!r.advance(c.plain)) {
    if (!c.pump()) {
      r.endOfStream(c.plain);
      break;
    }
  }
  c.take(r.pos);
  return r;
};

/** A POST of `body` to `/echo`, with a length. */
const h1Post = (body: u8[], close: boolean): u8[] => {
  const connection: string = close ? "Connection: close\r\n" : "";
  return join([ascii(`POST /echo HTTP/1.1\r\nHost: loopback\r\nContent-Length: ${body.length}\r\n${connection}\r\n`), body]);
};

/** One POST of `body` echoed through `c`; whether it came back whole, chunked. */
const h1Echoed = (c: TlsClient, body: u8[]): boolean => {
  c.send(h1Post(body, false));
  const r: ClientReader = h1Response(c);
  return r.done && r.status === 200 && r.has("Transfer-Encoding: chunked") && sameBytes(r.body, body);
};

/** Every check of the HTTP/1.1 carrier. */
export const http1Checks = (t: Suite): void => {
  const lp = new TcpLoop(CARRIER_H1);
  const c = new TlsClient(lp);
  t.ok("http/1.1: a TLS handshake offering http/1.1 across loopback", c.handshake([H1_ALPN]));
  t.eqStr("http/1.1: ALPN chose it", lp.h1.alpn(toI32(0)), "http/1.1");
  c.send(ascii("GET /hello HTTP/1.1\r\nHost: loopback\r\n\r\n"));
  const hello: ClientReader = h1Response(c);
  t.eqStr(
    "http/1.1: a GET is answered with its length",
    `${hello.head}\r\n${hello.text()}`,
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 20\r\n\r\nhello over loopback\n"
  );

  const body: u8[] = h3Pattern(toI32(300000));
  c.send(h1Post(body, false));
  const big: ClientReader = h1Response(c);
  t.ok("http/1.1: a POST of 300,000 bytes is echoed whole, chunked, while it is still going out", big.done && h3IsPattern(big.body) && toI32(big.body.length) === 300000);
  t.ok("http/1.1: the server read it at most 4,096 bytes at a time, so it went back in at least 74 chunks", big.chunks >= 74);

  for (let k: i32 = 0; k < WARM; k++) {
    h1Echoed(c, h3Pattern(toI32(1000)));
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    if (h1Echoed(c, ascii(roundText(k)))) {
      intact = intact + 1;
    }
  }
  lp.meter = null;
  t.eqI32("http/1.1: fifty keep-alive requests on the warm connection, each echoed", intact, ROUNDS);
  t.ok(`http/1.1: and every server wake kept ${rounds.kept} bytes over them`, rounds.kept === toI64(0));

  c.closeNotify();
  t.eqStr("http/1.1: the client's close_notify is answered with the server's", c.awaitAlert(), "1 0");
  t.ok("http/1.1: and the server closes the slot", lp.awaitEnd(c.index) && lp.awaitClosed(toI32(1)) && lp.busy() === 0);

  const whole = new LbMeter(true);
  lp.meter = whole;
  const d = new TlsClient(lp);
  const shook: boolean = d.handshake([H1_ALPN]);
  d.send(h1Post(ascii("the last one"), true));
  const last: ClientReader = h1Response(d);
  const alert: string = d.awaitAlert();
  const ended: boolean = lp.awaitEnd(d.index) && lp.awaitClosed(toI32(2));
  lp.meter = null;
  t.ok(
    "http/1.1: a request with Connection: close is answered, then the server closes with close_notify",
    shook && last.done && last.text() === "the last one" && last.has("Connection: close") && alert === "1 0" && ended
  );
  console.log(`http/1.1: that connection kept ${whole.kept} bytes, accept to close`);
  t.eqI32("http/1.1: the program answered every request and refused nothing", lp.h1App.requests * 100 + lp.h1App.refusals, toI32(100) * (toI32(3) + WARM + ROUNDS));
  t.eqStr("http/1.1: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};
