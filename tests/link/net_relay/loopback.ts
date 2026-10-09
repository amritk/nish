// The relay across loopback (`rig.ts`): a session's whole life — hello and
// HELLO_OK, DATA both ways at the edges, PING and PONG, STATS, a CLOSE from
// either side — and every refusal with its close code, each driven on the
// rig's clock rather than waited for.
import { Suite } from "nish/testing";
import {
  CLOSE_IDLE,
  CLOSE_PROTOCOL_ERROR,
  CLOSE_RATE_LIMITED,
  CLOSE_SHUTDOWN,
  CLOSE_TOKEN_EXPIRED,
  CLOSE_TOKEN_INVALID,
  CLOSE_UPSTREAM_UNREACHABLE,
  RELAY_CLOSE,
  RELAY_DATA,
  RELAY_PING,
  RELAY_PONG,
  RELAY_PROTOCOL_VERSION,
  RELAY_STATS,
  RelayFrame,
  relayDecode,
  relayEncodeClose,
} from "../../../examples/relay/frame";
import { RELAY_CLOSING, RELAY_FREE, RelayConfig } from "../../../examples/relay/relay";
import { fromHex, toHex } from "../crypto_x509/hex";

import { n32, n64 } from "../net_quic_frame/typed";
import { SECRET, signGrant } from "./grants";
import { frameText, prefix } from "./frames";
import { RIG_WALL, Rig, RigClient, RigEcho, rigGrant, rigHello } from "./rig";
import { udpSendTo } from "nish:net";
import { H3_FRAME_HEADERS } from "nish/net/http3-frame";
import { h3Frame, h3Section } from "../net_http3/peer";

/** The rig's relay: small caps, quiet. */
export const rigConfig = (): RelayConfig => {
  const config = new RelayConfig();
  config.maxSessions = 4;
  config.maxPerPeer = 4;
  config.spareSlots = 2;
  config.verbose = false;
  return config;
};

/** A DATA frame of `seq` and `n` bytes of `byte`. */
export const rigData = (seq: i32, n: i32, byte: i32): u8[] => {
  const out: u8[] = [toU8(RELAY_DATA), toU8(seq & 255), toU8((seq >> 8) & 255)];
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(byte));
  }
  return out;
};

/** `n` bytes of `byte`. */
const fill = (n: i32, byte: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  out.fill(toU8(byte));
  return out;
};

/** A CLOSE frame of `code` and `reason`. */
const closeFrame = (code: i32, reason: string): u8[] => {
  const out: u8[] = new Array<u8>(64);
  return prefix(out, relayEncodeClose(out, n32(0), code, reason));
};

/** What the last datagram the relay sent `c` says, when it is a CLOSE: "code reason", else its type. */
const lastClose = (c: RigClient): string => {
  const d: u8[] = c.last();
  const f = new RelayFrame();
  const type: i32 = relayDecode(f, d, n32(0), toI32(d.length));
  return type === RELAY_CLOSE ? `${f.code} ${frameText(f, d)}` : `type ${type}`;
};

/** How the QUIC connection of `c` was closed: "app <code>", "transport <code>", or "open". */
const ended = (c: RigClient): string => (c.closeCode < 0 ? "open" : `${c.closeApp ? "app" : "transport"} ${c.closeCode}`);

/** The datagrams of type `type` the relay sent `c`. */
const ofType = (c: RigClient, type: i32): u8[][] => {
  const out: u8[][] = [];
  for (const d of c.datagrams) {
    if (toI32(d.length) > 0 && toI32(d[0]) === type) {
      out.push(d);
    }
  }
  return out;
};

