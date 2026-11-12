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
import { WtLimits, WtPeer, wtLogged, wtReady } from "./peer";

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

/** Activity keeps a session: a datagram moves its deadline. */
const activeSession = (t: Suite): void => {
  const limits = new WtLimits();
  limits.idleTimeout = n32(1000);
  const p: WtPeer = wtReady(limits);
  const start: i64 = monotonicNanos();
  t.eqI32("a session a second quiet ends", p.wt.expire(start + n64(2) * SECOND), n32(1));
  const q: WtPeer = wtReady(limits);
  const begun: i64 = monotonicNanos();
  t.eqI32("a fresh session is kept", q.wt.expire(begun), n32(0));
  q.datagram(n64(0), bytesOf("alive"));
  t.ok("a datagram's arrival moves the soonest deadline no earlier", q.wt.expiresNoSooner(begun) >= begun + n64(900000000));
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
