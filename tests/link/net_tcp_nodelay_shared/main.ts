// Flags 1 and 2 together (`listener.ts`): two listeners share one loopback
// port, a client connects, whichever listener the kernel picks accepts, and a
// request and its echo cross the accepted socket whole. Flag 2 changes when a
// small write is sent, never what arrives, so the bytes come back as written.
// `tests/cases/net_tcp_nodelay` reads the option itself back. Every wait is
// bounded: two seconds without a wake is a failure.
import { netAddress, netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpAccept, tcpConnect } from "nish:net";
import { quickListener } from "./listener";

/** Waits up to two seconds for `fd` to be ready for `events`; whether it is. */
const ready = (fd: i32, events: i32): boolean => {
  const loop = pollCreate();
  pollAdd(loop, fd, events, 0);
  const out: i32[] = new Array<i32>(2);
  const n = pollWait(loop, out, 2000);
  netClose(loop);
  return n === 1;
};

/** Reads exactly `buf.length` bytes from `fd`, waiting as needed; whether they all came. */
const readAll = (fd: i32, buf: u8[]): boolean => {
  let got: i32 = 0;
  let open = true;
  while (got < buf.length && open) {
    const n = netRead(fd, buf, got, buf.length - got);
    if (n > 0) {
      got = got + n;
    } else {
      open = n === -11 && ready(fd, 1);
    }
  }
  return got === buf.length;
};

export function main(): number {
  const a = quickListener(0, 4);
  const port = netLocalPort(a);
  const b = quickListener(port, 4);
  const loop = pollCreate();
  pollAdd(loop, a, 1, 0);
  pollAdd(loop, b, 1, 1);

  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  const client = tcpConnect(addr);
  const events: i32[] = new Array<i32>(4);
  const peer: u8[] = new Array<u8>(18);
  const n = pollWait(loop, events, 2000);
  const conn = n > 0 ? tcpAccept(events[0] === 0 ? a : b, peer) : -110;

  const request: u8[] = [112, 105, 110, 103];
  const sent = ready(client, 2) ? netWrite(client, request, 0, request.length) : -110;
  const heard: u8[] = new Array<u8>(4);
  const served = conn >= 0 && readAll(conn, heard);
  const echoed = served ? netWrite(conn, heard, 0, heard.length) : -1;
  const back: u8[] = new Array<u8>(4);
  const answered = readAll(client, back);

  console.log(a >= 0 && b >= 0 && netLocalPort(b) === port);
  console.log(conn >= 0 && sent === 4 && served && echoed === 4);
  console.log(answered && back[0] === 112 && back[1] === 105 && back[2] === 110 && back[3] === 103);
  netClose(conn);
  netClose(client);
  netClose(loop);
  netClose(b);
  netClose(a);
  return 0;
}
