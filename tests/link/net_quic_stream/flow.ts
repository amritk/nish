// Flow control both ways and at both levels (RFC 9000 §4): the credit the
// server gives a stream and the connection is a whole buffer and a whole
// window, raised by MAX_STREAM_DATA and MAX_DATA once the application has
// read half; the credit the client gives holds the server's data back, with
// STREAM_DATA_BLOCKED and DATA_BLOCKED saying so once, until MAX_STREAM_DATA
// and MAX_DATA let the rest go; and a write larger than a stream's buffer is
// taken in part, the stream named again once acknowledgements free room.
import { Suite } from "nish/testing";
import {
  QUIC_FRAME_DATA_BLOCKED,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_STREAM,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QuicFrame,
  quicParseFrame,
  quicPushAck,
  quicPushStreamValue,
  quicPushValue,
} from "nish/net/quic-frame";
import { QUIC_STATE_CONNECTED } from "nish/net/quic";
import { QUIC_SEND_DATA_RECVD } from "nish/net/quic-stream";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { qcDrain } from "../net_quic_conn/client";
import { qcFind } from "../net_quic_conn/common";
import { NqLimits, NqPair, NqRead, nqAck, nqPair, nqReadAll, nqReceived, nqSend, nqSettle, nqText } from "./common";
import { qcStream } from "../net_quic_conn/data";

/** `count` bytes of stream `id` from `offset`, in STREAM frames of 1000, a packet each. */
const sendBytes = (p: NqPair, id: i64, offset: i64, count: i32, fin: boolean): void => {
  let sent: i32 = 0;
  while (sent < count) {
    const n: i32 = count - sent < 1000 ? count - sent : 1000;
    nqSend(p, qcStream(id, offset + toI64(sent), nqText(n), fin && sent + n === count));
    sent = sent + n;
  }
};

/** The credit the server gives: a stream's buffer, the connection's window, each raised as the application reads. */
const receiveCredit = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(4096);
  limits.maxData = n64(8192);
  const p: NqPair = nqPair(limits);
  sendBytes(p, n64(0), n64(0), n32(4096), false);
  t.eqI32("a stream takes its whole credit, a buffer of 4096 bytes", p.conn.state, QUIC_STATE_CONNECTED);
  t.ok("with nothing read, no credit is raised", !qcFind(p.c.appPayloads, QUIC_FRAME_MAX_STREAM_DATA).found);
  const buf: u8[] = new Array<u8>(2048);
  t.eqI32("the application reads half of it", p.conn.streamRead(n64(0), buf, n32(0), n32(2048)), n32(2048));
  qcDrain(p.conn, p.c);
  const raised = qcFind(p.c.appPayloads, QUIC_FRAME_MAX_STREAM_DATA);
  t.ok("which raises the stream's credit to what was read plus a buffer: 6144 (§4.1)", raised.found && raised.frame.streamId === n64(0) && raised.frame.value === n64(6144));
  sendBytes(p, n64(0), n64(4096), n32(2048), false);
  t.eqI32("and the client may send up to it", p.conn.state, QUIC_STATE_CONNECTED);
  t.ok("the connection's 8192 are not raised yet: 2048 read is under half", !qcFind(p.c.appPayloads, QUIC_FRAME_MAX_DATA).found);
  sendBytes(p, n64(4), n64(0), n32(2048), false);
  t.eqI64("two streams have used the connection's whole window", p.conn.streams.recvTotal, n64(8192));
  t.eqI32("the application reads 2048 more", p.conn.streamRead(n64(0), buf, n32(0), n32(2048)), n32(2048));
  qcDrain(p.conn, p.c);
  const window = qcFind(p.c.appPayloads, QUIC_FRAME_MAX_DATA);
  t.ok("half the window read raises it to 4096 + 8192 (§4.1)", window.found && window.frame.value === n64(12288));
  sendBytes(p, n64(8), n64(0), n32(4000), false);
  t.eqI32("and a third stream may use what was given back", p.conn.state, QUIC_STATE_CONNECTED);
  const rest = new NqRead();
  nqReadAll(p.conn, n32(4096), rest);
  t.eqI32("everything that arrived is read, in order", toI32(rest.of(n64(8)).length), n32(4000));
};

