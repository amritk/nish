// Sessions, datagrams and streams: a session opened by an extended CONNECT,
// its SETTINGS and its 200; datagrams echoed both ways at the largest size
// each side takes, and one byte over refused; many streams of both kinds;
// two sessions on one connection.
import { Suite } from "nish/testing";
import { H3_SETTINGS_ENABLE_CONNECT_PROTOCOL, H3_SETTINGS_ENABLE_WEBTRANSPORT, H3_SETTINGS_H3_DATAGRAM, H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS } from "nish/net/http3-frame";
import { H3_TOO_LARGE } from "nish/net/http3";
import { n32, n64 } from "../net_quic_frame/typed";
import { bytesOf, textOf } from "../crypto_x509/hex";
import { h3Cat, h3Pattern, h3Varint } from "../net_http3/peer";
import { WtLimits, WtPeer, wtConnect, wtHexOf, wtLogged, wtReady } from "./peer";

/** The server's SETTINGS as the client received them on stream 3. */
const serverSettings = (t: Suite): void => {
  const p: WtPeer = wtConnect(new WtLimits());
  p.open();
  p.settle();
  const control: u8[] = p.stream(n64(3)).data;
  t.eqStr(
    "SETTINGS: QPACK 0 and 0, field sections 8,192, then extended CONNECT 1, HTTP datagrams 1, draft-02 WebTransport 1 and two sessions",
    wtHexOf(control),
    "0004190100070006600008013301ab60374201c0000000c671706a02",
  );
  t.ok("the client's WebTransport settings were read", p.h3.peer.h3Datagram === n64(1) && p.h3.peer.enableWebtransport === n64(1) && p.h3.peer.webtransportMaxSessions === n64(1) && p.h3.peer.enableConnectProtocol === n64(1));
};

/** A session on stream 0, accepted. */
const openSession = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  t.eqStr("the session is answered 200 with the draft-02 header", p.status(n64(0)), ":status: 200; sec-webtransport-http3-draft: draft02");
  t.ok("the CONNECT stream stays open", !p.stream(n64(0)).fin);
  wtLogged(t, "the program saw the session", p, ["session 0 /echo"]);
  t.eqStr("its path and origin reached the program", `${textOf(p.wt.fields.path)} ${textOf(p.wt.fields.authority)}`, "/echo localhost");
};

/** Datagrams both ways, at the edges. */
const datagrams = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.datagram(n64(0), bytesOf("ping"));
  t.eqI32("a datagram is echoed", toI32(p.datagrams.length), n32(1));
  t.eqStr("with its quarter stream ID first", wtHexOf(p.datagrams[0]), `00${wtHexOf(bytesOf("ping"))}`);
  const most: i32 = p.wt.maxDatagramPayload(n64(0));
  t.eqI32("the most the server sends: a 1,200-byte packet's room less the quarter stream ID", most, n32(1167));
  const big: u8[] = h3Pattern(most);
  p.datagram(n64(0), big);
  t.ok("one at that size goes both ways whole", toI32(p.datagrams.length) === n32(2) && toI32(p.datagrams[1].length) === most + 1);
  const over: u8[] = h3Pattern(most + 1);
  t.eqI32("one byte over is refused to the program", p.wt.sendDatagram(n64(0), over, n32(0), most + 1), H3_TOO_LARGE);
  t.eqI32("unknown sessions have no room", p.wt.maxDatagramPayload(n64(4)), n32(0));
};

/** Streams of both kinds, echoed. */
const streams = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.bidi(n64(4), n64(0), bytesOf("bidirectional"), true);
  p.settle();
  t.eqStr("a bidirectional stream is echoed on itself", textOf(p.stream(n64(4)).data), "bidirectional");
  t.ok("with its FIN", p.stream(n64(4)).fin);
  p.uni(n64(14), n64(0), bytesOf("unidirectional"), true);
  p.settle();
  const back: u8[] = p.stream(n64(15)).data;
  t.eqStr("a unidirectional one comes back on the server's own, its type and session first", wtHexOf(back), `405400${wtHexOf(bytesOf("unidirectional"))}`);
  wtLogged(t, "each reached the program", p, ["stream 4 bidi of 0", "end 4", "stream 14 uni of 0", "end 14"]);
};

/** Many streams of both kinds on one session, all echoed. */
const manyStreams = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  for (let k: i32 = 0; k < 24; k++) {
    p.bidi(n64(4) + toI64(k) * n64(4), n64(0), bytesOf(`bidi ${k}`), true);
    p.settle();
  }
  for (let k: i32 = 0; k < 12; k++) {
    p.uni(n64(14) + toI64(k) * n64(4), n64(0), bytesOf(`uni ${k}`), true);
    p.settle();
  }
  p.settle();
  let bidi: i32 = 0;
  for (let k: i32 = 0; k < 24; k++) {
    if (textOf(p.stream(n64(4) + toI64(k) * n64(4)).data) === `bidi ${k}` && p.stream(n64(4) + toI64(k) * n64(4)).fin) {
      bidi++;
    }
  }
  let uni: i32 = 0;
  for (let k: i32 = 0; k < 12; k++) {
    const back: u8[] = p.stream(n64(15) + toI64(k) * n64(4)).data;
    if (wtHexOf(back) === `405400${wtHexOf(bytesOf(`uni ${k}`))}` && p.stream(n64(15) + toI64(k) * n64(4)).fin) {
      uni++;
    }
  }
  t.eqI32("24 bidirectional streams on one session, more than QUIC lets be open at once, each echoed whole", bidi, n32(24));
  t.eqI32("12 unidirectional ones, each echoed on a stream of the server's", uni, n32(12));
  t.eqI32("and the session holds none of them once each is done both ways", p.wt.streamCount[0], n32(0));
};

