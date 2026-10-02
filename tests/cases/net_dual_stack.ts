// #355: the dual-stack half of `nish:net`, which only a host with IPv6 reaches.
// The `net_` block of tests/run.js runs it where `::1` is usable; a host without
// IPv6, where `"::"` falls back to IPv4, is reported there and not run. It
// listens on `"::"`, an IPv6 socket with `IPV6_V6ONLY` off, and Node connects
// twice, over 127.0.0.1 and then over ::1: the first peer must arrive in its
// mapped form and the second as ::1, each with Node's port in the last two bytes,
// and each is echoed. Then one UDP socket bound to `"::"` sends itself a
// datagram per ECN mark, to its IPv4 address and to its IPv6 one, so the mark
// leaves as `IP_TOS` and as `IPV6_TCLASS` and has to come back in `meta[1]` both
// ways. No `.out`: on its own it would wait for a connection forever.
import {
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  tcpAccept,
  tcpListen,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";

const WOULD_BLOCK: i32 = -11;

/** The host of an 18-byte address: a mapped IPv4 one's dotted quad, `::1`, or `other`. */
const hostOf = (a: u8[]): string => {
  for (let i = 0; i < 10; i++) {
    if (toI32(a[i]) !== 0) {
      return "other";
    }
  }
  if (toI32(a[10]) === 255 && toI32(a[11]) === 255) {
    return `${a[12]}.${a[13]}.${a[14]}.${a[15]}`;
  }
  const rest = toI32(a[10]) + toI32(a[11]) + toI32(a[12]) + toI32(a[13]) + toI32(a[14]);
  return rest === 0 && toI32(a[15]) === 1 ? "::1" : "other";
};

/** The port of an 18-byte address, which the form keeps big-endian. */
const portOf = (a: u8[]): i32 => toI32(a[16]) * 256 + toI32(a[17]);

/** Accept the next connection, name its peer, and echo it until it closes: the bytes, or the failure. */
const echoOne = (fd: i32, peer: u8[], buf: u8[]): i32 => {
  let conn = tcpAccept(fd, peer);
  while (conn === WOULD_BLOCK) {
    conn = tcpAccept(fd, peer);
  }
  if (conn < 0) {
    return conn;
  }
  console.log(`peer ${hostOf(peer)} port ${portOf(peer)}`);
  let bytes = 0;
  while (true) {
    const n = netRead(conn, buf, 0, buf.length);
    if (n === 0) {
      break;
    }
    if (n === WOULD_BLOCK) {
      continue;
    }
    if (n < 0) {
      netClose(conn);
      return n;
    }
    let sent = 0;
    while (sent < n) {
      const w = netWrite(conn, buf, sent, n - sent);
      if (w >= 0) {
        sent = sent + w;
      } else if (w !== WOULD_BLOCK) {
        netClose(conn);
        return w;
      }
    }
    bytes = bytes + n;
  }
  netClose(conn);
  return bytes;
};

export const main = (): number => {
  const fd = tcpListen("::", 0, 8);
  if (fd < 0) {
    console.log(`tcpListen ${fd}`);
    return 1;
  }
  console.log(`port ${netLocalPort(fd)}`);
  const peer: u8[] = new Array<u8>(18);
  const buf: u8[] = new Array<u8>(512);
  for (let i = 0; i < 2; i++) {
    console.log(`echoed ${echoOne(fd, peer, buf)} bytes`);
  }
  netClose(fd);

  const u = udpBind("::", 0, 0);
  const to: u8[] = new Array<u8>(18);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  for (const host of ["127.0.0.1", "::1"]) {
    netAddress(to, host, netLocalPort(u));
    for (const ecn of [1, 2, 3, 0]) {
      const sent = udpSendTo(u, buf, 0, 8, to, 0, ecn);
      if (sent !== 8) {
        // Darwin answers -95 for any mark, as docs/LANGUAGE.md says.
        console.log(`udp to ${host}, ecn ${ecn}: sent ${sent}`);
        continue;
      }
      let n = udpRecvFrom(u, buf, 0, buf.length, from, meta);
      while (n === WOULD_BLOCK) {
        n = udpRecvFrom(u, buf, 0, buf.length, from, meta);
      }
      console.log(`udp to ${host}, ecn ${ecn}: ${n} bytes from ${hostOf(from)}, ecn ${meta[1]}`);
    }
  }
  return netClose(u);
};
