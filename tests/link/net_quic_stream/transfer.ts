// A multiplexed transfer: the client opens eight bidirectional and three
// unidirectional streams at once and the server echoes each bidirectional
// one back; the server opens streams of both kinds of its own; every byte
// arrives on its stream, in order, with its FIN, and each stream that
// finishes both ways frees its slot and, once half the client's limit has,
// raises it with MAX_STREAMS. And the most streams a frame can open at once
// (§3.2), taken off the free-slot stack, given back and taken again.
import { Suite } from "nish/testing";
import { QUIC_FRAME_MAX_STREAMS_BIDI, QUIC_FRAME_MAX_STREAMS_UNI } from "nish/net/quic-frame";
import {
  QUIC_RECV_NONE,
  QUIC_SEND_NONE,
  QUIC_STREAM_ERR_DIRECTION,
  QUIC_STREAM_ERR_STATE,
  QUIC_STREAM_ERR_UNKNOWN,
  quicStreamIsLocal,
  quicStreamIsUni,
} from "nish/net/quic-stream";
import { QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { cat } from "../net_tls_common/client";
import { qcFind } from "../net_quic_conn/common";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { NqLimits, NqPair, NqRead, nqConfig, nqPair, nqReadAll, nqReceived, nqSend, nqSettle, nqText } from "./common";
import { qcStream } from "../net_quic_conn/data";

/** What the client sends on stream `id`: its name and 200 bytes of pattern. */
const body = (id: i64): string => `stream ${id}: ${nqText(n32(200))}`;

/** The server echoes each of the client's bidirectional streams it read to the end. */
const echo = (p: NqPair, read: NqRead): void => {
  for (let k: i32 = 0; k < toI32(read.ids.length); k++) {
    const id: i64 = read.ids[k];
    const text: string = read.texts[k];
    if (!quicStreamIsUni(id) && !quicStreamIsLocal(id) && text.endsWith(" <fin>")) {
      const data: u8[] = bytesOf(text.substring(0, text.length - 6));
      p.conn.streamWrite(id, data, n32(0), toI32(data.length), true);
    }
  }
};

/** Eight bidirectional and three unidirectional client streams, the server's own three, all at once. */
const multiplexChecks = (t: Suite): void => {
  const p: NqPair = nqPair(new NqLimits());
  t.eqI32("connected", p.conn.state, QUIC_STATE_CONNECTED);
  // Two streams to a packet, interleaved: bidirectional 0, 4 … 28 and unidirectional 2, 6, 10.
  const ids: i64[] = [n64(0), n64(2), n64(4), n64(6), n64(8), n64(10), n64(12), n64(16), n64(20), n64(24), n64(28)];
  for (let k: i32 = 0; k < toI32(ids.length); k += 2) {
    const frames: u8[][] = [qcStream(ids[k], n64(0), body(ids[k]), true)];
    if (k + 1 < toI32(ids.length)) {
      frames.push(qcStream(ids[k + 1], n64(0), body(ids[k + 1]), true));
    }
    nqSend(p, cat(frames));
  }
  // And one more unidirectional stream the client leaves open.
  nqSend(p, qcStream(n64(14), n64(0), "still open", false));
  const read = new NqRead();
  nqReadAll(p.conn, n32(64), read);
  let all: boolean = true;
  for (const id of ids) {
    all = all && read.of(id) === `${body(id)} <fin>`;
  }
  t.ok("the server reads every stream whole, 64 bytes at a time, each with its FIN", all);
  t.eqI32("twelve streams came up as events", toI32(read.ids.length), n32(12));
  t.eqStr("the one left open has no FIN yet", read.of(n64(14)), "still open");
  const open = p.conn.streams.find(n64(14));
  t.ok("a client's unidirectional stream has no sending side here", open !== null && open.sendState === QUIC_SEND_NONE);
  const scratch: u8[] = bytesOf("x");
  t.eqI32("so writing to it is QUIC_STREAM_ERR_DIRECTION", p.conn.streamWrite(n64(14), scratch, n32(0), n32(1), false), QUIC_STREAM_ERR_DIRECTION);
  t.ok("a unidirectional stream read to its end has left its slot already", p.conn.streams.find(n64(2)) === null);

  echo(p, read);
  const serverUni: i64 = p.conn.openStream(false);
  const serverBidi: i64 = p.conn.openStream(true);
  const secondUni: i64 = p.conn.openStream(false);
  t.ok("the server opens its own: unidirectional 3, bidirectional 1, unidirectional 7", serverUni === n64(3) && serverBidi === n64(1) && secondUni === n64(7));
  const three = p.conn.streams.find(n64(3));
  t.ok("its unidirectional stream has no receiving side", three !== null && three.recvState === QUIC_RECV_NONE);
  t.eqI32("so reading it is QUIC_STREAM_ERR_DIRECTION", p.conn.streamRead(n64(3), scratch, n32(0), n32(1)), QUIC_STREAM_ERR_DIRECTION);
  const hello: u8[] = bytesOf("from the server, one way");
  p.conn.streamWrite(serverUni, hello, n32(0), toI32(hello.length), true);
  const ask: u8[] = bytesOf("a question");
  p.conn.streamWrite(serverBidi, ask, n32(0), toI32(ask.length), true);
  p.conn.streamWrite(secondUni, ask, n32(0), toI32(ask.length), false);
  nqSettle(p);
  let echoed: boolean = true;
  for (const id of ids) {
    if (!quicStreamIsUni(id)) {
      echoed = echoed && nqReceived(p.c, id) === `${body(id)} <fin>`;
    }
  }
  t.ok("every bidirectional stream comes back whole, with its FIN", echoed);
  t.eqStr("the server's unidirectional stream arrives", nqReceived(p.c, n64(3)), "from the server, one way <fin>");
  t.eqStr("and its bidirectional one", nqReceived(p.c, n64(1)), "a question <fin>");
  t.eqStr("and a stream it has not finished, without a FIN", nqReceived(p.c, n64(7)), "a question");

  // The client answers on the server's bidirectional stream.
  nqSend(p, qcStream(n64(1), n64(0), "an answer", true));
  const answer = new NqRead();
  nqReadAll(p.conn, n32(64), answer);
  t.eqStr("the client's answer on the server's stream is read", answer.of(n64(1)), "an answer <fin>");

  nqSettle(p);
  t.ok("every stream finished both ways has left its slot", p.conn.streams.find(n64(0)) === null && p.conn.streams.find(n64(1)) === null && p.conn.streams.find(n64(2)) === null);
  t.ok("the one still sending keeps it", p.conn.streams.find(n64(7)) !== null);
  t.eqI32("a finished stream is unknown to a write", p.conn.streamWrite(n64(0), scratch, n32(0), n32(1), false), QUIC_STREAM_ERR_UNKNOWN);
  const raised = qcFind(p.c.appPayloads, QUIC_FRAME_MAX_STREAMS_BIDI);
  t.ok("with eight finished, MAX_STREAMS raises the client's bidirectional limit (§4.6)", raised.found && raised.frame.value >= n64(12));
  t.eqI64("to sixteen once all eight have", p.conn.streams.peerBidiLimit, n64(16));
  const uniRaised = qcFind(p.c.appPayloads, QUIC_FRAME_MAX_STREAMS_UNI);
  t.ok("and two finished unidirectional streams of four raise that limit to six", uniRaised.found && uniRaised.frame.value === n64(6) && p.conn.streams.peerUniLimit === n64(6));
  // A stream the client opens past its first eight, under the new limit.
  nqSend(p, qcStream(n64(32), n64(0), "ninth", true));
  const ninth = new NqRead();
  nqReadAll(p.conn, n32(64), ninth);
  t.eqStr("a ninth bidirectional stream is taken, in a freed slot", ninth.of(n64(32)), "ninth <fin>");

  const fresh = new QuicConnection(nqConfig(new NqLimits()), fixedEntropy());
  t.eqI64("no stream opens before the handshake", fresh.openStream(true), toI64(QUIC_STREAM_ERR_STATE));
  t.eqI32("nor is one written", fresh.streamWrite(n64(1), scratch, n32(0), n32(1), false), QUIC_STREAM_ERR_STATE);
};

/** How many of the client's unidirectional streams one frame may open in `burstChecks`. */
const BURST: i32 = 1024;

/** Whether every one of `count` client unidirectional streams from sequence `first` has a slot of its own. */
const ownSlots = (p: NqPair, first: i32, count: i32): boolean => {
  const seen: boolean[] = [];
  for (let k: i32 = 0; k < toI32(p.conn.streams.slots.length); k++) {
    seen.push(false);
  }
  let distinct: boolean = true;
  for (let s: i32 = first; s < first + count; s++) {
    const slot: i32 = p.conn.streams.slotOf((toI64(s) << n64(2)) | n64(2));
    if (slot < 0 || slot >= toI32(seen.length) || seen[slot]) {
      distinct = false;
    } else {
      seen[slot] = true;
    }
  }
  return distinct;
};

/** Finishes the client's unidirectional streams from sequence `first`, `count` of them, a hundred FINs to a packet. */
const finishAll = (p: NqPair, first: i32, count: i32): void => {
  let s: i32 = first;
  while (s < first + count) {
    const frames: u8[][] = [];
    for (let j: i32 = 0; j < 100 && s < first + count; j++) {
      frames.push(qcStream((toI64(s) << n64(2)) | n64(2), n64(0), "", true));
      s = s + 1;
    }
    nqSend(p, cat(frames));
  }
  nqReadAll(p.conn, n32(64), new NqRead());
};

/**
 * One STREAM frame naming the client's 1,024th unidirectional stream opens
 * all 1,024 (§3.2), each from the free-slot stack rather than a scan of the
 * table; read to their ends they give every slot back, and the next 1,024,
 * under the raised limit, take them again, each its own.
 */
const burstChecks = (t: Suite): void => {
  const limits = new NqLimits();
  limits.maxStreamData = n64(1024);
  limits.maxStreamsUni = toI64(BURST);
  const p: NqPair = nqPair(limits);
  const streams = p.conn.streams;
  const slots: i32 = toI32(streams.slots.length);
  t.eqI32("the table holds 8 bidirectional, 1,024 unidirectional and 4 local slots", slots, n32(1036));
  t.eqI32("all of them free", streams.freeCount, slots);
  const top: i64 = (toI64(BURST - 1) << n64(2)) | n64(2);
  nqSend(p, qcStream(top, n64(0), "top", true));
  t.eqI64("one frame for stream 4094 opens every one below it", streams.peerUniOpened, toI64(BURST));
  t.eqI32("each in a slot of its own", toI32(ownSlots(p, n32(0), BURST) ? 1 : 0), n32(1));
  t.eqI32("leaving the twelve slots of the other kinds free", streams.freeCount, slots - BURST);
  finishAll(p, n32(0), BURST - 1);
  t.eqI64("read to their ends, all 1,024 finish", streams.peerUniClosed, toI64(BURST));
  t.eqI32("and every slot is free again", streams.freeCount, slots);
  t.eqI64("the client may open 1,024 more", streams.peerUniLimit, toI64(2 * BURST));
  nqSend(p, qcStream((toI64(2 * BURST - 1) << n64(2)) | n64(2), n64(0), "again", true));
  t.eqI64("one frame opens the next 1,024", streams.peerUniOpened, toI64(2 * BURST));
  t.eqI32("in the slots given back, none shared", toI32(ownSlots(p, BURST, BURST) ? 1 : 0), n32(1));
  t.eqI32("the twelve others still free", streams.freeCount, slots - BURST);
  t.eqI32("and the connection is still up", p.conn.state, QUIC_STATE_CONNECTED);
};

/** Every check of the multiplexed transfer. */
export const transferChecks = (t: Suite): void => {
  multiplexChecks(t);
  burstChecks(t);
};
