// The stream buffers a table borrows (QUIC-3 in docs/security/quic.md): a
// send side keeps its buffer while a lost segment waits to go again, and
// gives it back only once the acknowledgement covers the final size; two
// tables sharing one set of pools find every buffer zeroed when the first
// gives it back, after a reset or a stream longer than the buffer too; a
// late acknowledgement or loss after a reset reads nothing back; no buffer
// is given back twice; a table of its own gives every buffer back on `reset`.
// Driven on `QuicStreams` directly, as `nish/net/quic` drives it.
import { Suite } from "nish/testing";
import { QUIC_STREAM_END, QUIC_STREAM_ERR_FINISHED, QUIC_STREAM_OK, QuicStream, QuicStreamPools, QuicStreams } from "nish/net/quic-stream";
import { n32, n64 } from "../net_quic_frame/typed";
import { nqText } from "./common";
import { bytesOf } from "../crypto_x509/hex";

/** A table of four streams each way, 1,024-byte buffers, as `resend.ts` makes. */
const table = (): QuicStreams => {
  const s = new QuicStreams(n64(4), n64(0), n64(0), n32(1024), n64(65536));
  s.setPeerLimits(n64(65536), n64(1024), n64(1024), n64(1024), n64(4), n64(0));
  return s;
};

/** Stream `id` of `s`, which the checks have opened. */
const streamOf = (s: QuicStreams, id: i64): QuicStream => {
  const found: QuicStream | null = s.find(id);
  if (found === null) {
    panic(`pool: stream ${id} is not open`);
  }
  return found;
};

/** Whether every byte of `buf` from `from` on is zero. */
const zerosFrom = (buf: u8[], from: i32): boolean => {
  for (let k: i32 = from; k < toI32(buf.length); k++) {
    if (buf[k] !== toU8(0)) {
      return false;
    }
  }
  return true;
};

/** Whether every byte of `buf` is zero. */
const zeros = (buf: u8[]): boolean => zerosFrom(buf, n32(0));

/** Whether every buffer back in `pools`, both free lists and the reserve, is all zero. */
const freeZeroed = (pools: QuicStreamPools): boolean => {
  for (const buf of pools.data.free) {
    if (!zeros(buf)) {
      return false;
    }
  }
  for (const have of pools.bits.free) {
    if (!zeros(have)) {
      return false;
    }
  }
  for (let k: i32 = 0; k < pools.ready; k++) {
    if (!zeros(pools.readyData[k]) || !zeros(pools.readyBits[k])) {
      return false;
    }
  }
  return true;
};

/** `buf[0, n)`, copied. */
const head = (buf: u8[], n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    out.push(buf[k]);
  }
  return out;
};

/** Whether `a` and `b` hold the same bytes. */
const same = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(a.length); k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/**
 * Stream 0 of `s` opened by the peer with 10 bytes and its FIN, read to the
 * end, then answered with `body` and a FIN sent in one frame and
 * acknowledged: both sides of it done, both buffers given back.
 */
const roundTrip = (s: QuicStreams, body: u8[]): void => {
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), true);
  const into: u8[] = new Array<u8>(64);
  while (s.read(n64(0), into, n32(0), n32(64)) !== QUIC_STREAM_END) {
    // to the end
  }
  s.write(n64(0), body, n32(0), toI32(body.length), true);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  s.putNextChunk(buf, n32(0), n32(1200));
  s.chunkAcked(n64(0), n64(0), toI32(body.length), true);
};