/** The credit the client gives holds the server back, and its MAX frames let it go on. */
const sendCredit = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(4096);
  limits.clientBidiLocal = n64(1000);
  limits.clientMaxData = n64(1500);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "go", false));
  nqSend(p, qcStream(n64(4), n64(0), "go", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  const data: u8[] = bytesOf(nqText(n32(3000)));
  t.eqI32("the server's buffer takes 3000 bytes for stream 0", p.conn.streamWrite(n64(0), data, n32(0), n32(3000), true), n32(3000));
  t.eqI32("and 3000 for stream 4", p.conn.streamWrite(n64(4), data, n32(0), n32(3000), true), n32(3000));
  nqSettle(p);
  t.eqI32("stream 0 sends only its credit, 1000 bytes", toI32(nqReceived(p.c, n64(0)).length), n32(1000));
  t.eqI32("stream 4 the 500 the connection's 1500 leave", toI32(nqReceived(p.c, n64(4)).length), n32(500));
  const blocked = qcFind(p.c.appPayloads, QUIC_FRAME_STREAM_DATA_BLOCKED);
  t.ok("the server says STREAM_DATA_BLOCKED at the stream's limit (§19.13)", blocked.found && blocked.frame.value === n64(1000));
  const dataBlocked = qcFind(p.c.appPayloads, QUIC_FRAME_DATA_BLOCKED);
  t.ok("and DATA_BLOCKED at the connection's (§19.12)", dataBlocked.found && dataBlocked.frame.value === n64(1500));
  const more: u8[] = [];
  quicPushStreamValue(more, QUIC_FRAME_MAX_STREAM_DATA, n64(0), n64(5000));
  quicPushStreamValue(more, QUIC_FRAME_MAX_STREAM_DATA, n64(4), n64(5000));
  quicPushValue(more, QUIC_FRAME_MAX_DATA, n64(10000));
  nqSend(p, more);
  nqSettle(p);
  t.eqStr("MAX_STREAM_DATA and MAX_DATA let the rest of stream 0 go, with its FIN", nqReceived(p.c, n64(0)), `${nqText(n32(3000))} <fin>`);
  t.eqStr("and of stream 4", nqReceived(p.c, n64(4)), `${nqText(n32(3000))} <fin>`);
};

/** A write past the buffer is taken in part; acknowledgements free the room and name the stream again. */
const backPressure = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(4096);
  const p: NqPair = nqPair(limits);
  nqSend(p, qcStream(n64(0), n64(0), "go", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  const data: u8[] = bytesOf(nqText(n32(10000)));
  const first: i32 = p.conn.streamWrite(n64(0), data, n32(0), n32(10000), false);
  t.eqI32("a write of 10000 bytes takes the 4096 the buffer holds", first, n32(4096));
  t.eqI32("a second write takes nothing while they are unacknowledged", p.conn.streamWrite(n64(0), data, first, n32(10000) - first, false), n32(0));
  qcDrain(p.conn, p.c);
  t.eqI64("nothing to say yet", p.conn.nextStreamEvent(), n64(-1));
  nqAck(p);
  t.eqI64("the acknowledgement frees the room, and the stream comes up again", p.conn.nextStreamEvent(), n64(0));
  let at: i32 = first;
  let rounds: i32 = 0;
  while (at < n32(10000) && rounds < 20) {
    const n: i32 = p.conn.streamWrite(n64(0), data, at, n32(10000) - at, at + 4096 >= n32(10000));
    at = at + (n > 0 ? n : 0);
    nqSettle(p);
    rounds++;
  }
  t.eqI32("the rest goes as room comes back", at, n32(10000));
  t.eqStr("and all of it arrives, in order", nqReceived(p.c, n64(0)), `${nqText(n32(10000))} <fin>`);
};

/** Every STREAM frame with a FIN that the client received for `id` ends at `final`. */
const finsEndAt = (p: NqPair, id: i64, final: i64): boolean => {
  const frame = new QuicFrame();
  let right: boolean = true;
  for (const payload of p.c.appPayloads) {
    let at: i32 = 0;
    while (at < toI32(payload.length)) {
      if (quicParseFrame(frame, payload, at, toI32(payload.length)) !== n64(0) || frame.end <= at) {
        break;
      }
      if (frame.type === QUIC_FRAME_STREAM && frame.streamId === id && frame.fin) {
        right = right && frame.offset + toI64(frame.dataLength) === final;
      }
      at = frame.end;
    }
  }
  return right;
};

/** A lost FIN goes again on its own, and only ever at the final size (RFC 9000 §4.5). */
const lostFin = (t: Suite): void => {
  const p: NqPair = nqPair(new NqLimits());
  nqSend(p, qcStream(n64(0), n64(0), "go", false));
  nqReadAll(p.conn, n32(64), new NqRead());
  nqSettle(p);
  const first: u8[] = bytesOf(nqText(n32(100)));
  p.conn.streamWrite(n64(0), first, n32(0), n32(100), false);
  // The first 100 bytes go, and the network loses them.
  t.ok("the first 100 bytes go, and are lost", p.conn.takeDatagram(p.c.now) !== null && p.conn.takeDatagram(p.c.now) === null);
  p.conn.streamWrite(n64(0), first, n32(0), n32(100), false);
  qcDrain(p.conn, p.c);
  // The client acknowledges only the packet that reached it.
  const ack: u8[] = [];
  quicPushAck(ack, [p.c.largestApp, p.c.largestApp], n32(1), n64(0));
  nqSend(p, ack);
  t.eqI32("the FIN alone, written after the next 100 arrived", p.conn.streamWrite(n64(0), first, n32(0), n32(0), true), n32(0));
  t.ok("goes in a frame of no bytes, and is lost too", p.conn.takeDatagram(p.c.now) !== null && p.conn.takeDatagram(p.c.now) === null);
  for (let k: i32 = 0; k < 4; k++) {
    p.c.now = p.conn.deadline();
    p.conn.handleTimer(p.c.now);
    qcDrain(p.conn, p.c);
  }
  t.eqStr("the probe timeout sends the lost bytes and the lost FIN again, and the stream arrives whole", nqReceived(p.c, n64(0)), `${nqText(n32(100))}${nqText(n32(100))} <fin>`);
  t.ok("and no frame put the FIN anywhere but the final size, 200", finsEndAt(p, n64(0), n64(200)));
  nqSettle(p);
  const zero = p.conn.streams.find(n64(0));
  t.ok("and once all of it is acknowledged the sending side is Data Recvd (§3.1)", zero !== null && zero.sendState === QUIC_SEND_DATA_RECVD);

  // Only the FIN is lost: every byte before it was acknowledged.
  const q: NqPair = nqPair(new NqLimits());
  nqSend(q, qcStream(n64(0), n64(0), "go", false));
  nqReadAll(q.conn, n32(64), new NqRead());
  q.conn.streamWrite(n64(0), first, n32(0), n32(100), false);
  nqSettle(q);
  q.conn.streamWrite(n64(0), first, n32(0), n32(0), true);
  t.ok("a FIN alone goes, and is lost", q.conn.takeDatagram(q.c.now) !== null && q.conn.takeDatagram(q.c.now) === null);
  for (let k: i32 = 0; k < 4; k++) {
    q.c.now = q.conn.deadline();
    q.conn.handleTimer(q.c.now);
    qcDrain(q.conn, q.c);
  }
  t.eqStr("with no bytes left to resend, the FIN is sent again on its own", nqReceived(q.c, n64(0)), `${nqText(n32(100))} <fin>`);
  t.ok("at the final size, 100", finsEndAt(q, n64(0), n64(100)));
};

/** Every flow-control check. */
export const flowChecks = (t: Suite): void => {
  receiveCredit(t);
  sendCredit(t);
  backPressure(t);
  lostFin(t);
};
