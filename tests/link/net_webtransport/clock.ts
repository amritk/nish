// The session clock and the datagram rate (WT-2): `expire` ends a session
// quiet past `idleTimeout` — one never answered with 503, an accepted one
// with CLOSE code 0 and the FIN, one already closed whose client never
// finished its half by letting it go — and reports each to the program as
// WT_CLOSED; a session takes at most `maxDatagramsPerSecond` datagrams a
// second, and the rest are dropped and counted.
import { Suite } from "nish/testing";
import { monotonicNanos } from "nish:process";
import { H3_CLOSED } from "nish/net/http3";
import { n32, n64 } from "../net_quic_frame/typed";
import { bytesOf, toHex } from "../crypto_x509/hex";
import { WtLimits, WtPeer, wtCapsule, wtFill, wtLogged, wtReady, wtSaw } from "./peer";
import { WT_CAPSULE_DRAIN } from "nish/net/webtransport";

/** A second in nanoseconds. */
const SECOND: i64 = 1000000000;

/** Sessions quiet past `idleTimeout`: asked, accepted, then closed and never finished by the client. */
const idleSessions = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.session(n64(4), "/hold");
  p.settle();
  const start: i64 = monotonicNanos();
  t.eqI32("no session ends while it is fresh", p.wt.expire(start), n32(0));
  t.ok("none can end before a minute is up", p.wt.expiresNoSooner(start) >= start + n64(59) * SECOND);
  t.eqI32("nor at 59 seconds", p.wt.expire(start + n64(59) * SECOND), n32(0));
  t.eqI32("at 61 seconds both end", p.wt.expire(start + n64(61) * SECOND), n32(2));
  p.settle();
  t.eqStr("the session never answered is refused with 503", p.status(n64(4)), ":status: 503");
  t.eqStr("the accepted one gets CLOSE_WEBTRANSPORT_SESSION with code 0 and no reason", toHex(p.capsules(n64(0))), "68430400000000");
  t.ok("then the FIN", p.stream(n64(0)).fin);
  wtLogged(t, "the program is told of each, not by the client", p, ["session 4 /hold", `closed 4 0 ""`, `closed 0 0 ""`]);
  t.eqI32("the program's late answer finds no session", p.wt.accept(n64(4)), H3_CLOSED);
  t.eqI32("the refused one's slot is free; the closed one's waits for the client's half", p.wt.freeCount, n32(1));
  t.eqI32("a minute on, the closed session the client never finished is let go", p.wt.expire(start + n64(122) * SECOND), n32(1));
  t.eqI32("and its slot is free", p.wt.freeCount, n32(2));
  const lines: i32 = toI32(p.log.length);
  p.settle();
  t.eqI32("with no second WT_CLOSED", toI32(p.log.length), lines);
};

/** A tenth of a second short of the one-second `idleTimeout` the activity checks use, and half a second past it. */
const QUIET: i64 = 900000000;
const LATE: i64 = 1500000000;

/**
 * A peer whose session 0 was accepted before `begun` under a one-second
 * `idleTimeout`, echoing nothing, with its clock moved to `begun` plus
 * QUIET by an `expire` that ends nothing. What it does next happens then,
 * so an `expire` at `begun` plus LATE keeps the session only if that
 * activity moved its deadline.
 */
const quietPeer = (t: Suite, begun: i64): WtPeer => {
  const limits = new WtLimits();
  limits.idleTimeout = n32(1000);
  const p: WtPeer = wtReady(limits);
  p.echo = false;
  t.eqI32("a session 0.9 seconds quiet is kept", p.wt.expire(begun + QUIET), n32(0));
  return p;
};

