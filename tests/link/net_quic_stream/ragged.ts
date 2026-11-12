// A ring whose size is not a multiple of 8, driven on `QuicStreams` directly,
// as `nish/net/quic` drives it: the bitmap's last byte holds one bit, and the
// runs start mid-byte and straddle the ring's end. The receive side takes
// frames out of order and is read in odd chunks. The send side is written in
// odd pieces, and its chunks are acknowledged out of order, split so that the
// ends fall mid-byte. Every byte is checked against the offset it was sent
// at, and `recvContiguous` and `sendBase` against a bit-per-byte model kept
// here.
import { Suite } from "nish/testing";
import { QuicStream, QuicStreams } from "nish/net/quic-stream";
import {
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicParseFrame,
} from "nish/net/quic-frame";
import { n32, n64 } from "../net_quic_frame/typed";

/** A table of four streams each way, 1,001-byte buffers: 126 bitmap bytes, the last holding one bit. */
const raggedTable = (): QuicStreams => {
  const s = new QuicStreams(n64(4), n64(0), n64(0), n32(1001), n64(1048576));
  s.setPeerLimits(
    n64(1048576),
    n64(1048576),
    n64(1048576),
    n64(1048576),
    n64(4),
    n64(0)
  );
  return s;
};

/** `count` bytes whose value follows the offset, with a period that is not a divisor of the ring size. */
const pattern = (count: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < count; k++) {
    out.push(toU8((k * 7 + (k >> 5)) & 255));
  }
  return out;
};

/** Stream `id` of `s`, or null once the table released it. */
const raggedStream = (s: QuicStreams, id: i64): QuicStream | null => s.find(id);

/** Whether `got` is the first `toI32(got.length)` bytes of `want`, and all of them when `whole`. */
const raggedSame = (got: u8[], want: u8[], whole: boolean): boolean => {
  if (
    toI32(got.length) > toI32(want.length) ||
    (whole && toI32(got.length) !== toI32(want.length))
  ) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(got.length); k++) {
    if (got[k] !== want[k]) {
      return false;
    }
  }
  return true;
};

/** The receive side: frames out of order at unaligned offsets, a duplicate, odd reads, through several buffers. */
const receiveChecks = (t: Suite): void => {
  const s = raggedTable();
  const id: i64 = n64(0);
  const total: i32 = n32(6000);
  const data: u8[] = pattern(total);
  const got: u8[] = [];
  const out: u8[] = new Array<u8>(n32(37));
  // A frame with no bytes opens the stream, as the peer's first frame would.
  s.prime(n32(1200));
  s.onStream(id, n64(0), data, n32(0), n32(0), false);
  let edges: boolean = true;
  let rounds: i32 = 0;
  let straddled: i32 = 0;
  while (toI32(got.length) < total && rounds < n32(64)) {
    const stream: QuicStream | null = raggedStream(s, id);
    if (stream === null) {
      break;
    }
    const a: i32 = toI32(got.length);
    const limit: i32 = toI32(stream.recvLimit);
    let b: i32 = a + n32(700) + rounds * n32(37);
    b = b < limit ? b : limit;
    b = b < total ? b : total;
    const fin: boolean = b === total;
    // Three pieces whose edges fall mid-byte, sent last first.
    const x: i32 = a + n32(13) + rounds * n32(3);
    const y: i32 = a + ((b - a) * n32(2)) / n32(3) + n32(5);
    if ((a % n32(1001)) + (b - a) > n32(1001)) {
      straddled = straddled + n32(1);
    }
    s.prime(n32(1200));
    s.onStream(id, toI64(y), data, y, b - y, fin);
    edges = edges && stream.recvContiguous === toI64(a);
    s.prime(n32(1200));
    s.onStream(id, toI64(x), data, x, y - x, false);
    edges = edges && stream.recvContiguous === toI64(a);
    // A duplicate over the gap's far edge and the run past it changes nothing.
    s.prime(n32(1200));
    s.onStream(id, toI64(y - n32(3)), data, y - n32(3), n32(20), false);
    edges = edges && stream.recvContiguous === toI64(a);
    s.prime(n32(1200));
    s.onStream(id, toI64(a), data, a, x - a, false);
    edges = edges && stream.recvContiguous === toI64(b);
    let n: i32 = s.read(id, out, n32(0), n32(37));
    while (n > 0) {
      for (let k: i32 = 0; k < n; k++) {
        got.push(out[k]);
      }
      n = s.read(id, out, n32(0), n32(37));
    }
    rounds = rounds + n32(1);
  }
  t.ok(
    "a 1,001-byte ring takes runs that straddle its end",
    straddled >= n32(3)
  );
  t.ok(
    "out-of-order frames at unaligned offsets hold the contiguous edge until the gap fills, then move it to the run's end",
    edges
  );
  t.ok(
    "6,000 bytes come out of a 1,001-byte ring in 37-byte reads, each the one sent at its offset",
    raggedSame(got, data, true)
  );
};