/** A lost last segment: the send buffer stays lent until the acknowledgement, and the bytes sent again are the bytes sent first. */
const keptUntilAck = (t: Suite): void => {
  const s = table();
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  const body: u8[] = bytesOf(nqText(n32(100)));
  s.write(n64(0), body, n32(0), n32(100), true);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  const sent: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  const first: u8[] = head(buf, sent);
  t.ok("a stream's 100 bytes and its FIN go out in one frame", sent > 0 && s.lastOffset === n64(0) && s.lastLength === n32(100) && s.lastFin);
  s.chunkLost(n64(0), n64(0), n32(100), true);
  const stream: QuicStream = streamOf(s, n64(0));
  t.ok("lost, with every byte written sent, the send buffer is still lent", stream.sendBuf.length === 1024 && stream.sendAcked.length === 128);
  buf.fill(0);
  s.beginPacket();
  const again: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  t.ok("the frame sent again is the frame sent first, byte for byte, read from the kept buffer", again === sent && same(head(buf, again), first));
  t.ok("sent again but not acknowledged, the buffer stays lent", stream.sendBuf.length === 1024);
  // The second half and the FIN acknowledged first: the final size is known
  // acknowledged, but bytes below it are not, and a loss would send them again.
  s.chunkAcked(n64(0), n64(50), n32(50), true);
  t.ok("with the FIN acknowledged and its first 50 bytes not, the send buffer stays lent", stream.sendBuf.length === 1024);
  s.chunkAcked(n64(0), n64(0), n32(50), false);
  t.ok("acknowledged to the final size, the send buffer goes back to the pool", stream.sendBuf.length === 0 && stream.sendAcked.length === 0);
};

/** Two tables sharing pools: what the first gives back the second borrows, every byte of it zero. */
const zeroedReuse = (t: Suite): void => {
  const pools = new QuicStreamPools(n32(1024), n32(4), n32(2));
  const a = table();
  const b = table();
  a.share(pools);
  b.share(pools);
  roundTrip(a, bytesOf(nqText(n32(100))));
  const made: i32 = pools.data.made;
  t.ok("the first table's stream done both ways, it holds no buffer", pools.lent() === n32(0) && made >= n32(2));
  t.ok("every buffer back in the pools is zeroed, the bitmaps too", freeZeroed(pools));
  b.prime(n32(1200));
  b.onStream(n64(0), n64(0), bytesOf(nqText(n32(1))), n32(0), n32(1), false);
  const one: u8[] = [toU8(0x5a)];
  b.write(n64(0), one, n32(0), n32(1), false);
  const stream: QuicStream = streamOf(b, n64(0));
  t.ok("the second table borrows what the first gave back, making none", pools.data.made === made && stream.recvBuf.length === 1024 && stream.sendBuf.length === 1024);
  t.ok("past the byte it was given, its receive buffer and bitmap are all zero", zerosFrom(stream.recvBuf, n32(1)) && zerosFrom(stream.recvHave, n32(1)));
  t.ok("past the byte it wrote, its send buffer is all zero", zerosFrom(stream.sendBuf, n32(1)) && zeros(stream.sendAcked));
  b.reset();
  t.ok("reset, the second table gives both back: nothing lent from the shared pools", pools.lent() === n32(0));
};

/** A table of its own makes its pools on first use and gives every buffer back on `reset`. */
const privateReset = (t: Suite): void => {
  const s = table();
  t.ok("a table that has moved no byte has no pools", s.pools === null);
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  s.write(n64(0), bytesOf(nqText(n32(100))), n32(0), n32(100), false);
  const pools: QuicStreamPools | null = s.pools;
  if (pools === null) {
    t.fail("a table's own pools", "none were made");
    return;
  }
  t.ok("its pools make every buffer at once, and lend two buffers and two bitmaps", pools.data.made === pools.data.ceiling && pools.lent() === n32(4));
  s.reset();
  t.ok("reset, it holds none", pools.lent() === n32(0) && freeZeroed(pools));
};

/** Two tables sharing one set of pools, as an HTTP/3 listener's slots share them. */
const pair = (pools: QuicStreamPools): QuicStreams[] => {
  const a = table();
  const b = table();
  a.share(pools);
  b.share(pools);
  return [a, b];
};

/** Sends what `s` owes on its streams, one frame a packet, each acknowledged at once: the bytes sent. */
const drain = (s: QuicStreams): i32 => {
  const buf: u8[] = new Array<u8>(1200);
  let total: i32 = 0;
  for (let k: i32 = 0; k < 16; k++) {
    s.beginPacket();
    if (s.putNextChunk(buf, n32(0), n32(1200)) <= 0) {
      return total;
    }
    total += s.lastLength;
    s.chunkAcked(s.lastId, s.lastOffset, s.lastLength, s.lastFin);
  }
  return total;
};

