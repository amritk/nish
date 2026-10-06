// Ending a session, from either side: CLOSE_WEBTRANSPORT_SESSION with its code
// and reason, the CONNECT stream's FIN or reset alone, and DRAIN; every
// stream of a session that ends is reset with WT_SESSION_GONE, and the
// session's slot is free again once both halves of its CONNECT stream are
// done. A stream reset or stopped by either side, with the application code
// mapped as Chrome maps it.
import { Suite } from "nish/testing";
import { H3_NO_ERROR } from "nish/net/http3-frame";
import { H3_CLOSED, H3_INVALID } from "nish/net/http3";
import {
  WT_CAPSULE_CLOSE,
  WT_CAPSULE_DRAIN,
  WT_FIRST_APP_CODE,
  WT_SESSION_GONE,
  wtCodeFromHttp3,
  wtCodeToHttp3,
} from "nish/net/webtransport";
import { n32, n64 } from "../net_quic_frame/typed";
import { bytesOf, textOf } from "../crypto_x509/hex";
import { h3Hex } from "../net_http3/peer";
import { WtLimits, WtPeer, wtCapsule, wtClosePayload, wtFill, wtHexOf, wtLogged, wtReady } from "./peer";

/** The client closes with a code and a reason. */
const clientCloses = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.bidi(n64(4), n64(0), bytesOf("open"), false);
  p.capsule(n64(0), wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(0xdeadbeef), bytesOf("done here"))), false);
  p.settle();
  wtLogged(t, "the program is told the code and the reason", p, ["stream 4 bidi of 0", `closed 0 ${n64(0xdeadbeef)} "done here" by the client`]);
  t.ok("the server finishes its half of the CONNECT stream", p.stream(n64(0)).fin);
  t.eqStr("the session's open stream is reset both ways with WT_SESSION_GONE", `${h3Hex(p.stream(n64(4)).reset)} ${h3Hex(p.stream(n64(4)).stop)}`, `${h3Hex(WT_SESSION_GONE)} ${h3Hex(WT_SESSION_GONE)}`);
  t.eqI32("its slot is still held until the client's half ends", p.wt.freeCount, n32(1));
  p.send(n64(0), wtFill(n32(0), n32(0)), true);
  p.settle();
  t.eqI32("and free once it does", p.wt.freeCount, n32(2));
  p.bidi(n64(8), n64(0), bytesOf("late"), true);
  p.settle();
  t.eqStr("a stream for the session once it is gone is refused with WT_SESSION_GONE (its whole stream in, so only reset)", h3Hex(p.stream(n64(8)).reset), h3Hex(WT_SESSION_GONE));
  const before: i32 = p.wt.datagramsDropped;
  p.datagram(n64(0), bytesOf("late"));
  t.eqI32("and so is a datagram: dropped", p.wt.datagramsDropped, before + 1);
};

/** The server closes. */
const serverCloses = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.uni(n64(14), n64(0), bytesOf("half"), false);
  p.settle();
  const reason: u8[] = bytesOf("bye");
  t.eqI32("a reason past 1,024 bytes is refused", p.wt.close(n64(0), n64(7), wtFill(n32(1025), n32(97)), n32(0), n32(1025)), H3_INVALID);
  t.eqI32("close", p.wt.close(n64(0), n64(7), reason, n32(0), toI32(reason.length)), n32(0));
  p.settle();
  t.eqStr("CLOSE_WEBTRANSPORT_SESSION: type 0x2843, length 7, code 7, \"bye\"", wtHexOf(p.capsules(n64(0))), "68430700000007627965");
  t.ok("then the FIN", p.stream(n64(0)).fin);
  t.eqStr("the client's stream is asked to stop with WT_SESSION_GONE", h3Hex(p.stream(n64(14)).stop), h3Hex(WT_SESSION_GONE));
  t.eqI32("a second close finds no session", p.wt.close(n64(0), n64(7), reason, n32(0), n32(0)), H3_CLOSED);
  p.capsule(n64(0), wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(0), wtFill(n32(0), n32(0)))), true);
  p.settle();
  t.eqI32("the client's own CLOSE in answer ends it quietly, and the slot is free", p.wt.freeCount, n32(2));
  t.ok("and the program was not told of a close it made", toI32(p.log.join("|").indexOf("closed")) < 0);
};

