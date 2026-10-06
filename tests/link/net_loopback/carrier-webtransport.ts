// WebTransport over HTTP/3: `nish/net/http3-server` with a `WebTransport`
// over every slot, answered by `WtApp`, and the wire client with the
// WebTransport lane's CONNECT, settings, capsules and reader. A session by
// extended CONNECT, a datagram each way, a bidirectional stream of 100,000
// bytes echoed and a unidirectional one echoed on a stream the server opens,
// rounds of a datagram and a new stream on the warm session with the arena
// measured, the client's CLOSE_WEBTRANSPORT_SESSION with its code seen by
// the server, and the server's own close of a second session seen by the
// client.
import { Suite } from "nish/testing";
import { H3_FRAME_DATA, H3_FRAME_WEBTRANSPORT_STREAM, H3_NO_ERROR, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER, H3_STREAM_WEBTRANSPORT } from "nish/net/http3-frame";
import { H3_ALPN } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { WT_CAPSULE_CLOSE, WebTransport } from "nish/net/webtransport";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { bytesOf, textOf, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { qcHello } from "../net_quic_conn/client";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, h3Cat, h3Frame, h3IsPattern, h3Pattern, h3Varint } from "../net_http3/peer";
import {
  WtLimits,
  WtPeer,
  wtCapsule,
  wtClientParams,
  wtClientSettingIds,
  wtClientSettingValues,
  wtClosePayload,
  wtConfig,
  wtH3Config,
  wtQuicConfig,
  wtSettingsFrame,
} from "../net_webtransport/peer";
import { CARRIER_WT, UdpLoop } from "./udp";
import { LbMeter, ROUNDS, WARM, roundText } from "./common";

/** The server's first unidirectional stream after its control and QPACK streams: where it echoes a unidirectional stream. */
const SERVER_UNI: i64 = 15;

/** A connected client with its control and QPACK streams open, under `wtransport` 0.7's SETTINGS; its reader, the lane's peer, client half only. */
const wtWireOpen = (lp: UdpLoop, s: Http3Server, limits: WtLimits): WtPeer => {
  const wt: WebTransport = lp.wts[0];
  const p = new WtPeer(s.quic(n32(0)), s.connection(n32(0)), wt, lp.client.c);
  if (lp.connect(qcHello([TLS_AES_128_GCM_SHA256], H3_ALPN, wtClientParams(limits)))) {
    lp.sendStream(CLIENT_CONTROL, h3Cat([h3Varint(H3_STREAM_CONTROL), wtSettingsFrame(wtClientSettingIds(), wtClientSettingValues())]), false);
    lp.sendStream(CLIENT_ENCODER, h3Varint(H3_STREAM_QPACK_ENCODER), false);
    lp.sendStream(CLIENT_DECODER, h3Varint(H3_STREAM_QPACK_DECODER), false);
  }
  return p;
};

/** Asks for a session on stream `id` and runs the loop until it is answered; the answer's fields. */
const wtWireSession = (lp: UdpLoop, p: WtPeer, id: i64): string => {
  lp.sendStream(id, p.connectFrame("/echo", "webtransport", "https"), false);
  while (lp.failure === "") {
    p.absorb();
    const status: string = p.status(id);
    if (status !== "") {
      return status;
    }
    lp.step(n32(20));
  }
  return "";
};

/** Runs the loop until stream `id` has brought at least `n` bytes and, when `fin`, its FIN; false on a timeout. */
const wtWireAwait = (lp: UdpLoop, p: WtPeer, id: i64, n: i32, fin: boolean): boolean => {
  while (lp.failure === "") {
    p.absorb();
    const r = p.stream(id);
    if (toI32(r.data.length) >= n && (!fin || r.fin)) {
      return true;
    }
    lp.step(n32(20));
  }
  return false;
};

/** One HTTP datagram of session 0: its quarter stream ID, then `payload`. */
const wtWireDatagram = (payload: u8[]): u8[] => h3Cat([h3Varint(n64(0)), payload]);