/** Reads stream `id` of `s` until it answers the end or a refusal: the bytes read. */
const readAll = (s: QuicStreams, id: i64): i32 => {
  const into: u8[] = new Array<u8>(256);
  let total: i32 = 0;
  for (let k: i32 = 0; k < 64; k++) {
    const n: i32 = s.read(id, into, n32(0), n32(256));
    if (n <= 0) {
      return total;
    }
    total += n;
  }
  return total;
};

/** Whether stream 0 of `b`, given one byte, borrows a receive buffer and bitmap zero past it, making none. */
const borrowsZeroed = (b: QuicStreams, pools: QuicStreamPools): boolean => {
  const made: i32 = pools.data.made;
  b.prime(n32(1200));
  b.onStream(n64(0), n64(0), bytesOf(nqText(n32(1))), n32(0), n32(1), false);
  const stream: QuicStream = streamOf(b, n64(0));
  return pools.data.made === made && stream.recvBuf.length === 1024 && zerosFrom(stream.recvBuf, n32(1)) && zerosFrom(stream.recvHave, n32(1));
};

/** The peer resets a stream holding bytes out of order past its contiguous end: the buffer and bitmap go back zeroed. */
const resetOutOfOrder = (t: Suite): void => {
  const pools = new QuicStreamPools(n32(1024), n32(4), n32(2));
  const tables: QuicStreams[] = pair(pools);
  const a: QuicStreams = tables[0];
  a.prime(n32(1200));
  a.onStream(n64(0), n64(0), bytesOf(nqText(n32(5))), n32(0), n32(5), false);
  a.onStream(n64(0), n64(600), bytesOf(nqText(n32(100))), n32(0), n32(100), false);
  const stream: QuicStream = streamOf(a, n64(0));
  t.ok("bytes 600 to 700 held past a contiguous end of 5", stream.recvContiguous === n64(5) && stream.recvHighest === n64(700));
  a.onReset(n64(0), n64(7), n64(700));
  t.ok("reset by the peer, the receive buffer and bitmap go back, every byte to the highest zeroed", stream.recvBuf.length === 0 && pools.lent() === n32(0) && freeZeroed(pools));
  t.ok("the next borrower finds the buffer and bitmap clean past its own byte", borrowsZeroed(tables[1], pools));
};

/** Sends stream 0's 100 bytes and its FIN in one frame, unacknowledged, and resets or stops it by `stop`. */
const sentThenAbandoned = (s: QuicStreams, stop: boolean): void => {
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  s.write(n64(0), bytesOf(nqText(n32(100))), n32(0), n32(100), true);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  s.putNextChunk(buf, n32(0), n32(1200));
  if (stop) {
    s.onStopSending(n64(0), n64(9));
  } else {
    s.resetStream(n64(0), n64(9));
  }
};

/** A late acknowledgement, a loss or a probe after the sending side is reset reads nothing from the buffer it gave back. */
const lateAfterReset = (t: Suite, stop: boolean, what: string): void => {
  const pools = new QuicStreamPools(n32(1024), n32(4), n32(2));
  const tables: QuicStreams[] = pair(pools);
  const a: QuicStreams = tables[0];
  sentThenAbandoned(a, stop);
  const stream: QuicStream = streamOf(a, n64(0));
  t.ok(`${what} after sending, the send buffer goes back at once, zeroed`, stream.sendBuf.length === 0 && pools.lent() === n32(2) && freeZeroed(pools));
  a.chunkLost(n64(0), n64(0), n32(100), true);
  const buf: u8[] = new Array<u8>(1200);
  a.beginPacket();
  t.ok(`lost after ${what}, nothing is sent again from it`, a.putNextChunk(buf, n32(0), n32(1200)) <= 0 && stream.resendLow < n64(0));
  a.chunkAcked(n64(0), n64(0), n32(100), true);
  t.ok(`acknowledged late after ${what}, the free buffers stay zero and none is lent again`, pools.lent() === n32(2) && freeZeroed(pools));
  a.beginPacket();
  t.ok(`a probe after ${what} sends no stream byte either`, a.putNextChunk(buf, n32(0), n32(1200)) <= 0);
};

