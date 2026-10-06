// The carrier's two tables on their own: the connection-ID index a datagram
// is routed through, and the timer wheel `tick` and `timeout` read. Each is
// driven past the cases that are easy to get wrong — a probe run broken by a
// removal, an ID filed twice, a deadline past the horizon, a bucket emptied
// — with no socket.
import { Suite } from "nish/testing";
import { H3_SERVER_WHEEL, Http3CidIndex, Http3Wheel } from "nish/net/http3-server";
import { n32, n64 } from "../net_quic_frame/typed";

/** An eight-byte ID whose bytes are `seed`, `seed + 1`, … */
const cid = (seed: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 8; k++) {
    out.push(toU8((seed + k * 37) & 255));
  }
  return out;
};

/** The index: every ID found, removals that keep the rest found, and nothing found that was not filed. */
const index = (t: Suite): void => {
  const salt: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)];
  // Four slots: twenty entries in a table of 64, so probe runs form.
  const ix = new Http3CidIndex(n32(4), salt);
  for (let e: i32 = 0; e < 20; e++) {
    ix.insert(e, cid(e * 11), n32(0), n32(8));
  }
  let found: boolean = true;
  for (let e: i32 = 0; e < 20; e++) {
    found = found && ix.find(cid(e * 11), n32(0), n32(8)) === e / 5;
  }
  t.ok("twenty IDs filed for four slots: each found, and found as its slot", found);
  t.eqI32("an ID never filed is not found", ix.find(cid(999), n32(0), n32(8)), n32(-1));
  t.eqI32("nor one of another length", ix.find(cid(0), n32(0), n32(7)), n32(-1));
  for (let e: i32 = 0; e < 20; e += 2) {
    ix.remove(e);
  }
  let rest: boolean = true;
  for (let e: i32 = 0; e < 20; e++) {
    const want: i32 = e % 2 === 0 ? n32(-1) : e / 5;
    rest = rest && ix.find(cid(e * 11), n32(0), n32(8)) === want;
  }
  t.ok("half removed: those are gone, and every other is still found across the holes", rest);
  ix.remove(n32(0));
  ix.remove(n32(-1));
  ix.remove(n32(400));
  t.ok("removing an empty entry, or one out of range, changes nothing", ix.find(cid(11), n32(0), n32(8)) === n32(0));
  ix.insert(n32(2), cid(11), n32(0), n32(8));
  t.eqI32("an ID already filed under another entry stays with that one", ix.find(cid(11), n32(0), n32(8)), n32(0));
  const window: u8[] = [toU8(0xff), toU8(0xff)];
  for (const b of cid(500)) {
    window.push(b);
  }
  ix.insert(n32(4), window, n32(2), n32(8));
  t.eqI32("an ID filed from a window of a datagram, and found from another", ix.find(cid(500), n32(0), n32(8)), n32(0));
  ix.insert(n32(6), cid(600), n32(0), n32(21));
  t.eqI32("one longer than 20 bytes is never filed", ix.find(cid(600), n32(0), n32(8)), n32(-1));
};

/** The wheel: the earliest filed deadline first, the horizon, and slots taken out. */
const wheel = (t: Suite): void => {
  const w = new Http3Wheel(n32(4));
  t.eqI32("an empty wheel has no timeout", w.next(n64(1000)), n32(-1));
  w.file(n32(0), n64(1050), n64(1000));
  w.file(n32(1), n64(1010), n64(1000));
  w.file(n32(2), n64(1010), n64(1000));
  t.eqI32("three slots filed: the next is 10 ms away", w.next(n64(1000)), n32(10));
  w.unfile(n32(1));
  t.eqI32("one of the two at 1,010 taken out: still 10 ms", w.next(n64(1000)), n32(10));
  w.unfile(n32(2));
  t.eqI32("both: the one at 1,050", w.next(n64(1000)), n32(50));
  w.file(n32(3), n64(900), n64(1000));
  t.eqI32("a deadline already past is due now", w.next(n64(1000)), n32(0));
  t.eqI32("and is taken from the cursor's bucket", w.take(n64(1000)), n32(3));
  t.eqI32("leaving none there", w.take(n64(1000)), n32(-1));
  w.file(n32(0), n64(61000), n64(1000));
  t.eqI32("a deadline past the horizon is filed at the horizon, to be filed again then", w.next(n64(1000)), H3_SERVER_WHEEL - 1);
  t.eqI64("keeping the deadline it was filed for", w.dueAt[0], n64(61000));
  // After a tick the cursor is a millisecond ahead of `now`: the horizon's bucket is then `now`'s, a full turn away, not due.
  w.cursor = n64(1001);
  w.file(n32(0), n64(61000), n64(1000));
  t.eqI32("after a tick, a deadline at the horizon is a whole turn away, not due now", w.next(n64(1000)), H3_SERVER_WHEEL);
  w.file(n32(0), n64(-1), n64(1000));
  t.eqI32("a slot with no deadline is filed nowhere", w.next(n64(1000)), n32(-1));
  // 64 buckets to a word of the bitmap: a deadline in the third word is found past two empty ones.
  w.file(n32(1), n64(1150), n64(1000));
  t.eqI32("a deadline two words of buckets away", w.next(n64(1000)), n32(150));
};

/** Every check of this file. */
export const unitChecks = (t: Suite): void => {
  index(t);
  wheel(t);
};
