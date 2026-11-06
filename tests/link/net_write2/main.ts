// `netWrite2` over a loopback TCP connection: two buffers leave in one system
// call and arrive as one stream, the first range's bytes before the second's.
// Then a write too large for a small send buffer the peer never drains: the
// kernel takes part of it, and the answer is that count, not an error. The
// next write into the full buffer answers -11 (EAGAIN). Every wait is
// bounded: two seconds without a wake is a failure.
import { NET_SO_SNDBUF, netAddress, netClose, netLocalPort, netSetOption, netWrite2, tcpAccept, tcpConnect, tcpListen } from "nish:net";
import { readAll, ready } from "./wait";

export function main(): number {
  const listener = tcpListen("127.0.0.1", 0, 4);
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", netLocalPort(listener));
  const client = tcpConnect(addr);
  const peer: u8[] = new Array<u8>(18);
  const conn = ready(listener, 1) ? tcpAccept(listener, peer) : -110;

  // Two ranges, each an inner slice of its buffer: "head" from `a`, "body" from `b`.
  const a: u8[] = [120, 104, 101, 97, 100, 120];
  const b: u8[] = [121, 121, 98, 111, 100, 121];
  const sent = ready(client, 2) ? netWrite2(client, a, 1, 4, b, 2, 3) : -110;
  const heard: u8[] = new Array<u8>(7);
  const arrived = conn >= 0 && readAll(conn, heard);
  let inOrder = arrived;
  const want: u8[] = [104, 101, 97, 100, 98, 111, 100];
  let i: i32 = 0;
  for (const w of want) {
    inOrder = inOrder && heard[i] === w;
    i = i + 1;
  }
  console.log(conn >= 0 && sent === 7);
  console.log(inOrder);

  // An empty first range is allowed: the second alone is sent.
  const solo = netWrite2(client, a, 6, 0, b, 0, 1);
  const one: u8[] = new Array<u8>(1);
  console.log(solo === 1 && readAll(conn, one) && one[0] === 121);

  // A partial write: 4 MiB in two halves into a small send buffer nobody reads.
  netSetOption(client, NET_SO_SNDBUF, 4096);
  const half: u8[] = new Array<u8>(2097152);
  const took = netWrite2(client, half, 0, half.length, half, 0, half.length);
  console.log(took > 0 && took < 2 * half.length);
  let full = took;
  while (full > 0) {
    full = netWrite2(client, half, 0, half.length, half, 0, half.length);
  }
  console.log(full === -11);

  netClose(conn);
  netClose(client);
  netClose(listener);
  return 0;
}