/** Two sessions on one connection: datagrams and streams each go to their own. */
const twoSessions = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.session(n64(8), "/second");
  p.settle();
  t.eqStr("the second session is accepted too", p.status(n64(8)), ":status: 200; sec-webtransport-http3-draft: draft02");
  p.datagram(n64(8), bytesOf("to eight"));
  p.datagram(n64(0), bytesOf("to zero"));
  wtLogged(t, "each datagram reached its own session", p, ["session 8 /second", "datagram 8 8", "datagram 0 7"]);
  t.ok("and each echo carries its session's quarter stream ID", wtHexOf(p.datagrams[0]) === `02${wtHexOf(bytesOf("to eight"))}` && wtHexOf(p.datagrams[1]) === `00${wtHexOf(bytesOf("to zero"))}`);
  p.bidi(n64(12), n64(8), bytesOf("on eight"), true);
  p.bidi(n64(16), n64(0), bytesOf("on zero"), true);
  p.settle();
  wtLogged(t, "and each stream to its own", p, ["stream 12 bidi of 8", "stream 16 bidi of 0"]);
  t.ok("their sessions are distinct slots", p.wt.session !== n32(-1) && p.wt.sessionIds[0] !== p.wt.sessionIds[1]);
};

/** A request before the client's SETTINGS waits for them; a stream before its CONNECT waits for its session. */
const ordering = (t: Suite): void => {
  const p: WtPeer = wtConnect(new WtLimits());
  p.session(n64(0), "/early");
  t.eqI32("a CONNECT before the client's SETTINGS is not read yet", toI32(p.log.length), n32(0));
  p.open();
  p.settle();
  wtLogged(t, "and becomes a session once they arrive", p, ["session 0 /early"]);
  p.bidi(n64(8), n64(4), bytesOf("early stream"), true);
  p.uni(n64(14), n64(4), bytesOf("early uni"), true);
  t.eqI32("streams for a session whose CONNECT has not arrived wait, unread", p.wt.pendingCount, n32(2));
  p.session(n64(4), "/late");
  p.settle();
  wtLogged(t, "and are taken once it is accepted", p, ["session 4 /late", "stream 8 bidi of 4", "stream 14 uni of 4", "end 8", "end 14"]);
  t.eqStr("whole", textOf(p.stream(n64(8)).data), "early stream");
  const q: WtPeer = wtReady(new WtLimits());
  q.session(n64(4), "/hold");
  q.bidi(n64(8), n64(4), bytesOf("held"), true);
  t.eqI32("a stream of a session not yet answered waits too", q.wt.pendingCount, n32(1));
  t.eqI32("its session's datagrams are dropped meanwhile", q.wt.datagramsDropped, n32(0));
  q.datagram(n64(4), bytesOf("too soon"));
  t.eqI32("counted", q.wt.datagramsDropped, n32(1));
  t.eqI32("the program accepts it", q.wt.accept(n64(4)), n32(0));
  q.settle();
  t.eqStr("and the waiting stream is served", textOf(q.stream(n64(8)).data), "held");
};

/** The server opens streams of its own, and a plain request shares the connection. */
const serverStreams = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  const bidi: i64 = p.wt.openStream(n64(0), true);
  t.eqI64("the server's first bidirectional stream", bidi, n64(1));
  const hello: u8[] = bytesOf("from the server");
  t.eqI32("takes a write", p.wt.write(bidi, hello, n32(0), toI32(hello.length), false), toI32(hello.length));
  p.settle();
  t.eqStr("which the client reads after the signal and the session ID", wtHexOf(p.stream(bidi).data), `404100${wtHexOf(hello)}`);
  p.send(bidi, bytesOf("answer"), true);
  p.echo = false;
  p.settle();
  t.eqI32("the client's answer on it reaches the session", toI32(p.echoes.length), n32(0));
  wtLogged(t, "as the stream's data and end", p, ["end 1"]);
  t.eqI32("the server finishes it", p.wt.write(bidi, hello, n32(0), n32(0), true), n32(0));
  p.settle();
  t.ok("FIN", p.stream(bidi).fin);
  const plain: u8[] = h3Cat([h3Varint(n64(1)), h3Varint(n64(0))]);
  t.eqI32("an empty HEADERS frame is two bytes", toI32(plain.length), n32(2));
  p.send(n64(4), p.connectFrame("/plain", "webtransport", "https"), true);
  p.settle();
};

export const sessionChecks = (t: Suite): void => {
  serverSettings(t);
  openSession(t);
  datagrams(t);
  streams(t);
  manyStreams(t);
  twoSessions(t);
  ordering(t);
  serverStreams(t);
};