/** A session's life: hello and HELLO_OK, DATA both ways, PING and PONG, STATS, and a CLOSE from the client. */
const life = (t: Suite): void => {
  const rig = new Rig(rigConfig(), false);
  const c: RigClient = rig.session(n32(1), "127.0.0.1");
  t.eqStr("the CONNECT is answered 200", c.status(), "200");
  t.eqStr("the hello is answered HELLO_OK: session 1, 1,200 bytes", toHex(c.last()), "0201000000b004");
  t.eqI32("the session holds a place in both caps", rig.relay.live, n32(1));

  // Up: the largest payload is forwarded, one byte more is not.
  c.send(rigData(n32(1), n32(1200), n32(0xab)));
  rig.settle(n32(50));
  c.send(rigData(n32(2), n32(1201), n32(0xcd)));
  rig.settle(n32(50));
  t.eqStr("a DATA payload of 1,200 bytes reaches the game server whole, and one of 1,201 does not", rig.echo.seen(), "1200");
  t.eqI32("the refused one is counted", rig.relay.oversized, n32(1));
  // Down: the game server's echo of 1,200 bytes does not fit the client's path (1,164 does).
  t.eqI32("the echo of 1,200 bytes cannot go down whole and is dropped, counted", rig.relay.droppedDown, n32(1));
  rig.echo.reply(fill(n32(1164), n32(0x5a)));
  rig.settle(n32(50));
  const down: u8[][] = ofType(c, RELAY_DATA);
  t.ok(
    "1,164 bytes from the game server reach the client as DATA, seq 2 after the dropped one's 1",
    toI32(down.length) === n32(1) && toI32(down[0].length) === n32(1167) && down[0][1] === toU8(2) && down[0][3] === toU8(0x5a)
  );
  rig.echo.reply(fill(n32(1165), n32(0x5b)));
  rig.settle(n32(50));
  t.ok("1,165 do not, and are counted", toI32(ofType(c, RELAY_DATA).length) === n32(1) && rig.relay.droppedDown === n32(2));

  const empty: u8[] = [];
  c.send(empty);
  c.send(fromHex("040700000040e2010000000000"));
  rig.settle(n32(50));
  const pongs: u8[][] = ofType(c, RELAY_PONG);
  t.ok(
    "a PING is answered with a PONG carrying its id and clock, and the relay's dwell",
    toI32(pongs.length) === n32(1) && toI32(pongs[0].length) === n32(17) && toHex(pongs[0]).startsWith("050700000040e2010000000000")
  );
  t.eqI32("an empty datagram is a bad frame, counted, not fatal", rig.relay.badFrames, n32(1));

  rig.advance(n64(2000), n64(250));
  const stats: u8[][] = ofType(c, RELAY_STATS);
  t.eqStr("STATS after two seconds: one DATA forwarded in (the oversized one is not counted), three datagrams from the game server", toI32(stats.length) === n32(1) ? toHex(stats[0]).substring(10, 26) : `${stats.length} STATS`, "0100000003000000");
  rig.advance(n64(2000), n64(250));
  t.ok("and again two seconds later, its counters reset", toI32(ofType(c, RELAY_STATS).length) === n32(2) && toHex(c.last()).substring(10, 26) === "0000000000000000");

  c.send(rigData(n32(3), n32(0), n32(0)));
  rig.settle(n32(50));
  t.eqStr("an empty DATA payload is forwarded as an empty datagram", rig.echo.seen(), "1200 0");
  c.send(fromHex("0201000000b004"));
  c.send(fromHex("7f"));
  c.send(rigHello(rigGrant("127.0.0.1", rig.echo.port), RELAY_PROTOCOL_VERSION));
  rig.settle(n32(50));
  t.ok("a HELLO_OK and an unknown type from the client are bad frames, a second HELLO is ignored; the session lives", rig.relay.badFrames === n32(3) && ended(c) === "open");

  c.send(closeFrame(n32(0), "bye"));
  rig.settle(n32(50));
  t.eqStr("a CLOSE from the client ends the session: the connection closed with code 0", ended(c), "app 0");
  t.ok("its places given back", rig.relay.live === n32(0) && rig.relay.peers.used === n32(0) && rig.relay.clientClosed === n32(1));
};

