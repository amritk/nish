// The stream buffers a table borrows (QUIC-3 in docs/security/quic.md): a
// send side keeps its buffer while a lost segment waits to go again, and
// gives it back only once the acknowledgement covers the final size; two
// tables sharing one set of pools find every buffer zeroed when the first
// gives it back; a table of its own gives every buffer back on `reset`.
// Driven on `QuicStreams` directly, as `nish/net/quic` drives it.
import { Suite } from "nish/testing";
import { QUIC_STREAM_END, QuicStream, QuicStreamPools, QuicStreams } from "nish/net/quic-stream";
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

/** Whether every buffer back in `pools`, both lists, is all zero. */
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
  s.settle();
  const into: u8[] = new Array<u8>(64);
  while (s.read(n64(0), into, n32(0), n32(64)) !== QUIC_STREAM_END) {
    // to the end
  }
  s.write(n64(0), body, n32(0), toI32(body.length), true);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  s.putNextChunk(buf, n32(0), n32(1200));
  s.chunkAcked(n64(0), n64(0), toI32(body.length), true);
  s.settle();
};

/** A lost last segment: the send buffer stays lent until the acknowledgement, and the bytes sent again are the bytes sent first. */
const keptUntilAck = (t: Suite): void => {
  const s = table();
  s.prime(n32(1200));
  s.onStream(n64(0), n64(0), bytesOf(nqText(n32(10))), n32(0), n32(10), false);
  s.settle();
  const body: u8[] = bytesOf(nqText(n32(100)));
  s.write(n64(0), body, n32(0), n32(100), true);
  const buf: u8[] = new Array<u8>(1200);
  s.beginPacket();
  const sent: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  const first: u8[] = head(buf, sent);
  t.ok("a stream's 100 bytes and its FIN go out in one frame", sent > 0 && s.lastOffset === n64(0) && s.lastLength === n32(100) && s.lastFin);
  s.chunkLost(n64(0), n64(0), n32(100), true);
  s.settle();
  const stream: QuicStream = streamOf(s, n64(0));
  t.ok("lost, with every byte written sent, the send buffer is still lent", stream.sendBuf.length === 1024 && stream.sendAcked.length === 128);
  buf.fill(0);
  s.beginPacket();
  const again: i32 = s.putNextChunk(buf, n32(0), n32(1200));
  t.ok("the frame sent again is the frame sent first, byte for byte, read from the kept buffer", again === sent && same(head(buf, again), first));
  t.ok("sent again but not acknowledged, the buffer stays lent", stream.sendBuf.length === 1024);
  s.chunkAcked(n64(0), n64(0), n32(100), true);
  s.settle();
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
  b.settle();
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
  s.settle();
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

/** Every check of this file. */
export const poolChecks = (t: Suite): void => {
  keptUntilAck(t);
  zeroedReuse(t);
  privateReset(t);
};
