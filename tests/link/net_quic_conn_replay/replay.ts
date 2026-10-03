// The two halves of `net_quic_conn_replay` (see `main.ts`): the live server
// `record.sh` records, and the replay `npm test` runs, in both number modes.
import { Suite } from "nish/testing";
import {
  netAddress,
  netClose,
  netLocalPort,
  pollAdd,
  pollCreate,
  pollWait,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net";
import { QUIC_STATE_DRAINING, QuicConnection } from "nish/net/quic";
import { fromHex, toHex } from "../crypto_x509/hex";
import { Served, newEchoConnection, serveDatagram } from "./server";
import { transcript } from "./recording";

/** The token the loop reports the server's socket under, and the client's. */
const SERVER: i32 = 1;
const CLIENT: i32 = 2;

/** The first `n` bytes of `buf`, as a datagram of its own. */
const head = (buf: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let k: i32 = 0; k < n && k < toI32(buf.length) && k < toI32(out.length); k++) {
    out[k] = buf[k];
  }
  return out;
};

/** Waits up to five seconds for the socket under `token` to be readable. */
const waitFor = (loop: i32, token: i32): boolean => {
  const ready: i32[] = new Array<i32>(8);
  for (let tries: i32 = 0; tries < 4; tries++) {
    const n: i32 = pollWait(loop, ready, 5000);
    if (n <= 0) {
      return false;
    }
    for (let k: i32 = 0; k < n && 2 * k + 1 < toI32(ready.length); k++) {
      if (ready[2 * k] === token && (ready[2 * k + 1] & 1) !== 0) {
        return true;
      }
    }
  }
  return false;
};

/** Milliseconds since `start`, a `monotonicNanos` reading: the live server's clock. */
export const millisSince = (start: i64): i64 => (monotonicNanos() - start) / toI64(1000000);

/** The live server for `record.sh`: serves one connection on `port`, printing the transcript. */
export const live = (port: i32): i32 => {
  const fd: i32 = udpBind("127.0.0.1", port, 0);
  if (fd < 0) {
    console.log(`udpBind ${fd}`);
    return 1;
  }
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, 1, SERVER);
  const conn: QuicConnection = newEchoConnection();
  const buf: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const start: i64 = monotonicNanos();
  while (waitFor(loop, SERVER)) {
    const n: i32 = udpRecvFrom(fd, buf, 0, toI32(buf.length), from, meta);
    if (n <= 0) {
      continue;
    }
    const datagram: u8[] = head(buf, n);
    const now: i64 = millisSince(start);
    console.log(`c ${now} ${toHex(datagram)}`);
    const served: Served = serveDatagram(conn, datagram, now);
    for (const line of served.echoed) {
      console.log(`e ${line}`);
    }
    for (const out of served.out) {
      console.log(`s ${toHex(out)}`);
      udpSendTo(fd, out, 0, toI32(out.length), from, 0, 0);
    }
    if (conn.state === QUIC_STATE_DRAINING) {
      console.log(`x ${conn.error}`);
      return 0;
    }
  }
  console.log("x timeout");
  return 1;
};

/** The replay: the recorded client datagrams sent from a Nish socket, every answer checked. */
export const replay = (): i32 => {
  const t = new Suite("quic replay against aioquic");
  const server: i32 = udpBind("127.0.0.1", 0, 0);
  const client: i32 = udpBind("127.0.0.1", 0, 0);
  if (!t.ok("both sockets bind", server >= 0 && client >= 0)) {
    return t.done();
  }
  const loop: i32 = pollCreate();
  pollAdd(loop, server, 1, SERVER);
  pollAdd(loop, client, 1, CLIENT);
  const serverAddr: u8[] = new Array<u8>(18);
  netAddress(serverAddr, "127.0.0.1", netLocalPort(server));
  const conn: QuicConnection = newEchoConnection();
  const buf: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  let echoed: string[] = [];
  let echoAt: i32 = 0;
  let sent: i32 = 0;
  let answered: i32 = 0;
  for (const line of transcript()) {
    const kind: string = line.substring(0, 1);
    const rest: string = line.substring(2);
    if (kind === "c") {
      const space: i32 = toI32(rest.indexOf(" "));
      const now: i64 = toI64(parseInt(rest.substring(0, space)));
      const datagram: u8[] = fromHex(rest.substring(space + 1));
      udpSendTo(client, datagram, 0, toI32(datagram.length), serverAddr, 0, 0);
      sent++;
      if (!t.ok(`client datagram ${sent} reaches the server`, waitFor(loop, SERVER))) {
        return t.done();
      }
      const n: i32 = udpRecvFrom(server, buf, 0, toI32(buf.length), from, meta);
      const served: Served = serveDatagram(conn, head(buf, n), now);
      echoed = served.echoed;
      echoAt = 0;
      for (const out of served.out) {
        udpSendTo(server, out, 0, toI32(out.length), from, 0, 0);
      }
    } else if (kind === "s") {
      answered++;
      if (!t.ok(`server datagram ${answered} reaches the client`, waitFor(loop, CLIENT))) {
        return t.done();
      }
      const n: i32 = udpRecvFrom(client, buf, 0, toI32(buf.length), from, meta);
      t.eqStr(`server datagram ${answered} is the recorded one, byte for byte`, toHex(head(buf, n)), rest);
    } else if (kind === "e") {
      const got: string = echoAt >= 0 && echoAt < toI32(echoed.length) ? echoed[echoAt] : "(nothing)";
      echoAt++;
      t.eqStr(`the server echoes ${rest}`, got, rest);
    } else if (kind === "x") {
      t.ok(`the client closed the connection with error ${rest}`, conn.state === QUIC_STATE_DRAINING && `${conn.error}` === rest);
    }
  }
  t.ok("the handshake chose the echo's ALPN", conn.alpn === "nish-echo");
  netClose(server);
  netClose(client);
  return t.done();
};

