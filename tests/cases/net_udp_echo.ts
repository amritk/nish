// WP34 N5: a UDP echo in Nish. The `net_` block of tests/run.js runs it, reads
// the port it prints, and sends from Node's `dgram` in two rounds, one
// datagram and then two hundred, each once the one before it has come back;
// an empty datagram ends a round. The arena must move as far serving the
// second round as serving the first: `serve` answers a pointer, so it has no
// function scope, and what gives back the string each pass builds is the pass
// scope of its loop. No `.out`: on its own it would wait forever.
import { netClose, netLocalPort, udpBind, udpRecvFrom, udpSendTo } from "nish:net";

const WOULD_BLOCK: i32 = -11;

class Served {
  datagrams: i32;
  bytes: i32;
  notes: i32;

  constructor(datagrams: i32, bytes: i32, notes: i32) {
    this.datagrams = datagrams;
    this.bytes = bytes;
    this.notes = notes;
  }
}

/** Echo every datagram to its sender until an empty one; -1 bytes if a call failed. */
const serve = (fd: i32, buf: u8[], from: u8[], meta: i32[]): Served => {
  let datagrams = 0;
  let bytes = 0;
  let notes = 0;
  let failed = false;
  while (true) {
    const n = udpRecvFrom(fd, buf, 0, buf.length, from, meta);
    if (n === WOULD_BLOCK) {
      continue;
    }
    if (n === 0) {
      break;
    }
    if (n < 0 || udpSendTo(fd, buf, 0, n, from, 0, 0) !== n) {
      failed = true;
      break;
    }
    // A string every pass, which only the pass scope gives back.
    const note = `${bytes} + ${n}`;
    notes = notes + note.length;
    datagrams = datagrams + 1;
    bytes = bytes + n;
  }
  return new Served(datagrams, failed ? -1 : bytes, notes);
};

/** Serve one round; answers how far serving it moved the arena. */
const oneRound = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i64 => {
  const before = Arena.used();
  const served = serve(fd, buf, from, meta);
  const grown = Arena.used() - before;
  console.log(`echoed ${served.datagrams} datagrams, ${served.bytes} bytes`);
  return grown;
};

export const main = (): number => {
  const fd = udpBind("127.0.0.1", 0, 0);
  if (fd < 0) {
    console.log(`udpBind ${fd}`);
    return 1;
  }
  console.log(`port ${netLocalPort(fd)}`);
  const buf: u8[] = new Array<u8>(2048);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  const one = oneRound(fd, buf, from, meta);
  const many = oneRound(fd, buf, from, meta);
  console.log(one === many ? "flat" : `grows: ${one} then ${many}`);
  return netClose(fd);
};