/** The relay's own ends of a session: idle, the rate cap, and a shutdown. */
const relayEnds = (t: Suite): void => {
  const rig = new Rig(rigConfig(), false);
  const idle: RigClient = rig.session(n32(1), "127.0.0.1");
  rig.advance(n64(10000), n64(500));
  t.eqStr("ten seconds without a datagram is not yet idle", ended(idle), "open");
  rig.advance(n64(2000), n64(500));
  t.eqStr("at the next STATS tick past ten seconds the session is idle: CLOSE IDLE", lastClose(idle), `${CLOSE_IDLE} idle`);
  t.ok("and the connection closed with code 0, counted", ended(idle) === "app 0" && rig.relay.idleClosed === n32(1));

  rig.echo.silent = true;
  const fast: RigClient = rig.session(n32(2), "127.0.0.1");
  const four: u8[][] = [rigData(n32(1), n32(1), n32(1)), rigData(n32(2), n32(1), n32(1)), rigData(n32(3), n32(1), n32(1)), rigData(n32(4), n32(1), n32(1))];
  for (let k: i32 = 0; k < 64; k++) {
    fast.datagram(four);
    rig.settle(n32(20));
  }
  t.eqStr("256 datagrams inside a second are within the cap", ended(fast), "open");
  fast.send(rigData(n32(5), n32(1), n32(1)));
  rig.settle(n32(50));
  t.eqStr("the 257th is RATE_LIMITED", lastClose(fast), `${CLOSE_RATE_LIMITED} sending far faster than the tick rate`);
  t.eqI32("counted", rig.relay.rateLimited, n32(1));
  t.eqStr("and the connection closed with code 0", ended(fast), "app 0");

  const steady: RigClient = rig.session(n32(3), "127.0.0.1");
  for (let k: i32 = 0; k < 3; k++) {
    for (let j: i32 = 0; j < 50; j++) {
      steady.datagram(four);
      rig.settle(n32(20));
    }
    rig.advance(n64(1000), n64(1000));
  }
  t.eqStr("200 datagrams a second for three seconds is within it: the window starts again each second", ended(steady), "open");

  const other: RigClient = rig.session(n32(4), "127.0.0.1");
  rig.relay.shutdown(rig.now);
  rig.settle(n32(50));
  t.ok(
    "a shutdown sends CLOSE SHUTDOWN to every session and closes each connection with code 0",
    lastClose(steady) === `${CLOSE_SHUTDOWN} the relay is shutting down` &&
      lastClose(other) === `${CLOSE_SHUTDOWN} the relay is shutting down` &&
      ended(steady) === "app 0" &&
      ended(other) === "app 0"
  );
  t.ok("and gives back every place", rig.relay.live === n32(0) && rig.relay.peers.used === n32(0));
};

/** The hello and the grant: each refusal with grant.rs's or main.rs's close code. */
const refusals = (t: Suite): void => {
  const rig = new Rig(rigConfig(), false);
  const silent: RigClient = rig.connect(n32(1), "127.0.0.1");
  silent.open("/cs");
  rig.settle(n32(50));
  rig.advance(n64(4900), n64(700));
  t.eqStr("an accepted session has five seconds to say hello", ended(silent), "open");
  rig.advance(n64(200), n64(200));
  t.ok("past them it is closed with code 1 and no CLOSE frame, as main.rs closes it", ended(silent) === "app 1" && toI32(silent.datagrams.length) === n32(0));

  const wrongSecret: RigClient = rig.connect(n32(2), "127.0.0.1");
  wrongSecret.open("/cs");
  rig.settle(n32(50));
  wrongSecret.send(rigHello(signGrant(`{"host":"127.0.0.1","port":${rig.echo.port},"expiresAt":4102444800000}`, "not-the-secret"), RELAY_PROTOCOL_VERSION));
  rig.settle(n32(50));
  t.eqStr("a grant signed with another secret: TOKEN_INVALID", lastClose(wrongSecret), `${CLOSE_TOKEN_INVALID} bad signature`);
  t.eqStr("the connection closed with code 1", ended(wrongSecret), "app 1");

  const expired: RigClient = rig.connect(n32(3), "127.0.0.1");
  expired.open("/cs");
  rig.settle(n32(50));
  expired.send(rigHello(signGrant(`{"host":"127.0.0.1","port":${rig.echo.port},"expiresAt":${RIG_WALL - n64(1)}}`, SECRET), RELAY_PROTOCOL_VERSION));
  rig.settle(n32(50));
  t.eqStr("an expired grant: TOKEN_EXPIRED", lastClose(expired), `${CLOSE_TOKEN_EXPIRED} token expired`);

  const notHello: RigClient = rig.connect(n32(4), "127.0.0.1");
  notHello.open("/cs");
  rig.settle(n32(50));
  notHello.send(rigData(n32(1), n32(4), n32(1)));
  rig.settle(n32(50));
  t.eqStr("a first datagram that is not a HELLO: PROTOCOL_ERROR", lastClose(notHello), `${CLOSE_PROTOCOL_ERROR} expected a hello`);

  const version: RigClient = rig.connect(n32(5), "127.0.0.1");
  version.open("/cs");
  rig.settle(n32(50));
  version.send(rigHello(rigGrant("127.0.0.1", rig.echo.port), n32(2)));
  rig.settle(n32(50));
  t.eqStr("a HELLO of version 2: PROTOCOL_ERROR", lastClose(version), `${CLOSE_PROTOCOL_ERROR} unsupported relay protocol version`);

  const named: RigClient = rig.connect(n32(6), "127.0.0.1");
  named.open("/cs");
  rig.settle(n32(50));
  named.send(rigHello(rigGrant("game.example", n32(9)), RELAY_PROTOCOL_VERSION));
  rig.settle(n32(50));
  t.eqStr("a grant naming a host that does not resolve: UPSTREAM_UNREACHABLE", lastClose(named), `${CLOSE_UPSTREAM_UNREACHABLE} cannot resolve the game server`);
  t.ok("each refusal gives its places back", rig.relay.live === n32(0) && rig.relay.peers.used === n32(0));
  t.eqStr(
    "and each is counted: a hello timeout, two bad grants, two bad hellos, an unreachable upstream",
    `${rig.relay.helloTimeouts} ${rig.relay.refusedGrant} ${rig.relay.refusedHello} ${rig.relay.refusedUpstream}`,
    "1 2 2 1"
  );

  const lost: RigClient = rig.connect(n32(7), "127.0.0.1");
  lost.open("/elsewhere");
  rig.settle(n32(50));
  t.eqStr("a session on another path is answered 404, and no session is made", `${lost.status()} ${rig.relay.refusedPath} ${rig.relay.accepted}`, "404 1 6");
  const local: RigClient = rig.connect(n32(8), "127.0.0.1");
  local.open("/cs");
  rig.settle(n32(50));
  local.send(rigHello(rigGrant("localhost", rig.echo.port), RELAY_PROTOCOL_VERSION));
  rig.settle(n32(50));
  t.eqStr("a grant naming localhost reaches the loopback", toHex(local.last()).substring(0, 2), "02");
};