/** The CONNECT stream ending or reset without a CLOSE. */
const streamEnds = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.send(n64(0), wtFill(n32(0), n32(0)), true);
  p.settle();
  wtLogged(t, "a FIN alone closes the session with code 0 and no reason", p, [`closed 0 0 "" by the client`]);
  t.ok("answered with the server's FIN", p.stream(n64(0)).fin);
  const q: WtPeer = wtReady(new WtLimits());
  q.resetStream(n64(0), n64(0x10c));
  q.settle();
  wtLogged(t, "and so does a reset", q, [`closed 0 0 "" by the client`]);
  t.eqI32("each frees its slot", p.wt.freeCount + q.wt.freeCount, n32(4));
};

/** DRAIN, both ways. */
const draining = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.capsule(n64(0), wtCapsule(WT_CAPSULE_DRAIN, wtFill(n32(0), n32(0))), false);
  wtLogged(t, "the client's DRAIN_WEBTRANSPORT_SESSION reaches the program", p, ["drain 0"]);
  t.eqI32("the server sends its own", p.wt.drain(n64(0)), n32(0));
  p.settle();
  t.eqStr("type 0x78ae as a four-byte varint, length 0", wtHexOf(p.capsules(n64(0))), "800078ae00");
  t.ok("and the session stays open", !p.stream(n64(0)).fin);
  p.capsule(n64(0), wtCapsule(n64(0x29), bytesOf("unknown")), false);
  p.datagram(n64(0), bytesOf("still open"));
  wtLogged(t, "an unknown capsule is skipped, and the session goes on", p, ["drain 0", "datagram 0 10"]);
  t.eqI32("draining an unknown session is refused", p.wt.drain(n64(4)), H3_CLOSED);
};

/** Stream resets and STOP_SENDING, both ways. */
const streamErrors = (t: Suite): void => {
  t.eqI64("application code 0 is the range's first", wtCodeToHttp3(n64(0)), WT_FIRST_APP_CODE);
  t.eqI64("0x1e skips the greased value it would land on", wtCodeToHttp3(n64(0x1e)), WT_FIRST_APP_CODE + n64(0x1f));
  t.eqI64("and maps back", wtCodeFromHttp3(wtCodeToHttp3(n64(0x1e))), n64(0x1e));
  t.eqI64("the largest code maps back", wtCodeFromHttp3(wtCodeToHttp3(n64(0xffffffff))), n64(0xffffffff));
  t.eqI64("a greased value in the range is no code", wtCodeFromHttp3(WT_FIRST_APP_CODE + n64(0x1e)), n64(-1));
  t.eqI64("nor is one below it", wtCodeFromHttp3(H3_NO_ERROR), n64(-1));
  const p: WtPeer = wtReady(new WtLimits());
  p.echo = false;
  p.bidi(n64(4), n64(0), bytesOf("x"), false);
  p.resetStream(n64(4), wtCodeToHttp3(n64(42)));
  wtLogged(t, "the client's reset reaches the program with its code mapped back", p, [`reset 4 0x${h3Hex(wtCodeToHttp3(n64(42)))} app 42`]);
  p.stopSending(n64(4), n64(0x99));
  wtLogged(t, "an unmapped STOP_SENDING code, as wtransport sends one, keeps its HTTP/3 code", p, ["stopped 4 0x99 app -1"]);
  p.bidi(n64(8), n64(0), bytesOf("y"), false);
  t.eqI32("the server resets its side", p.wt.resetStream(n64(8), n64(5)), n32(0));
  t.eqI32("and asks the client to stop", p.wt.stopSending(n64(8), n64(6)), n32(0));
  p.settle();
  t.eqStr("each with the code mapped", `${h3Hex(p.stream(n64(8)).reset)} ${h3Hex(p.stream(n64(8)).stop)}`, `${h3Hex(wtCodeToHttp3(n64(5)))} ${h3Hex(wtCodeToHttp3(n64(6)))}`);
  t.eqI32("a stream stopped already cannot be stopped again", p.wt.stopSending(n64(8), n64(6)), H3_CLOSED);
  t.eqI32("nor written", p.wt.write(n64(8), bytesOf("z"), n32(0), n32(1), false), H3_CLOSED);
  t.eqStr("reasons are text", textOf(bytesOf("ok")), "ok");
};

export const closingChecks = (t: Suite): void => {
  clientCloses(t);
  serverCloses(t);
  streamEnds(t);
  draining(t);
  streamErrors(t);
};