/** Every check of the WebTransport carrier. */
export const webtransportChecks = (t: Suite): void => {
  const limits = new WtLimits();
  const lp = new UdpLoop(CARRIER_WT, wtQuicConfig(limits), wtH3Config(limits), wtConfig(limits), n32(2));
  const s: Http3Server | null = lp.h3;
  if (s === null) {
    t.fail("webtransport: a server", "none was made");
    return;
  }
  const p: WtPeer = wtWireOpen(lp, s, limits);
  t.ok("webtransport: a handshake across loopback, and the client's streams under wtransport 0.7's SETTINGS", s.busy() === 1 && lp.failure === "");
  t.eqStr(
    "webtransport: an extended CONNECT is a session, accepted with draft-02's header",
    wtWireSession(lp, p, n64(0)),
    ":status: 200; sec-webtransport-http3-draft: draft02"
  );

  lp.sendQuicDatagram(wtWireDatagram(bytesOf("a datagram each way")));
  t.ok(
    "webtransport: a datagram of session 0 is echoed, with its quarter stream ID",
    lp.awaitDatagrams(n32(1)) && toHex(lp.client.datagrams[0]) === toHex(wtWireDatagram(bytesOf("a datagram each way")))
  );

  const body: u8[] = h3Pattern(n32(100000));
  lp.sendStream(n64(4), h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0)), body]), true);
  const bidi: boolean = wtWireAwait(lp, p, n64(4), n32(100000), true);
  t.ok("webtransport: a bidirectional stream of 100,000 bytes echoed whole on itself, past the 32 KiB buffers", bidi && h3IsPattern(p.stream(n64(4)).data) && toI32(p.stream(n64(4)).data.length) === 100000);

  lp.sendStream(n64(14), h3Cat([h3Varint(H3_STREAM_WEBTRANSPORT), h3Varint(n64(0)), bytesOf("one way")]), true);
  const uni: boolean = wtWireAwait(lp, p, SERVER_UNI, n32(10), true);
  t.eqStr(
    "webtransport: a unidirectional stream is echoed on one the server opens for the session",
    uni ? toHex(p.stream(SERVER_UNI).data) : "",
    toHex(h3Cat([h3Varint(H3_STREAM_WEBTRANSPORT), h3Varint(n64(0)), bytesOf("one way")]))
  );

  let id: i64 = n64(8);
  for (let k: i32 = 0; k < WARM; k++) {
    lp.sendQuicDatagram(wtWireDatagram(bytesOf(`warm ${k}`)));
    lp.sendStream(id, h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0)), bytesOf(`warm ${k}`)]), true);
    wtWireAwait(lp, p, id, n32(6), true);
    lp.awaitDatagrams(n32(2) + k);
    id = id + n64(4);
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    const text: string = roundText(k);
    lp.sendQuicDatagram(wtWireDatagram(bytesOf(text)));
    lp.sendStream(id, h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0)), bytesOf(text)]), true);
    const streamBack: boolean = wtWireAwait(lp, p, id, toI32(text.length), true) && textOf(p.stream(id).data) === text;
    const datagramBack: boolean = lp.awaitDatagrams(n32(2) + WARM + k) && toHex(lp.client.datagrams[1 + WARM + k]) === toHex(wtWireDatagram(bytesOf(text)));
    if (streamBack && datagramBack) {
      intact = intact + 1;
    }
    id = id + n64(4);
  }
  lp.meter = null;
  t.eqI32("webtransport: fifty rounds on the warm session, each a datagram and a new bidirectional stream echoed", intact, ROUNDS);
  t.ok(`webtransport: and every server call kept ${rounds.kept} bytes over them`, rounds.kept === n64(0));
  t.ok("webtransport: past the server's sixteen streams, the client waited on its MAX_STREAMS", lp.client.maxStreamsBidi > n64(16));

  const bye: u8[] = wtClosePayload(n64(7), bytesOf("bye"));
  lp.sendStream(n64(0), h3Frame(H3_FRAME_DATA, wtCapsule(WT_CAPSULE_CLOSE, bye)), true);
  const ended: boolean = wtWireAwait(lp, p, n64(0), n32(0), true);
  t.ok("webtransport: the client's CLOSE_WEBTRANSPORT_SESSION with code 7 and a reason: the server ends the CONNECT stream", ended);
  t.ok(
    "webtransport: and its program saw the client's code and reason",
    lp.wtApp.closeCode === n64(7) && lp.wtApp.closeReason === "bye" && lp.wtApp.closedByPeer
  );

  t.eqStr("webtransport: a second session on the connection", wtWireSession(lp, p, id), ":status: 200; sec-webtransport-http3-draft: draft02");
  const reason: u8[] = bytesOf("the server is done");
  t.eqI32("webtransport: the server closes it with code 9", lp.wts[0].close(id, n64(9), reason, n32(0), toI32(reason.length)), n32(0));
  s.touch(n32(0));
  const closed: boolean = wtWireAwait(lp, p, id, n32(0), true);
  t.eqStr(
    "webtransport: the client reads its CLOSE_WEBTRANSPORT_SESSION, code and reason, and the CONNECT stream's end",
    closed ? toHex(p.capsules(id)) : "",
    toHex(wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(9), reason)))
  );

  lp.closeConnection(H3_NO_ERROR);
  t.ok("webtransport: the client's CONNECTION_CLOSE frees the slot", lp.awaitIdle());

  let all: boolean = true;
  let low: i64 = n64(-1);
  let high: i64 = n64(0);
  for (let k: i32 = 0; k < 3; k++) {
    lp.newClient();
    const m = new LbMeter(true);
    lp.meter = m;
    const q: WtPeer = wtWireOpen(lp, s, limits);
    const session: string = wtWireSession(lp, q, n64(0));
    lp.sendQuicDatagram(wtWireDatagram(bytesOf("one")));
    const echoed: boolean = lp.awaitDatagrams(n32(1));
    lp.closeConnection(H3_NO_ERROR);
    const idle: boolean = lp.awaitIdle();
    lp.meter = null;
    all = all && session !== "" && echoed && idle;
    low = low < 0 || m.kept < low ? m.kept : low;
    high = m.kept > high ? m.kept : high;
  }
  t.ok("webtransport: three more connections, each a session and a datagram, closed by the client", all && s.accepted === 4);
  t.ok("webtransport: each keeps 80 to 128 KiB of arena from its Initial to its close (WT-1, H3-1's: the handshake's)", low >= n64(81920) && high <= n64(131072));
  t.ok("webtransport: the program was refused nothing and held nothing it could not place", lp.wtApp.refusals === 0 && lp.wtApp.table.overflows === 0);
  t.eqStr("webtransport: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};
