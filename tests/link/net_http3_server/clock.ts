// The HTTP/3 side's clock in `Http3Server` (H3-5): three clients across
// loopback on one shared clock, against a server whose `headTimeout` is 300
// ms and `idleTimeout` 1,000 ms. One sends a GET every 20 ms; one trickles a
// request's HEADERS frame a byte at a time, as slowloris does; one opens its
// streams and then only sends PING, which keeps its QUIC connection alive
// but is no progress of HTTP/3's.
// The program writes no timer: the trickler loses its slot to
// H3_EXCESSIVE_LOAD past the head timeout, the idle client to H3_NO_ERROR
// past the idle one, and the active client keeps its slot throughout.
import { netLocalPort, udpBind } from "nish:net";
import { Suite } from "nish/testing";
import { H3_EXCESSIVE_LOAD, H3_NO_ERROR } from "nish/net/http3-frame";
import { H3_ALPN, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { QuicConnection } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { CLIENT_SCID, QcClient, qcConnect } from "../net_quic_conn/client";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { n32, n64 } from "../net_quic_frame/typed";
import { H3Limits, H3Peer, h3Config, h3Hello, h3QuicConfig, h3WireConnect } from "../net_http3/peer";
import { listenerEntropy } from "./loopback";

/** The shared clock: `p`'s, and every later step's, is at least `now`. */
const sync = (p: H3Peer, now: i64): void => {
  if (p.c.now < now) {
    p.c.now = now;
  }
};

/** An idle client and a trickling one lose their slots at the clock's timeouts, and an active one keeps its own. */
const clocked = (t: Suite): void => {
  const limits = new H3Limits();
  const config = h3Config();
  config.headTimeout = n32(300);
  config.idleTimeout = n32(1000);
  const fd: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  const port: i32 = netLocalPort(fd);
  const server = new Http3Server(h3QuicConfig(limits), config, fd, n32(4), listenerEntropy());
  const active: H3Peer = h3WireConnect(server, port, limits);
  const slow: H3Peer = h3WireConnect(server, port, limits);
  const quiet: H3Peer = h3WireConnect(server, port, limits);
  if (!t.ok("three clients, each in a slot of its own", server.busy() === n32(3))) {
    return;
  }
  let now: i64 = active.c.now;
  for (const p of [slow, quiet]) {
    now = p.c.now > now ? p.c.now : now;
  }
  for (const p of [active, slow, quiet]) {
    sync(p, now);
    p.open(n64(-1));
    p.settle();
    now = p.c.now;
  }
  // A HEADERS frame longer than the steps, so it never arrives whole.
  const pad: string[] = ["x-pad"];
  let fill: string = "";
  for (let k: i32 = 0; k < 200; k++) {
    fill = fill + "p";
  }
  const padding: string[] = [fill];
  const head: u8[] = slow.headers("GET", "/hello", pad, padding);
  const start: i64 = now;
  let id: i64 = n64(0);
  let served: i32 = 0;
  let early: i32 = -1;
  let middle: string = "";
  let step: i32 = 0;
  // Each step takes the shared clock 20 ms on, and the exchanges a few more.
  while (now - start < n64(1500) && step < 200) {
    now = now + n64(20);
    sync(active, now);
    active.get(id, "/hello");
    active.settle();
    if (active.response(id).status === "200") {
      served++;
    }
    id = id + n64(4);
    now = active.c.now;
    if (slow.closeCode < 0 && step < toI32(head.length)) {
      sync(slow, now);
      const one: u8[] = [head[step]];
      slow.send(n64(0), one, false);
      now = slow.c.now;
    }
    if (quiet.closeCode < 0) {
      sync(quiet, now);
      quiet.packet([toU8(1)]);
      now = quiet.c.now;
    }
    const elapsed: i64 = now - start;
    if (elapsed < n64(250)) {
      early = server.busy();
    }
    if (elapsed > n64(400) && elapsed < n64(900)) {
      middle = `${server.busy()} ${slow.closeCode} ${quiet.closeCode}`;
    }
    step++;
  }
  t.ok("the steps took the clock past the idle timeout", now - start > n64(1000) && step > 20);
  t.eqI32("under 250 ms in, inside both timeouts, all three hold their slots", early, n32(3));
  t.eqStr(
    "between 400 and 900 ms in, the trickler is closed with H3_EXCESSIVE_LOAD and the idle client is not yet",
    middle,
    `2 ${H3_EXCESSIVE_LOAD} -1`
  );
  t.eqStr("the trickler's close is the application's", `${slow.closeApp}`, "true");
  t.eqStr("past 1,000 ms, the idle client is closed with H3_NO_ERROR", `${quiet.closeApp} ${quiet.closeCode}`, `true ${H3_NO_ERROR}`);
  t.eqStr("and the active client keeps its slot, every GET answered", `${active.closeCode} ${server.busy()} ${served === step}`, "-1 1 true");
  server.stop();
};

/**
 * A connection the program never asks for an event is not HTTP/3's to time:
 * the interop server runs `hq-interop` in an `Http3Server` slot this way, and
 * a transfer slower than `idleTimeout` was closed with H3_NO_ERROR under it.
 * QUIC's own idle timeout still bounds such a connection.
 */
const unstarted = (t: Suite): void => {
  const limits = new H3Limits();
  limits.alpn = "hq-interop";
  const quicConfig = h3QuicConfig(limits);
  quicConfig.alpn = [H3_ALPN, "hq-interop"];
  const config = h3Config();
  config.idleTimeout = n32(1000);
  const conn = new QuicConnection(quicConfig, fixedEntropy());
  const h3 = new Http3Connection(config, conn);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  if (!t.ok("a client that chose hq-interop connects", qcConnect(conn, c, h3Hello(limits)) && conn.alpn === "hq-interop")) {
    return;
  }
  const first: i64 = h3.clock(n64(10));
  const later: i64 = h3.clock(n64(5000));
  t.eqStr(
    "past idleTimeout, the clock of a connection never asked for an event neither closes it nor asks for a look",
    `${first} ${later} ${conn.closed()}`,
    "-1 -1 false"
  );
};

/** Every check of this file. */
export const clockChecks = (t: Suite): void => {
  clocked(t);
  unstarted(t);
};