/** The two caps: sessions in total, and sessions from one address. */
const caps = (t: Suite): void => {
  const config: RelayConfig = rigConfig();
  config.maxSessions = 2;
  config.maxPerPeer = 2;
  const rig = new Rig(config, false);
  // Three addresses, so that the third meets the global cap alone.
  const a: RigClient = rig.session(n32(1), "127.0.0.1");
  const b: RigClient = rig.session(n32(2), "127.0.0.2");
  const over: RigClient = rig.session(n32(3), "127.0.0.3");
  t.ok("two sessions under a cap of two", toHex(a.last()).startsWith("02") && toHex(b.last()).startsWith("02"));
  t.eqStr("a third is told the relay is full", lastClose(over), `${CLOSE_RATE_LIMITED} the relay is holding as many sessions as it will`);
  t.eqStr("and closed with code 1", ended(over), "app 1");
  a.send(closeFrame(n32(0), "bye"));
  rig.settle(n32(50));
  const again: RigClient = rig.session(n32(4), "127.0.0.1");
  t.eqStr("a departure frees its place: the next one is accepted", toHex(again.last()).substring(0, 2), "02");
  b.quit();
  rig.settle(n32(50));
  const next: RigClient = rig.session(n32(5), "127.0.0.1");
  t.eqStr("a connection the client closes in QUIC alone frees its place in the same step: the next one is accepted at once", toHex(next.last()).substring(0, 2), "02");
  again.finConnect();
  rig.settle(n32(50));
  t.ok("a client ending its CONNECT stream ends the session: closed with code 0, counted", ended(again) === "app 0" && rig.relay.disconnected === n32(1));

  const perPeer: RelayConfig = rigConfig();
  perPeer.maxPerPeer = 2;
  const rig2 = new Rig(perPeer, false);
  const p1: RigClient = rig2.session(n32(1), "127.0.0.1");
  const p2: RigClient = rig2.session(n32(2), "127.0.0.1");
  const p3: RigClient = rig2.session(n32(3), "127.0.0.1");
  const q1: RigClient = rig2.session(n32(4), "127.0.0.2");
  t.ok("two from one address under a cap of two", toHex(p1.last()).startsWith("02") && toHex(p2.last()).startsWith("02"));
  t.eqStr("a third from it is refused", lastClose(p3), `${CLOSE_RATE_LIMITED} too many sessions from this address`);
  t.ok("another address is unaffected", toHex(q1.last()).startsWith("02"));
  t.ok("a refused session hands its global place back, and its address holds no extra row", rig2.relay.live === n32(3) && rig2.relay.peers.used === n32(2));
};

