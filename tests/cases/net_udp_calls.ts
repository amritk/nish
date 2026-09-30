// WP34 N5: every UDP answer a program can pin with itself as the peer, on
// every platform, through the globals. Two sockets on 127.0.0.1 trade a
// datagram, and the receiver learns the sender's port and the two `meta`
// words, 0 and 0 for a datagram nobody coalesced or marked. A datagram longer
// than the range it is read into is cut to it. -22 for each bad argument (a
// flag past 3, a name, a short `to`, `from` or `meta`, a segment past 65535,
// ECN past 3), -11 from a receive with nothing waiting, -98 from a second bind
// to a port in use and none when both binds ask for `SO_REUSEPORT`, -95 from
// `tcpAccept` on a datagram socket, and a socket on `::`, which on a kernel
// without IPv6 falls back to IPv4, still sends to an IPv4 address.
const WOULD_BLOCK: i32 = -11;

/** One datagram, waiting for it to arrive. */
const receive = (fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32 => {
  let n = udpRecvFrom(fd, buf, off, len, from, meta);
  while (n === WOULD_BLOCK) {
    n = udpRecvFrom(fd, buf, off, len, from, meta);
  }
  return n;
};

/** Three bytes of `data` to `to`, as one plain datagram. */
const send = (fd: i32, data: readonly u8[], to: readonly u8[]): i32 => udpSendTo(fd, data, 0, 3, to, 0, 0);

export const main = (): number => {
  const a = udpBind("127.0.0.1", 0, 0);
  const b = udpBind("127.0.0.1", 0, 0);
  console.log(a >= 0 && b >= 0 && netLocalPort(b) > 0);
  const toB: u8[] = new Array<u8>(18);
  netAddress(toB, "127.0.0.1", netLocalPort(b));
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [7, 7];
  const buf: u8[] = new Array<u8>(8);
  const data: u8[] = [10, 20, 30];

  console.log(udpRecvFrom(b, buf, 0, 8, from, meta));
  console.log(send(a, data, toB));
  console.log(receive(b, buf, 2, 6, from, meta));
  console.log(`${buf[2]} ${buf[3]} ${buf[4]} ${meta[0]} ${meta[1]}`);
  const port = (toI32(from[16]) << 8) | toI32(from[17]);
  console.log(`${from[10]} ${from[11]} ${from[12]} ${from[15]} ${port === netLocalPort(a)}`);
  console.log(send(a, data, toB));
  console.log(receive(b, buf, 0, 2, from, meta));

  const short: u8[] = new Array<u8>(17);
  const one: i32[] = [0];
  console.log(udpBind("127.0.0.1", 0, 4));
  console.log(udpBind("localhost", 0, 0));
  console.log(udpSendTo(a, data, 0, 3, short, 0, 0));
  console.log(udpSendTo(a, data, 0, 3, toB, 65536, 0));
  console.log(udpSendTo(a, data, 0, 3, toB, 0, 4));
  console.log(udpRecvFrom(b, buf, 0, 8, short, meta));
  console.log(udpRecvFrom(b, buf, 0, 8, from, one));
  console.log(udpBind("127.0.0.1", netLocalPort(b), 0));
  console.log(tcpAccept(b, from));

  const shared = udpBind("127.0.0.1", 0, 1);
  const again = udpBind("127.0.0.1", netLocalPort(shared), 1);
  console.log(shared >= 0 && again >= 0);

  const both = udpBind("::", 0, 0);
  console.log(send(both, data, toB));
  console.log(receive(b, buf, 0, 8, from, meta));
  console.log(netClose(a) + netClose(b) + netClose(shared) + netClose(again) + netClose(both));
  console.log(udpRecvFrom(a, buf, 0, 8, from, meta));
  return 0;
};