/** Activity keeps a session: each kind moves its deadline to the time it happened. */
const activeSession = (t: Suite): void => {
  const none: u8[] = [];
  const limits = new WtLimits();
  limits.idleTimeout = n32(1000);
  const p: WtPeer = wtReady(limits);
  const start: i64 = monotonicNanos();
  t.eqI32("a session a second quiet ends", p.wt.expire(start + n64(2) * SECOND), n32(1));

  const late: WtPeer = quietPeer(t, monotonicNanos());
  t.eqI32("with no activity, it ends a second after its accept", late.wt.expire(monotonicNanos() + LATE), n32(1));

  let begun: i64 = monotonicNanos();
  let q: WtPeer = quietPeer(t, begun);
  q.datagram(n64(0), bytesOf("alive"));
  t.ok("the datagram reached the program", wtSaw(q, "datagram 0 5"));
  t.eqI32("a datagram received keeps it", q.wt.expire(begun + LATE), n32(0));

  begun = monotonicNanos();
  q = quietPeer(t, begun);
  t.eqI32("a datagram is sent", q.wt.sendDatagram(n64(0), bytesOf("ping"), n32(0), n32(4)), n32(0));
  t.eqI32("a datagram sent keeps it", q.wt.expire(begun + LATE), n32(0));

  begun = monotonicNanos();
  q = quietPeer(t, begun);
  q.capsule(n64(0), wtCapsule(WT_CAPSULE_DRAIN, wtFill(n32(0), n32(0))), false);
  t.ok("the capsule reached the program", wtSaw(q, "drain 0"));
  t.eqI32("a capsule on its CONNECT stream keeps it", q.wt.expire(begun + LATE), n32(0));

  begun = monotonicNanos();
  const opened: WtPeer = wtReady(limits);
  opened.echo = false;
  opened.bidi(n64(4), n64(0), none, false);
  opened.settle();
  t.eqI32("a stream's opening is kept", opened.wt.expire(begun + QUIET), n32(0));
  opened.send(n64(4), bytesOf("alive"), false);
  opened.settle();
  t.eqI32("a stream byte received keeps it", opened.wt.expire(begun + LATE), n32(0));

  begun = monotonicNanos();
  const writer: WtPeer = wtReady(limits);
  writer.echo = false;
  writer.bidi(n64(4), n64(0), none, false);
  writer.settle();
  t.eqI32("a quiet stream is kept", writer.wt.expire(begun + QUIET), n32(0));
  t.eqI32("the program writes on the stream", writer.wt.write(n64(4), bytesOf("pong"), n32(0), n32(4), false), n32(4));
  t.eqI32("a stream byte sent keeps it", writer.wt.expire(begun + LATE), n32(0));

  begun = monotonicNanos();
  q = quietPeer(t, begun);
  q.session(n64(4), "/hold");
  q.settle();
  t.eqI32("a session asked for counts from its request: only the quiet one ends", q.wt.expire(begun + LATE), n32(1));

  begun = monotonicNanos();
  const held: WtPeer = wtReady(limits);
  held.session(n64(4), "/hold");
  held.settle();
  t.eqI32("an unanswered session is kept", held.wt.expire(begun + QUIET), n32(0));
  t.eqI32("the program accepts it", held.wt.accept(n64(4)), n32(0));
  t.eqI32("its accept restarts its clock: only the other ends", held.wt.expire(begun + LATE), n32(1));

  begun = monotonicNanos();
  q = quietPeer(t, begun);
  t.eqI32("the program closes the session", q.wt.close(n64(0), n64(0), none, n32(0), n32(0)), n32(0));
  t.eqI32("its close restarts its clock: the client has a full idleTimeout to finish its half", q.wt.expire(begun + LATE), n32(0));
};

/** Datagrams past the session's rate are dropped and counted. */
const datagramRate = (t: Suite): void => {
  const limits = new WtLimits();
  limits.maxDatagramsPerSecond = n32(4);
  const p: WtPeer = wtReady(limits);
  const before: i32 = p.wt.datagramsDropped;
  for (let k: i32 = 0; k < 10; k++) {
    p.datagram(n64(0), bytesOf("burst"));
  }
  wtLogged(t, "four datagrams in a second reach the program", p, ["datagram 0 5", "datagram 0 5", "datagram 0 5", "datagram 0 5"]);
  t.eqI32("only four", p.wt.datagramsIn[0], n32(4));
  t.eqI32("the other six are dropped and counted", p.wt.datagramsDropped - before, n32(6));
  t.eqI32("each one received was echoed", toI32(p.datagrams.length), n32(4));
};

export const clockChecks = (t: Suite): void => {
  idleSessions(t);
  activeSession(t);
  datagramRate(t);
};