/** A handshake holds both places from its first Initial, and only until the hello deadline unless it opens a session. */
const connecting = (t: Suite): void => {
  const config: RelayConfig = rigConfig();
  config.maxSessions = 66;
  config.maxPerPeer = 64;
  const rig = new Rig(config, false);
  const held: RigClient[] = [];
  for (let k: i32 = 1; k <= 64; k++) {
    held.push(rig.connect(k, "127.0.0.1"));
  }
  let connected: i32 = 0;
  for (const c of held) {
    connected = connected + (c.connected ? 1 : 0);
  }
  t.ok("64 handshakes from one address, none of them opening a session, hold 64 places of the address", connected === n32(64) && rig.relay.live === n32(64) && rig.relay.peers.used === n32(1) && rig.relay.accepted === n32(0));
  const over: RigClient = rig.connect(n32(65), "127.0.0.1");
  over.open("/cs");
  rig.settle(n32(50));
  t.eqStr("the 65th is refused while the 64 are still connecting", lastClose(over), `${CLOSE_RATE_LIMITED} too many sessions from this address`);
  t.eqStr("and closed with code 1", ended(over), "app 1");
  rig.advance(n64(4900), n64(700));
  t.ok("a handshake is kept while its hello deadline has not passed", ended(held[0]) === "open" && rig.relay.connectTimeouts === n32(0));
  rig.advance(n64(200), n64(200));
  let closed: i32 = 0;
  for (const c of held) {
    closed = closed + (ended(c) === "app 1" && toI32(c.datagrams.length) === n32(0) ? 1 : 0);
  }
  t.ok("at five seconds from its first Initial each is closed with code 1, counted, and its places given back", closed === n32(64) && rig.relay.connectTimeouts === n32(64) && rig.relay.live === n32(0) && rig.relay.peers.used === n32(0));

  const rig2 = new Rig(rigConfig(), false);
  const pinging: RigClient = rig2.connect(n32(1), "127.0.0.1");
  for (let k: i32 = 0; k < 7; k++) {
    // An ack-eliciting PING every 700 ms, 4.9 s of them, keeps QUIC alive but opens no session.
    pinging.packet([toU8(0x01)]);
    rig2.advance(n64(700), n64(700));
  }
  t.eqStr("a connection that keeps pinging is kept until the deadline", ended(pinging), "open");
  pinging.packet([toU8(0x01)]);
  rig2.advance(n64(200), n64(200));
  t.ok("a connection that keeps pinging and never sends CONNECT is closed at the hello deadline", ended(pinging) === "app 1" && rig2.relay.connectTimeouts === n32(1) && rig2.relay.live === n32(0));
};

/** One address that only handshakes holds at most its own cap of global places, and a bounded number of slots past it. */
const oneAddress = (t: Suite): void => {
  const config: RelayConfig = rigConfig();
  config.maxPerPeer = 2;
  const rig = new Rig(config, false);
  // Six handshakes from one address, none sending CONNECT: the whole pool of 4 sessions and 2 spare slots.
  for (let k: i32 = 1; k <= 6; k++) {
    rig.connect(k, "127.0.0.1");
  }
  rig.settle(n32(50));
  let held: i32 = 0;
  for (let slot: i32 = 0; slot < rig.relay.size(); slot++) {
    const state: i32 = rig.relay.states[slot];
    held = held + (state !== RELAY_FREE && state !== RELAY_CLOSING ? 1 : 0);
  }
  t.ok("handshakes alone from one address take no more global places than its cap of 2", rig.relay.live <= n32(2));
  t.ok("and hold no more slots than its cap and the 2 spare ones", held <= n32(4));
  t.ok("the two past that are closed with code 1 at their first Initial, counted", rig.relay.shed === n32(2) && rig.relay.unplacedCount === n32(2));
  const other: RigClient = rig.session(n32(7), "127.0.0.2");
  t.eqStr("another address still opens a session and is answered HELLO_OK", toHex(other.last()).substring(0, 2), "02");
  other.send(rigData(n32(1), n32(10), n32(0x77)));
  rig.settle(n32(50));
  t.ok("and its DATA goes up and comes back down", rig.echo.seen() === "10" && toI32(ofType(other, RELAY_DATA).length) === n32(1));
};

