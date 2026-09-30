// WP34 N5: a TCP echo in Nish. The `net_` block of tests/run.js runs it, reads
// the port it prints, connects twice from Node and requires every byte back.
// The first connection sends one message and the second two hundred, and the
// arena must move as far serving the second as serving the first: `serve`
// answers a pointer, so it has no function scope, and what gives back the
// string each pass builds is the pass scope of its loop. No `.out`: on its
// own it would wait for a connection forever.
import { netClose, netLocalPort, netRead, netWrite, tcpAccept, tcpListen } from "nish:net";

const WOULD_BLOCK: i32 = -11;

class Served {
  bytes: i32;
  notes: i32;

  constructor(bytes: i32, notes: i32) {
    this.bytes = bytes;
    this.notes = notes;
  }
}

/** Every byte of `buf[0, n)` to the peer, waiting out a full send buffer. */
const sendAll = (fd: i32, buf: u8[], n: i32): boolean => {
  let sent = 0;
  while (sent < n) {
    const w = netWrite(fd, buf, sent, n - sent);
    if (w >= 0) {
      sent = sent + w;
    } else if (w !== WOULD_BLOCK) {
      return false;
    }
  }
  return true;
};

/** Echo until the peer closes; -1 bytes if a read or a write failed. */
const serve = (conn: i32, buf: u8[]): Served => {
  let bytes = 0;
  let notes = 0;
  let failed = false;
  while (true) {
    const n = netRead(conn, buf, 0, buf.length);
    if (n === 0) {
      break;
    }
    if (n === WOULD_BLOCK) {
      continue;
    }
    if (n < 0 || !sendAll(conn, buf, n)) {
      failed = true;
      break;
    }
    // A string every pass, which only the pass scope gives back.
    const note = `${bytes} + ${n}`;
    notes = notes + note.length;
    bytes = bytes + n;
  }
  return new Served(failed ? -1 : bytes, notes);
};

/** The next connection, waiting for one to arrive. */
const acceptOne = (fd: i32, peer: u8[]): i32 => {
  let conn = tcpAccept(fd, peer);
  while (conn === WOULD_BLOCK) {
    conn = tcpAccept(fd, peer);
  }
  return conn;
};

/** Serve one connection; answers how far serving it moved the arena. */
const oneConnection = (fd: i32, peer: u8[], buf: u8[]): i64 => {
  const conn = acceptOne(fd, peer);
  if (conn < 0) {
    console.log(`tcpAccept ${conn}`);
    return -1;
  }
  console.log(`peer ${peer[12]}.${peer[13]}.${peer[14]}.${peer[15]}`);
  const before = Arena.used();
  const served = serve(conn, buf);
  const grown = Arena.used() - before;
  console.log(`echoed ${served.bytes} bytes`);
  console.log(`closed ${netClose(conn)}`);
  return grown;
};

export const main = (): number => {
  const fd = tcpListen("127.0.0.1", 0, 8);
  if (fd < 0) {
    console.log(`tcpListen ${fd}`);
    return 1;
  }
  console.log(`port ${netLocalPort(fd)}`);
  const peer: u8[] = new Array<u8>(18);
  const buf: u8[] = new Array<u8>(512);
  const one = oneConnection(fd, peer, buf);
  const many = oneConnection(fd, peer, buf);
  console.log(one === many ? "flat" : `grows: ${one} then ${many}`);
  return netClose(fd);
};
