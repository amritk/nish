// `examples/relay/peers.ts`, the per-address session counts, on its own: a
// table small enough that addresses collide and probe runs wrap past its
// end, rows claimed to their cap, refused past it, and released in an order
// that makes the backward-shift deletion move rows, with every address still
// found afterwards and no row left behind.
import { Suite } from "nish/testing";
import { RelayPeers } from "../../../examples/relay/peers";
import { n32 } from "../net_quic_frame/typed";

/** The address form of `::ffff:10.0.0.<n>`. */
const address = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(18);
  out[10] = toU8(255);
  out[11] = toU8(255);
  out[12] = toU8(10);
  out[15] = toU8(n);
  return out;
};

/** Every peer-table check. */
export const peerChecks = (t: Suite): void => {
  const salt: u8[] = [toU8(1), toU8(2), toU8(3), toU8(4), toU8(5), toU8(6), toU8(7), toU8(8)];
  const peers = new RelayPeers(n32(8), salt);
  let claimed: i32 = 0;
  for (let n: i32 = 1; n <= 8; n++) {
    if (peers.claim(address(n), n32(2))) {
      claimed++;
    }
  }
  t.ok("eight addresses fill a table of eight rows", claimed === n32(8) && peers.used === n32(8));
  t.ok("a ninth finds no row", !peers.claim(address(9), n32(2)));
  t.ok("a second session of an address takes no row", peers.claim(address(3), n32(2)) && peers.count(address(3)) === n32(2) && peers.used === n32(8));
  t.ok("a third is over the cap", !peers.claim(address(3), n32(2)));
  // Release every other address, in an order unrelated to where each landed.
  const order: i32[] = [n32(6), n32(2), n32(8), n32(4)];
  for (const n of order) {
    peers.release(address(n));
  }
  let found: i32 = 0;
  for (let n: i32 = 1; n <= 8; n++) {
    const want: i32 = n % 2 === 1 ? (n === 3 ? n32(2) : n32(1)) : n32(0);
    if (peers.count(address(n)) === want) {
      found++;
    }
  }
  t.ok("after four rows go, every address left is found with its count, and the gone ones are not", found === n32(8) && peers.used === n32(4));
  peers.release(address(3));
  t.ok("a row stays while a session holds it", peers.count(address(3)) === n32(1) && peers.used === n32(4));
  for (const n of [n32(1), n32(3), n32(5), n32(7)]) {
    peers.release(address(n));
  }
  t.ok("and goes with its last: the table is empty", peers.used === n32(0) && peers.find(address(1)) === n32(-1));
  peers.release(address(1));
  t.ok("releasing an address that holds nothing does nothing", peers.used === n32(0));
  t.ok("a cap of 0 refuses a new address", !peers.claim(address(1), n32(0)));
  for (let n: i32 = 1; n <= 8; n++) {
    peers.claim(address(n), n32(1));
  }
  t.eqI32("the table refills after emptying", peers.used, n32(8));
  // Releasing one address moves the rows after it back over the hole; each
  // release is by address, so every other count stays its own.
  for (let n: i32 = 1; n <= 8; n++) {
    peers.release(address(n));
    let others: i32 = 0;
    for (let m: i32 = n + 1; m <= 8; m++) {
      others = others + peers.count(address(m));
    }
    if (others !== 8 - n) {
      t.fail("each release by address leaves every other count as it was", `after ${n}: ${others}`);
      return;
    }
  }
  t.ok("each release by address leaves every other count as it was", peers.used === n32(0));
};