/** GSO and GRO both ways with `--offload`. */
const offload = (t: Suite): void => {
  const config: RelayConfig = rigConfig();
  config.offload = true;
  const rig = new Rig(config, true);
  const c: RigClient = rig.session(n32(1), "127.0.0.1");
  rig.echo.silent = true;
  c.datagram([rigData(n32(1), n32(300), n32(1)), rigData(n32(2), n32(300), n32(2)), rigData(n32(3), n32(300), n32(3)), rigData(n32(4), n32(100), n32(4))]);
  rig.settle(n32(50));
  t.eqStr("four DATA in one pass leave in one GSO send, the shorter last", rig.echo.seen(), "300 300 300 100");
  t.ok("read back by the game server's GRO socket as one", rig.relay.gsoSends === n32(1) && rig.echo.coalesced === n32(1));
  rig.echo.burst = fill(n32(600), n32(9));
  rig.echo.burstSegment = n32(200);
  rig.echo.serve();
  rig.settle(n32(50));
  const down: u8[][] = ofType(c, RELAY_DATA);
  t.ok("a GSO burst from the game server arrives as one GRO read, cut into three DATA", rig.relay.groReads === n32(1) && toI32(down.length) === n32(3) && toI32(down[2].length) === n32(203));
};

/** A warm session keeps nothing in the arena: DATA both ways, PING, STATS, a datagram from a stranger, a stream turned away. */
const warm = (t: Suite): void => {
  const rig = new Rig(rigConfig(), false);
  const c: RigClient = rig.session(n32(1), "127.0.0.1");
  for (let k: i32 = 0; k < 20; k++) {
    c.send(rigData(k, n32(200), n32(1)));
    rig.settle(n32(20));
  }
  rig.measuring = true;
  // 20 ms a round, as a loop's clock moves: the pacer lets each round's datagrams out.
  for (let k: i32 = 0; k < 200; k++) {
    c.send(rigData(k, n32(300), n32(2)));
    c.send(fromHex("040700000040e2010000000000"));
    rig.advance(n64(20), n64(20));
  }
  rig.measuring = false;
  t.eqStr(
    "200 rounds of a DATA each way and a PING, and a STATS every two seconds, on a warm session",
    `${ofType(c, RELAY_DATA).length} ${ofType(c, RELAY_PONG).length} ${ofType(c, RELAY_STATS).length} ${rig.relay.droppedDown}`,
    "220 200 2 0"
  );
  t.eqI64("keep no arena memory in the relay", rig.kept, n64(0));

  // A datagram to the upstream socket from anyone but the granted game server is dropped.
  const stranger = new RigEcho(false);
  const before: i32 = toI32(ofType(c, RELAY_DATA).length);
  udpSendTo(stranger.fd, fill(n32(10), n32(3)), n32(0), n32(10), rig.echo.last, n32(0), n32(0));
  rig.settle(n32(20));
  t.ok("a datagram to the upstream socket from another address is dropped and counted", rig.relay.foreign === n32(1) && toI32(ofType(c, RELAY_DATA).length) === before);

  // A WebTransport stream: the relay uses datagrams alone, and turns it away.
  c.stream(n64(4), fromHex("4041000102"), false);
  rig.settle(n32(20));
  c.send(rigData(n32(1), n32(5), n32(5)));
  rig.settle(n32(20));
  t.ok("a stream the client opens is reset, and the session goes on", ended(c) === "open" && rig.relay.forwardedUp >= n32(221));

  // A plain HTTP/3 request on the same port is answered 404.
  const plain: RigClient = rig.connect(n32(2), "127.0.0.1");
  plain.open("/cs");
  rig.settle(n32(20));
  const get: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(plain.enc, [":method", ":scheme", ":authority", ":path"], ["GET", "https", "localhost", "/"]));
  plain.stream(n64(4), get, true);
  rig.settle(n32(20));
  t.eqStr("a plain request is answered 404", plain.statusOf(plain.second), "404");
};

/** Every loopback check. */
export const loopbackChecks = (t: Suite): void => {
  life(t);
  relayEnds(t);
  refusals(t);
  caps(t);
  connecting(t);
  oneAddress(t);
  offload(t);
  warm(t);
};
