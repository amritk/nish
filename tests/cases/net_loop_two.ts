// WP34 N5: a program that owns its loop. It watches two UDP sockets and its
// signal descriptor in one readiness loop, and prints the sockets' ports. The
// `net_` block of tests/run.js reads them and writes a datagram to one socket,
// waits for the line naming the one that woke, then writes to the other: b
// then a, then a then b. Then it sends SIGTERM, which wakes the loop through
// `signalFd()`, and the program reads 15 and exits 0. The arena must be where
// it was at the top of every pass: the loop body builds a string each wake,
// and its pass scope gives it back. No `.out`: on its own it would wait
// forever.
import {
  netClose,
  netLocalPort,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  udpBind,
  udpRecvFrom,
} from "nish:net";
import { readSignal, signalFd } from "nish:process";

const A: i32 = 1;
const B: i32 = 2;
const SIGNAL: i32 = 3;
const READABLE: i32 = 1;
const WOULD_BLOCK: i32 = -11;

/** Take every datagram waiting on `fd`; answers the bytes, or the failure. */
const drain = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i32 => {
  let bytes = 0;
  while (true) {
    const n = udpRecvFrom(fd, buf, 0, buf.length, from, meta);
    if (n === WOULD_BLOCK) {
      return bytes;
    }
    if (n < 0) {
      return n;
    }
    bytes = bytes + n;
  }
};

export const main = (): number => {
  const a = udpBind("127.0.0.1", 0, 0);
  const b = udpBind("127.0.0.1", 0, 0);
  const signals = signalFd();
  const loop = pollCreate();
  if (a < 0 || b < 0 || signals < 0 || loop < 0) {
    console.log(`setup ${a} ${b} ${signals} ${loop}`);
    return 1;
  }
  // a is added watching nothing, and `pollModify` makes it readable.
  const added = [
    pollAdd(loop, a, 0, A),
    pollModify(loop, a, READABLE, A),
    pollAdd(loop, b, READABLE, B),
    pollAdd(loop, signals, READABLE, SIGNAL),
  ];
  for (const r of added) {
    if (r !== 0) {
      console.log(`watch ${r}`);
      return 1;
    }
  }
  console.log(`ports ${netLocalPort(a)} ${netLocalPort(b)}`);

  const ready: i32[] = [0, 0, 0, 0, 0, 0];
  const buf: u8[] = new Array<u8>(64);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  const top = Arena.used();
  let flat = true;
  let signal = 0;
  while (signal === 0) {
    if (Arena.used() !== top) {
      flat = false;
    }
    // 0 is a signal that interrupted the wait; the next wait finds it ready.
    const n = pollWait(loop, ready, -1);
    if (n < 0) {
      console.log(`pollWait ${n}`);
      return 1;
    }
    for (let k = 0; k < n; k++) {
      const token = ready[2 * k];
      if (token === SIGNAL) {
        signal = readSignal(signals);
      } else {
        const name = token === A ? "a" : "b";
        const bytes = drain(token === A ? a : b, buf, from, meta);
        console.log(`woke ${name}: ${bytes} bytes, events ${ready[2 * k + 1]}`);
      }
    }
  }
  console.log(`signal ${signal}`);
  console.log(flat ? "flat" : "the arena moved");
  pollRemove(loop, a);
  pollRemove(loop, b);
  netClose(a);
  netClose(b);
  return netClose(loop);
};
