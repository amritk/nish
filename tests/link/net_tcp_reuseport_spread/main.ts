// Two listeners share one loopback port through `tcpListenFlags`' flag 1
// (`listener.ts`), 64 clients connect to it, and one `pollWait` loop accepts on
// both until every connection has been taken. On Linux the kernel hashes each
// new connection to one of the listeners, so both take some: the chance that
// 64 land on one is 2^-63. Darwin shares the port without spreading, so there
// only the total is checked. Every wait is bounded: two seconds without a wake
// is a failure.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollWait, tcpAccept, tcpConnect } from "nish:net";
import { platform } from "nish:process";
import { sharedListener } from "./listener";

const CLIENTS: i32 = 64;
const WOULD_BLOCK: i32 = -11;

export function main(): number {
  const a = sharedListener(0, CLIENTS);
  const port = netLocalPort(a);
  const b = sharedListener(port, CLIENTS);
  const loop = pollCreate();
  pollAdd(loop, a, 1, 0);
  pollAdd(loop, b, 1, 1);

  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", port);
  const clients: i32[] = [];
  for (let i: i32 = 0; i < CLIENTS; i++) {
    clients.push(tcpConnect(addr));
  }

  const peer: u8[] = new Array<u8>(18);
  const ready: i32[] = new Array<i32>(4);
  const taken: i32[] = [0, 0];
  const conns: i32[] = [];
  let quiet = false;
  while (conns.length < CLIENTS && !quiet) {
    const n = pollWait(loop, ready, 2000);
    quiet = n <= 0;
    for (let k: i32 = 0; k < n; k++) {
      const token = ready[k * 2];
      const fd = token === 0 ? a : b;
      let conn = tcpAccept(fd, peer);
      while (conn >= 0) {
        conns.push(conn);
        taken[token] = taken[token] + 1;
        conn = tcpAccept(fd, peer);
      }
      if (conn !== WOULD_BLOCK) {
        quiet = true;
      }
    }
  }

  console.log(a >= 0 && b >= 0 && netLocalPort(b) === port);
  console.log(conns.length === CLIENTS);
  console.log(platform !== "linux" || (taken[0] > 0 && taken[1] > 0));
  for (const fd of conns) {
    netClose(fd);
  }
  for (const fd of clients) {
    netClose(fd);
  }
  netClose(b);
  netClose(a);
  return 0;
}