/** A stream longer than its buffer, both ways: the offsets wrap, and the whole buffer is zeroed when it goes back. */
const longerThanBuffer = (t: Suite): void => {
  const pools = new QuicStreamPools(n32(1024), n32(4), n32(2));
  const tables: QuicStreams[] = pair(pools);
  const a: QuicStreams = tables[0];
  a.prime(n32(1200));
  a.onStream(n64(0), n64(0), bytesOf(nqText(n32(1000))), n32(0), n32(1000), false);
  const first: i32 = readAll(a, n64(0));
  a.onStream(n64(0), n64(1000), bytesOf(nqText(n32(500))), n32(0), n32(500), true);
  const second: i32 = readAll(a, n64(0));
  t.ok("1,500 bytes received through a 1,024-byte buffer, read to the end", first + second === n32(1500) && streamOf(a, n64(0)).recvBuf.length === 0);
  a.onMaxStreamData(n64(0), n64(4096));
  const body: u8[] = bytesOf(nqText(n32(1000)));
  a.write(n64(0), body, n32(0), n32(1000), false);
  const sentFirst: i32 = drain(a);
  a.write(n64(0), body, n32(0), n32(500), true);
  const sentSecond: i32 = drain(a);
  t.ok("1,500 bytes sent through a 1,024-byte buffer, each acknowledged", sentFirst + sentSecond === n32(1500) && a.find(n64(0)) === null);
  t.ok("both sides done, both buffers go back with every byte of them zeroed", pools.lent() === n32(0) && freeZeroed(pools));
  t.ok("the next borrower finds the wrapped buffer clean", borrowsZeroed(tables[1], pools));
};

/** Every way a side ends twice gives its buffer back once: a reset after completion, a release and a table reset after a reset. */
const givenOnce = (t: Suite): void => {
  const pools = new QuicStreamPools(n32(1024), n32(4), n32(2));
  const tables: QuicStreams[] = pair(pools);
  const a: QuicStreams = tables[0];
  a.prime(n32(1200));
  a.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  a.write(n64(0), bytesOf(nqText(n32(100))), n32(0), n32(100), true);
  drain(a);
  t.ok("the sending side acknowledged to its final size, its buffer back", pools.lent() === n32(2));
  t.ok("a reset after completion is refused and gives nothing back", a.resetStream(n64(0), n64(1)) === QUIC_STREAM_ERR_FINISHED && pools.lent() === n32(2));
  a.onReset(n64(0), n64(3), n64(10));
  t.ok("the receiving side reset, its buffer back", pools.lent() === n32(0));
  const into: u8[] = new Array<u8>(8);
  a.read(n64(0), into, n32(0), n32(8));
  t.ok("the reset read, the slot released: nothing given back a second time", pools.lent() === n32(0) && a.find(n64(0)) === null);
  a.reset();
  a.giveBack();
  t.ok("a table reset and a second give-back after it give nothing back again", pools.lent() === n32(0) && toI32(pools.data.free.length) === pools.data.made);
  t.ok("a stop-sending answered after the stream is gone gives nothing back", a.stopSending(n64(0), n64(1)) !== QUIC_STREAM_OK && pools.lent() === n32(0));
};

/** Unread bytes when the connection gives its buffers back: the read answers the end and copies nothing. */
const readAfterRelease = (t: Suite): void => {
  const s = table();
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  s.giveBack();
  const into: u8[] = new Array<u8>(16);
  into.fill(0x77);
  t.ok("ten bytes owed after the give-back: the read answers the end, copying nothing", s.read(n64(0), into, n32(0), n32(16)) === QUIC_STREAM_END && into[0] === toU8(0x77));
};

/** Every check of this file. */
export const poolChecks = (t: Suite): void => {
  keptUntilAck(t);
  zeroedReuse(t);
  privateReset(t);
  resetOutOfOrder(t);
  lateAfterReset(t, false, "a reset");
  lateAfterReset(t, true, "a stop-sending");
  longerThanBuffer(t);
  givenOnce(t);
  readAfterRelease(t);
};