/** The send side: odd writes, chunks checked against their offsets, acknowledged out of order in mid-byte pieces. */
const sendChecks = (t: Suite): void => {
  const s = raggedTable();
  const id: i64 = n64(4);
  const total: i32 = n32(6000);
  const data: u8[] = pattern(total);
  s.prime(n32(1200));
  s.onStream(id, n64(0), data, n32(0), n32(0), false);
  const acked: u8[] = new Array<u8>(total);
  const packet: u8[] = new Array<u8>(n32(400));
  const frame = new QuicFrame();
  let written: i32 = 0;
  let base: i32 = 0;
  let bytes: boolean = true;
  let bases: boolean = true;
  let held: i32 = 0;
  let straddled: i32 = 0;
  let rounds: i32 = 0;
  while (base < total && rounds < n32(64)) {
    // The first round writes 333 bytes, so every later one starts mid-ring and wraps.
    const cap: i32 = rounds === 0 ? n32(333) : total;
    while (written < cap) {
      const want: i32 = cap - written < n32(97) ? cap - written : n32(97);
      const n: i32 = s.write(id, data, written, want, written + want === total);
      written = written + (n > 0 ? n : n32(0));
      if (n < want) {
        break;
      }
    }
    if ((base % n32(1001)) + (written - base) > n32(1001)) {
      straddled = straddled + n32(1);
    }
    const offsets: i64[] = [];
    const lengths: i32[] = [];
    const fins: boolean[] = [];
    let more: boolean = true;
    while (more) {
      s.beginPacket();
      const end: i32 = s.putNextChunk(
        packet,
        n32(0),
        n32(250) + ((rounds * n32(13)) % n32(100))
      );
      if (end <= 0) {
        more = false;
      } else {
        const bad: boolean =
          quicParseFrame(frame, packet, n32(0), end) !== n64(0);
        bytes =
          bytes &&
          !bad &&
          frame.type === QUIC_FRAME_STREAM &&
          frame.streamId === id &&
          frame.offset === s.lastOffset &&
          frame.dataLength === s.lastLength;
        for (let k: i32 = 0; k < frame.dataLength && !bad; k++) {
          bytes =
            bytes &&
            packet[frame.dataStart + k] === data[toI32(frame.offset) + k];
        }
        offsets.push(s.lastOffset);
        lengths.push(s.lastLength);
        fins.push(s.lastFin);
      }
    }
    // The last chunk first, each split near its middle so the ends fall mid-byte, its far half first.
    for (let c: i32 = toI32(lengths.length) - n32(1); c >= 0; c--) {
      const offset: i32 = toI32(offsets[c]);
      const length: i32 = lengths[c];
      const half: i32 = length > n32(8) ? length / n32(2) + n32(3) : length;
      const pieces: i32 = half < length ? n32(2) : n32(1);
      for (let p: i32 = 0; p < pieces; p++) {
        const from: i32 = p === 0 && pieces === n32(2) ? offset + half : offset;
        const count: i32 = p === 0 && pieces === n32(2) ? length - half : half;
        const fin: boolean = fins[c] && from + count === offset + length;
        s.chunkAcked(id, toI64(from), count, fin);
        for (let k: i32 = from; k < from + count; k++) {
          acked[k] = toU8(1);
        }
        const before: i32 = base;
        while (base < written && acked[base] !== toU8(0)) {
          base = base + n32(1);
        }
        if (base === before) {
          held = held + n32(1);
        }
        const stream: QuicStream | null = raggedStream(s, id);
        bases =
          bases &&
          (stream === null ? base === total : stream.sendBase === toI64(base));
      }
    }
    rounds = rounds + n32(1);
  }
  t.ok("what is in flight straddles the 1,001-byte ring's end, round after round", straddled >= n32(3));
  t.ok(
    "every chunk off a 1,001-byte ring carries the bytes written at its offset",
    bytes && written === total
  );
  t.ok(
    "the send base stops at the first unacknowledged byte through out-of-order, mid-byte acknowledgements",
    bases && base === total && held > n32(0)
  );
  s.beginPacket();
  t.ok(
    "once every byte and the FIN are acknowledged nothing is left to send",
    s.putNextChunk(packet, n32(0), n32(400)) <= 0
  );
};

/** Every check of this file. */
export const raggedChecks = (t: Suite): void => {
  receiveChecks(t);
  sendChecks(t);
};
