// WP34 N5: segmentation offload and ECN, which only Linux has. The `net_`
// block of tests/run.js binds a `dgram` socket, runs this with its port, and
// counts what arrives there. GSO: one `udpSendTo` of 4,800 bytes with a
// segment of 1,200 leaves as four datagrams, which Node receives one by one.
// GRO: the same send to a socket bound with flag 2 comes back from one
// `udpRecvFrom` as several datagrams at once, with the segment size in
// `meta[0]`; a socket without the flag receives the first 1,200 bytes alone
// and 0 there. ECN: the bits a send asks for arrive in `meta[1]`. Loopback
// coalesces only what left as one GSO send, which is why the sender here is
// Nish and not Node, whose `dgram` has no segmentation. No `.out`: it needs
// the port, and elsewhere than Linux these calls answer -95.
import { netAddress, netClose, netLocalPort, udpBind, udpRecvFrom, udpSendTo } from "nish:net";

const WOULD_BLOCK: i32 = -11;
const SEGMENT: i32 = 1200;
const TOTAL: i32 = 4800;

/** One receive, waiting for something to arrive. */
const receive = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i32 => {
  let n = udpRecvFrom(fd, buf, 0, buf.length, from, meta);
  while (n === WOULD_BLOCK) {
    n = udpRecvFrom(fd, buf, 0, buf.length, from, meta);
  }
  return n;
};

/** Whether `buf[0, n)` is the pattern `main` sent. */
const intact = (buf: u8[], n: i32): boolean => {
  if (n < 0 || n > buf.length) {
    return false;
  }
  for (let i = 0; i < n; i++) {
    if (toI32(buf[i]) !== i % 251) {
      return false;
    }
  }
  return true;
};

export const main = (): number => {
  const node = toI32(parseInt(process.argv[1]));
  const data: u8[] = new Array<u8>(TOTAL);
  for (let i = 0; i < data.length; i++) {
    data[i] = toU8(i % 251);
  }
  const to: u8[] = new Array<u8>(18);
  const sender = udpBind("127.0.0.1", 0, 0);
  netAddress(to, "127.0.0.1", node);
  console.log(`gso sent ${udpSendTo(sender, data, 0, TOTAL, to, SEGMENT, 0)}`);

  const buf: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  const gro = udpBind("127.0.0.1", 0, 2);
  const plain = udpBind("127.0.0.1", 0, 0);
  for (const fd of [gro, plain]) {
    netAddress(to, "127.0.0.1", netLocalPort(fd));
    udpSendTo(sender, data, 0, TOTAL, to, SEGMENT, 0);
    const n = receive(fd, buf, from, meta);
    console.log(`${fd === gro ? "gro" : "plain"} ${n} bytes, segment ${meta[0]}, intact ${intact(buf, n)}`);
  }

  for (const ecn of [1, 2, 3, 0]) {
    netAddress(to, "127.0.0.1", netLocalPort(plain));
    udpSendTo(sender, data, 0, 16, to, 0, ecn);
    // The three datagrams left from the GSO send come first.
    let n = receive(plain, buf, from, meta);
    while (n === SEGMENT) {
      n = receive(plain, buf, from, meta);
    }
    console.log(`ecn ${ecn}: ${n} bytes, ecn ${meta[1]}`);
  }
  return netClose(sender) + netClose(gro) + netClose(plain);
};
