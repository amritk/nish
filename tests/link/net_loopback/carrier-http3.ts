// HTTP/3: `nish/net/http3-server` with ALPN `h3`, answered by `H3App`, and
// the wire client with the HTTP/3 lane's requests and response reader. Its
// control and QPACK streams, a GET, a POST of 100,000 bytes echoed both ways
// (past the 32 KiB stream buffers), fifty more requests on new streams with
// the arena measured (past the server's sixteen streams, so the client waits
// on MAX_STREAMS), the server's GOAWAY ending the connection with
// H3_NO_ERROR, and the client's own CONNECTION_CLOSE seen by the server.
import { Suite } from "nish/testing";
import { H3_FRAME_DATA, H3_NO_ERROR, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame";
import { Http3Server } from "nish/net/http3-server";
import { quicListenerPaceTime } from "nish/net/quic-listener";
import { WebTransportConfig } from "nish/net/webtransport";
import { n32, n64 } from "../net_quic_frame/typed";
import { bytesOf, textOf } from "../crypto_x509/hex";
import {
  CLIENT_CONTROL,
  CLIENT_DECODER,
  CLIENT_ENCODER,
  H3Limits,
  H3Peer,
  H3Response,
  h3Cat,
  h3ClientSettings,
  h3Config,
  h3Frame,
  h3Hello,
  h3IsPattern,
  h3Pattern,
  h3QuicConfig,
  h3Varint,
} from "../net_http3/peer";
import { CARRIER_H3, UdpLoop, lbNowMs } from "./udp";
import { quicAwait } from "./carrier-quic";
import { LbMeter, ROUNDS, WARM, lbHandshakeBand, roundText } from "./common";

/** A connected client with its control and QPACK streams open; its reader, the HTTP/3 lane's peer, client half only. */
const h3WireOpen = (lp: UdpLoop, s: Http3Server, limits: H3Limits): H3Peer => {
  const p = new H3Peer(s.quic(n32(0)), s.connection(n32(0)), lp.client.c);
  if (lp.connect(h3Hello(limits))) {
    lp.sendStream(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]), false);
    lp.sendStream(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
    lp.sendStream(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
  }
  return p;
};

/** A POST of `body` to `/echo` on stream `id`, whole with its FIN; the response once it has ended. */
const h3WirePost = (lp: UdpLoop, p: H3Peer, id: i64, body: u8[]): H3Response => {
  const head: u8[] = p.headers("POST", "/echo", ["content-length"], [`${body.length}`]);
  lp.sendStream(id, h3Cat([head, h3Frame(H3_FRAME_DATA, body)]), true);
  quicAwait(lp, p, id, n32(0), true);
  return p.response(id);
};

/** Every check of the HTTP/3 carrier. */
export const http3Checks = (t: Suite): void => {
  const limits = new H3Limits();
  const lp = new UdpLoop(CARRIER_H3, h3QuicConfig(limits), h3Config(), new WebTransportConfig(), n32(2));
  const s: Http3Server | null = lp.h3;
  if (s === null) {
    t.fail("http/3: a server", "none was made");
    return;
  }
  const p: H3Peer = h3WireOpen(lp, s, limits);
  t.ok("http/3: a handshake across loopback through the listener into a slot, and the client's three streams", s.busy() === 1 && lp.failure === "");
  const none: string[] = [];
  lp.sendStream(n64(0), p.headers("GET", "/hello", none, none), true);
  quicAwait(lp, p, n64(0), n32(0), true);
  const hello: H3Response = p.response(n64(0));
  t.eqStr("http/3: a GET answered: 200, its body, the FIN", `${hello.status} ${textOf(hello.body)} ${hello.fin}`, "200 hello over loopback\n true");

  const echo: H3Response = h3WirePost(lp, p, n64(4), h3Pattern(n32(100000)));
  t.ok("http/3: a POST of 100,000 bytes echoed whole, past the 32 KiB stream buffers both ways", echo.status === "200" && echo.fin && toI32(echo.body.length) === 100000 && h3IsPattern(echo.body));

  let id: i64 = n64(8);
  for (let k: i32 = 0; k < WARM; k++) {
    h3WirePost(lp, p, id, h3Pattern(n32(100)));
    id = id + n64(4);
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    const r: H3Response = h3WirePost(lp, p, id, bytesOf(roundText(k)));
    if (r.status === "200" && r.fin && textOf(r.body) === roundText(k)) {
      intact = intact + 1;
    }
    id = id + n64(4);
  }
  lp.meter = null;
  t.eqI32("http/3: fifty more requests, each on a new stream past the server's first sixteen, each echoed", intact, ROUNDS);
  t.ok(`http/3: and every server call kept ${rounds.kept} bytes over them`, rounds.kept === n64(0));
  t.ok("http/3: the client waited on the server's MAX_STREAMS to open them", lp.client.maxStreamsBidi > limits.maxStreamsBidi);

  // The pacer's credit spent, as a long flight just sent would: the carrier
  // must wake the slot when the pacer next allows a datagram, which
  // `quicListenerPaceTime` names as a time on the caller's clock.
  const quic = s.quic(n32(0));
  const now: i64 = lbNowMs();
  for (let k: i32 = 0; k < 1000 && quic.recovery.pacerDelay(now, n32(1200)) <= 0; k++) {
    quic.recovery.onPaced(now, n32(1200));
  }
  const wake: i64 = quicListenerPaceTime(quic, now) - now;
  s.touch(n32(0));
  s.flush(now);
  // No other timer of the connection's may be due as soon, or the check
  // would pass on that timer whatever the carrier did with the pacer's.
  const due: i64 = quic.deadline();
  const alone: boolean = due < 0 || due - now > wake + n64(1);
  const woken: i32 = s.timeout(now);
  t.ok(
    "http/3: a slot whose pacer has no credit left is woken when it has some, not at its idle deadline",
    wake > 0 && alone && woken >= 0 && toI64(woken) <= wake + n64(1)
  );

  s.connection(n32(0)).goaway();
  s.touch(n32(0));
  t.ok("http/3: the server's GOAWAY: with every request done it closes the connection", lp.awaitClose() && lp.awaitIdle());
  t.ok("http/3: and the client reads H3_NO_ERROR, the application's", lp.client.closeCode === H3_NO_ERROR && lp.client.closeApp);

  let all: boolean = true;
  let inBand: boolean = true;
  for (let k: i32 = 0; k < 3; k++) {
    lp.newClient();
    const m = new LbMeter(true);
    lp.meter = m;
    const q: H3Peer = h3WireOpen(lp, s, limits);
    lp.sendStream(n64(0), q.headers("GET", "/hello", none, none), true);
    const got: boolean = quicAwait(lp, q, n64(0), n32(0), true) && q.response(n64(0)).status === "200";
    lp.closeConnection(H3_NO_ERROR);
    const idle: boolean = lp.awaitIdle();
    lp.meter = null;
    all = all && got && idle && s.quic(n32(0)).error === H3_NO_ERROR && s.quic(n32(0)).errorIsApplication;
    inBand = inBand && lbHandshakeBand(m.kept);
  }
  t.ok("http/3: three more connections, each a GET and the client's CONNECTION_CLOSE with H3_NO_ERROR, which frees the slot", all && s.accepted === 4);
  t.ok("http/3: each keeps 1 to 6 KiB of arena from its Initial to its close, none of it the QUIC connection's or the signature's (H3-1)", inBand);
  t.ok("http/3: the program held nothing it could not place", lp.h3App.table.overflows === 0 && lp.h3App.resets === 0);
  t.eqStr("http/3: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};
