// The two halves of `net_quic_lifecycle_replay` (see `main.ts`): the live
// server `record.sh` records, one scenario at a time, and the replay
// `npm test` runs over every recorded scenario, in both number modes.
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
import { fromHex, toHex } from "../crypto_x509/hex";
import { millisSince } from "../net_quic_conn_replay/replay";
import { LcServed, LcServer } from "./server";
import { idleTranscript } from "./recording-idle";
import { keysTranscript } from "./recording-keys";
import { resetTranscript } from "./recording-reset";
import { retryTranscript } from "./recording-retry";
import { versionTranscript } from "./recording-version";

/** The token the loop reports the server's socket under, and the client's. */
const LC_SERVER: i32 = 1;
const LC_CLIENT: i32 = 2;
/** How long any wait lasts before it is a failure, in milliseconds. */
const LC_WAIT: i32 = 5000;

/** The first `n` bytes of `buf`, as a datagram of its own. */
const lcHead = (buf: u8[], n: i32): u8[] => {
  const size: i32 = n > 0 ? n : toI32(0);
  const out: u8[] = new Array<u8>(size);
  for (let k: i32 = 0; k < n && k < toI32(buf.length) && k < toI32(out.length); k++) {
    out[k] = buf[k];
  }
  return out;
};

/**
 * Waits up to `timeout` milliseconds for the socket under `token` to be
 * readable. Answers 1 when it is, 0 on a timeout, and -1 when the loop fails.
 */
const lcWaitFor = (loop: i32, token: i32, timeout: i32): i32 => {
  const ready: i32[] = new Array<i32>(8);
  for (let tries: i32 = 0; tries < 4; tries++) {
    const n: i32 = pollWait(loop, ready, timeout);
    if (n < 0) {
      return -1;
    }
    if (n === 0) {
      return 0;
    }
    for (let k: i32 = 0; k < n && 2 * k + 1 < toI32(ready.length); k++) {
      if (ready[2 * k] === token && (ready[2 * k + 1] & 1) !== 0) {
        return 1;
      }
    }
  }
  return 0;
};

/** Prints what the server did and sends its datagrams to `to`. */
const lcPrint = (fd: i32, served: LcServed, to: u8[]): void => {
  for (const line of served.lines) {
    console.log(line);
  }
  for (const out of served.out) {
    console.log(`s ${toHex(out)}`);
    udpSendTo(fd, out, 0, toI32(out.length), to, 0, 0);
  }
};

/** The live server for `record.sh`: runs `scenario` on `port` until it is over, printing the transcript. */
export const lcLive = (port: i32, scenario: string): i32 => {
  const fd: i32 = udpBind("127.0.0.1", port, 0);
  if (fd < 0) {
    console.log(`udpBind ${fd}`);
    return 1;
  }
  const loop: i32 = pollCreate();
  pollAdd(loop, fd, 1, LC_SERVER);
  const server = new LcServer(scenario);
  const buf: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = new Array<i32>(2);
  const start: i64 = monotonicNanos();
  while (true) {
    const deadline: i64 = server.deadline();
    let wait: i32 = LC_WAIT;
    if (deadline >= 0) {
      const left: i64 = deadline - millisSince(start);
      wait = left < toI64(0) ? 0 : left > toI64(LC_WAIT) ? LC_WAIT : toI32(left) + 1;
    }
    const ready: i32 = lcWaitFor(loop, LC_SERVER, wait);
    const now: i64 = millisSince(start);
    if (ready < 0) {
      console.log("x poll failed");
      return 1;
    }
    let served = new LcServed();
    if (ready === 0) {
      if (deadline < 0 || now < deadline) {
        console.log("x quiet");
        return 1;
      }
      console.log(`t ${now}`);
      served = server.timer(now);
    } else {
      const n: i32 = udpRecvFrom(fd, buf, 0, toI32(buf.length), from, meta);
      if (n <= 0) {
        continue;
      }
      const datagram: u8[] = lcHead(buf, n);
      console.log(`c ${now} ${toHex(from)} ${toHex(datagram)}`);
      served = server.datagram(datagram, from, now);
    }
    lcPrint(fd, served, from);
    if (served.done) {
      return 0;
    }
  }
};

/** The two sockets and the loop a replay runs over. */
class LcSockets {
  server: i32 = -1;
  client: i32 = -1;
  loop: i32 = -1;
  serverAddr: u8[];
  buf: u8[];
  from: u8[];
  meta: i32[];

