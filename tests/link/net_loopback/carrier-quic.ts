// QUIC: the plain-QUIC carrier of `udp.ts`, a `QuicListener` in front of a
// reusable `QuicConnection` slot answered by `QuicApp`, and the wire client.
// A request on a bidirectional stream, 100,000 bytes echoed both ways (past
// the server's 16,384-byte stream buffers and 65,536-byte connection credit,
// so the client waits on MAX_STREAM_DATA and MAX_DATA it reads off the wire),
// a DATAGRAM each way, rounds on a warm stream with the arena measured, the
// client's CONNECTION_CLOSE observed by the server, and a connection the
// server closes with what it keeps from Initial to close.
import { Suite } from "nish/testing";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QuicServerConfig } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { Http3Config, Http3Connection } from "nish/net/http3";
import { WebTransportConfig } from "nish/net/webtransport";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { ECHO_ALPN, echoConfig } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, qcHello, qcParams } from "../net_quic_conn/client";
import { H3Peer, h3Fresh, h3IsPattern, h3Pattern } from "../net_http3/peer";
import { CARRIER_QUIC, QuicEchoServer, UdpLoop } from "./udp";
import { LbMeter, ROUNDS, WARM, lbHandshakeBand, roundText } from "./common";

/** The echo's configuration, with DATAGRAM frames of up to 1,200 bytes. */
const quicLoopConfig = (): QuicServerConfig => {
  const config: QuicServerConfig = echoConfig();
  config.maxDatagramFrameSize = n64(1200);
  return config;
};

/** The client's hello: the echo's ALPN, generous credit for the server, and DATAGRAM frames. */
const quicLoopHello = (): u8[] => {
  const p = qcParams(fromHex(CLIENT_SCID), n64(16777216));
  p.initialMaxData = n64(67108864);
  p.maxDatagramFrameSize = n64(1200);
  return qcHello([TLS_AES_128_GCM_SHA256], ECHO_ALPN, quicEncodeTransportParameters(p));
};

/** A reader of what the server sends on its streams: the HTTP/3 lane's peer, its client half only (see `udp.ts`). */
const quicReader = (lp: UdpLoop): H3Peer => {
  const detached: Http3Connection = h3Fresh();
  return new H3Peer(detached.quic, detached, lp.client.c);
};