  constructor() {
    this.serverAddr = new Array<u8>(18);
    this.buf = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = new Array<i32>(2);
  }
}

/**
 * Replays one recorded scenario: each client datagram is sent from the
 * client socket, handed to a fresh server at its recorded time and with its
 * recorded address (which a Retry token is bound to), and every line the
 * server prints and every datagram it sends must be the recorded one.
 */
const lcReplayOne = (t: Suite, sockets: LcSockets, scenario: string, transcript: string[]): void => {
  const server = new LcServer(scenario);
  let expected: string[] = [];
  let at: i32 = 0;
  let sent: i32 = 0;
  let answered: i32 = 0;
  let done: boolean = false;
  for (const line of transcript) {
    const kind: string = line.substring(0, 1);
    const rest: string = line.substring(2);
    if (kind === "c" || kind === "t") {
      if (!t.ok(`${scenario}: everything the server did before is accounted for`, at === toI32(expected.length))) {
        return;
      }
      let served = new LcServed();
      if (kind === "t") {
        served = server.timer(toI64(parseInt(rest)));
      } else {
        const first: i32 = toI32(rest.indexOf(" "));
        const now: i64 = toI64(parseInt(rest.substring(0, first)));
        const fields: string = rest.substring(first + 1);
        const second: i32 = toI32(fields.indexOf(" "));
        const address: u8[] = fromHex(fields.substring(0, second));
        const datagram: u8[] = fromHex(fields.substring(second + 1));
        udpSendTo(sockets.client, datagram, 0, toI32(datagram.length), sockets.serverAddr, 0, 0);
        sent++;
        if (!t.ok(`${scenario}: client datagram ${sent} reaches the server`, lcWaitFor(sockets.loop, LC_SERVER, LC_WAIT) === 1)) {
          return;
        }
        const n: i32 = udpRecvFrom(sockets.server, sockets.buf, 0, toI32(sockets.buf.length), sockets.from, sockets.meta);
        served = server.datagram(lcHead(sockets.buf, n), address, now);
        for (const out of served.out) {
          udpSendTo(sockets.server, out, 0, toI32(out.length), sockets.from, 0, 0);
        }
      }
      expected = served.lines;
      at = 0;
      done = served.done;
    } else if (kind === "s") {
      answered++;
      if (!t.ok(`${scenario}: server datagram ${answered} reaches the client`, lcWaitFor(sockets.loop, LC_CLIENT, LC_WAIT) === 1)) {
        return;
      }
      const n: i32 = udpRecvFrom(sockets.client, sockets.buf, 0, toI32(sockets.buf.length), sockets.from, sockets.meta);
      t.eqStr(`${scenario}: server datagram ${answered} is the recorded one, byte for byte`, toHex(lcHead(sockets.buf, n)), rest);
    } else {
      const got: string = at >= 0 && at < toI32(expected.length) ? expected[at] : "(nothing)";
      at++;
      t.eqStr(`${scenario}: the server prints ${line}`, got, line);
    }
  }
  t.ok(`${scenario}: and the scenario ends where the recording does`, done && at === toI32(expected.length));
};

/** The replay of every scenario. */
export const lcReplay = (): i32 => {
  const t = new Suite("quic lifecycle replay against aioquic");
  const sockets = new LcSockets();
  sockets.server = udpBind("127.0.0.1", 0, 0);
  sockets.client = udpBind("127.0.0.1", 0, 0);
  if (!t.ok("both sockets bind", sockets.server >= 0 && sockets.client >= 0)) {
    return t.done();
  }
  sockets.loop = pollCreate();
  pollAdd(sockets.loop, sockets.server, 1, LC_SERVER);
  pollAdd(sockets.loop, sockets.client, 1, LC_CLIENT);
  netAddress(sockets.serverAddr, "127.0.0.1", netLocalPort(sockets.server));
  lcReplayOne(t, sockets, "version", versionTranscript());
  lcReplayOne(t, sockets, "retry", retryTranscript());
  lcReplayOne(t, sockets, "keys", keysTranscript());
  lcReplayOne(t, sockets, "idle", idleTranscript());
  lcReplayOne(t, sockets, "reset", resetTranscript());
  netClose(sockets.server);
  netClose(sockets.client);
  return t.done();
};