/** Runs the loop until stream `id` has brought `n` bytes, or its FIN when `fin`; false on a timeout. */
export const quicAwait = (lp: UdpLoop, p: H3Peer, id: i64, n: i32, fin: boolean): boolean => {
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

/** A connection from its Initial to the server's close, with one echo and one datagram, under `m`; whether it all went as it should. */
const quicWholeConnection = (lp: UdpLoop, q: QuicEchoServer, m: LbMeter): boolean => {
  lp.newClient();
  const p: H3Peer = quicReader(lp);
  lp.meter = m;
  const shook: boolean = lp.connect(quicLoopHello());
  lp.sendStream(n64(0), bytesOf("one more"), true);
  const echoed: boolean = quicAwait(lp, p, n64(0), n32(8), true);
  const datagram: boolean = textOf(lp.datagramRoundTrip(bytesOf("one datagram"))) === "one datagram";
  q.conn.close(n64(9));
  const closed: boolean = lp.awaitClose() && lp.awaitIdle();
  lp.meter = null;
  return shook && echoed && datagram && closed && lp.client.closeCode === n64(9) && lp.client.closeApp && !q.lastClosedByPeer;
};

/** Every check of the QUIC carrier. */
export const quicChecks = (t: Suite): void => {
  const config: QuicServerConfig = quicLoopConfig();
  const lp = new UdpLoop(CARRIER_QUIC, config, new Http3Config(), new WebTransportConfig(), n32(1));
  const q: QuicEchoServer | null = lp.quic;
  if (q === null) {
    t.fail("quic: a server", "none was made");
    return;
  }
  const p: H3Peer = quicReader(lp);
  t.ok("quic: a handshake across loopback, through the listener into the slot", lp.connect(quicLoopHello()) && q.accepted === 1 && q.busy);
  t.ok(
    "quic: the client read the server's transport parameters from its EncryptedExtensions",
    lp.client.maxData === config.maxData && lp.client.initialBidi === config.maxStreamData && lp.client.maxStreamsBidi === config.maxStreamsBidi
  );

  lp.sendStream(n64(0), bytesOf("GET / over quic"), true);
  t.ok("quic: a request on stream 0 is echoed, and its FIN", quicAwait(lp, p, n64(0), n32(15), true) && textOf(p.stream(n64(0)).data) === "GET / over quic");

  const body: u8[] = h3Pattern(n32(100000));
  const sent: boolean = lp.sendStream(n64(4), body, true);
  const back: boolean = quicAwait(lp, p, n64(4), n32(100000), true);
  t.ok("quic: 100,000 bytes on stream 4 echoed whole, and its FIN", sent && back && h3IsPattern(p.stream(n64(4)).data) && toI32(p.stream(n64(4)).data.length) === 100000);
  t.ok(
    "quic: past the server's 16,384-byte stream buffer and 65,536 bytes of connection credit, the client waited on MAX_STREAM_DATA and MAX_DATA",
    lp.client.limits[lp.client.at(n64(4))] >= n64(100000) && lp.client.maxData >= n64(100000)
  );

  t.ok("quic: a DATAGRAM is echoed as one", textOf(lp.datagramRoundTrip(bytesOf("a datagram each way"))) === "a datagram each way");

  let expected: string = "";
  for (let k: i32 = 0; k < WARM; k++) {
    expected = `${expected}warm ${k};`;
    lp.sendStream(n64(8), bytesOf(`warm ${k};`), false);
    lp.datagramRoundTrip(bytesOf(`warm ${k}`));
    quicAwait(lp, p, n64(8), toI32(expected.length), false);
  }
  const rounds = new LbMeter(false);
  lp.meter = rounds;
  let datagrams: i32 = 0;
  for (let k: i32 = 0; k < ROUNDS; k++) {
    expected = `${expected}${roundText(k)};`;
    lp.sendStream(n64(8), bytesOf(`${roundText(k)};`), false);
    const datagram: string = textOf(lp.datagramRoundTrip(bytesOf(roundText(k))));
    quicAwait(lp, p, n64(8), toI32(expected.length), false);
    if (datagram === roundText(k)) {
      datagrams = datagrams + 1;
    }
  }
  lp.meter = null;
  t.ok("quic: fifty rounds on the warm stream 8, each echoed with a datagram beside it", textOf(p.stream(n64(8)).data) === expected && datagrams === ROUNDS);
  t.ok(`quic: and every server call kept ${rounds.kept} bytes over them`, rounds.kept === n64(0));

  lp.closeConnection(n64(7));
  t.ok("quic: the client's CONNECTION_CLOSE with code 7 reaches the server, which drains and frees the slot", lp.awaitIdle());
  t.ok("quic: as the client's close, the application's, with its code", q.lastClosedByPeer && q.lastErrorApp && q.lastError === n64(7));

  let all: boolean = true;
  let inBand: boolean = true;
  for (let k: i32 = 0; k < 3; k++) {
    const m = new LbMeter(true);
    all = quicWholeConnection(lp, q, m) && all;
    inBand = inBand && lbHandshakeBand(m.kept);
  }
  t.ok("quic: three more connections through the slot, each closed by the server with code 9, which the client reads", all && q.accepted === 4);
  // The figure moves by a few kilobytes between connections (the listener's
  // answers around the close), so it is pinned as a band (`lbHandshakeBand`).
  t.ok("quic: each keeps 1 to 6 KiB of arena from its Initial to its close, none of it the QUIC connection's or the signature's (H3-1, QUIC-3)", inBand);
  t.eqI32("quic: no datagram was dropped by the program", q.app.dropped, n32(0));
  t.eqStr("quic: with nothing gone wrong in the loop", lp.failure, "");
  lp.shutdown();
};
