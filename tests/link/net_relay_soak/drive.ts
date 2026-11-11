// The soak's clients: waves of `net_relay`'s loopback clients, each through
// a whole session — handshake, CONNECT, HELLO with a grant, a DATA up that
// the game server echoes down, and a CLOSE — against the relay in its own
// process. Everything a wave allocates is reclaimed when it returns (its
// parameters are all numbers, so its arena scope is automatic), which keeps
// this process small across 100,000 sessions; nothing here is measured.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollRemove, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { monotonicNanos } from "nish:process";
import { qcCrypto, qcFinishedPacket, qcInitial, qcReadFlight } from "../net_quic_conn/client";
import { n32, n64 } from "../net_quic_frame/typed";
import { RELAY_CLOSE, RELAY_DATA, RELAY_HELLO_OK, RELAY_PROTOCOL_VERSION } from "../../../examples/relay/frame";
import { RigClient, rigGrant, rigHello } from "../net_relay/rig";
import { rigData } from "../net_relay/loopback";

/** A client's stages. */
const SOAK_FLIGHT: i32 = 0;
const SOAK_OPENING: i32 = 5;
const SOAK_HELLO: i32 = 1;
const SOAK_DATA: i32 = 2;
const SOAK_CLOSE: i32 = 3;
const SOAK_DONE: i32 = 4;

/**
 * How long a wave may take, in milliseconds, before the sessions still open
 * count as unfinished. A wave takes tens of milliseconds; one that crosses a
 * relay checkpoint waits out the relay's `sh` for its resident set, which a
 * loaded runner can stretch past a second. Bounded by the clock, not by turns
 * of the loop: a turn costs microseconds when a socket is ready, and a turn
 * budget let a busy runner give up on a session the relay then closed.
 */
const SOAK_WAVE_MS: i64 = 20000;
/** How long a session waits for its HELLO_OK before it sends the HELLO again, in milliseconds. */
const SOAK_HELLO_AGAIN_MS: i64 = 1000;

/** Whether `c` has received a datagram of `type`. */
const has = (c: RigClient, type: i32): boolean => {
  for (const d of c.datagrams) {
    if (toI32(d.length) > 0 && toI32(d[0]) === type) {
      return true;
    }
  }
  return false;
};

/** Echoes every datagram waiting on the game server's socket `fd`. */
const echoAll = (fd: i32, rx: u8[], from: u8[], meta: i32[]): void => {
  let n: i32 = udpRecvFrom(fd, rx, n32(0), n32(65536), from, meta);
  while (n >= 0) {
    udpSendTo(fd, rx, n32(0), n, from, n32(0), n32(0));
    n = udpRecvFrom(fd, rx, n32(0), n32(65536), from, meta);
  }
};

/**
 * Sessions `first .. first + count` through the relay on `relayPort`, all at
 * once, upstream to the game server on `echoFd` (port `echoPort`). Answers
 * how many finished: HELLO_OK, their DATA echoed back, and their CLOSE
 * answered with the connection's close.
 */
export const wave = (relayPort: i32, echoFd: i32, echoPort: i32, first: i32, count: i32): i32 => {
  const clients: RigClient[] = [];
  const stages: i32[] = [];
  const marks: i32[] = [];
  const loop: i32 = pollCreate();
  const rx: u8[] = new Array<u8>(65536);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [n32(0), n32(0)];
  const ready: i32[] = new Array<i32>(256);
  pollAdd(loop, echoFd, 1, 0);
  for (let k: i32 = 0; k < count; k++) {
    const c = new RigClient(first + k, "127.0.0.1", relayPort);
    pollAdd(loop, c.fd, 1, k + 1);
    const hello: u8[] = c.hello();
    c.c.before = hello;
    marks.push(toI32(c.c.datagrams.length));
    c.transmit(qcInitial(c.c, qcCrypto(n64(0), hello), n32(1200)));
    clients.push(c);
    stages.push(SOAK_FLIGHT);
  }
  const grant: string = rigGrant("127.0.0.1", echoPort);
  const helloAt: i64[] = new Array<i64>(count);
  const deadline: i64 = monotonicNanos() / 1000000 + SOAK_WAVE_MS;
  let done: i32 = 0;
  let now: i64 = monotonicNanos() / 1000000;
  while (done < count && now < deadline) {
    pollWait(loop, ready, n32(5));
    now = monotonicNanos() / 1000000;
    echoAll(echoFd, rx, from, meta);
    for (let k: i32 = 0; k < count; k++) {
      const c: RigClient = clients[k];
      if (stages[k] === SOAK_DONE) {
        continue;
      }
      c.read();
      if (stages[k] === SOAK_FLIGHT) {
        if (qcReadFlight(c.c, marks[k], n32(0))) {
          c.transmit(qcFinishedPacket(c.c));
          c.connected = true;
          c.open("/cs");
          stages[k] = SOAK_OPENING;
        }
      } else if (stages[k] === SOAK_OPENING && c.status() === "200") {
        // A datagram that overtakes its session's 200 is dropped (WT-4), so the HELLO waits for it.
        c.send(rigHello(grant, RELAY_PROTOCOL_VERSION));
        helloAt[k] = now;
        stages[k] = SOAK_HELLO;
      } else if (stages[k] === SOAK_HELLO && has(c, RELAY_HELLO_OK)) {
        c.send(rigData(first + k, n32(64), n32(7)));
        stages[k] = SOAK_DATA;
      } else if (stages[k] === SOAK_DATA && has(c, RELAY_DATA)) {
        const bye: u8[] = [toU8(RELAY_CLOSE), toU8(0), toU8(0), toU8(0)];
        c.send(bye);
        stages[k] = SOAK_CLOSE;
      } else if (stages[k] === SOAK_CLOSE && c.closeCode >= 0) {
        // Out of the loop's set: the relay may still answer a late ACK, and a socket nobody reads stays ready,
        // so every wait of the wave would return at once.
        pollRemove(loop, c.fd);
        stages[k] = SOAK_DONE;
        done++;
      } else if (stages[k] === SOAK_HELLO && toI32(c.datagrams.length) === 0 && now - helloAt[k] >= SOAK_HELLO_AGAIN_MS) {
        // Datagrams are not sent again: a HELLO lost on the way is sent again.
        c.send(rigHello(grant, RELAY_PROTOCOL_VERSION));
        helloAt[k] = now;
      } else {
        c.ackIfNew();
      }
    }
  }
  for (const c of clients) {
    netClose(c.fd);
  }
  netClose(loop);
  return done;
};

/** A game server socket on the loopback, and its port: `[fd, port]`. */
export const echoSocket = (): i32[] => {
  const fd: i32 = udpBind("127.0.0.1", n32(0), n32(0));
  return [fd, netLocalPort(fd)];
};

/** The address of the relay on `port`, for a check that sends to it directly. */
export const relayAddress = (port: i32): u8[] => {
  const to: u8[] = new Array<u8>(18);
  netAddress(to, "127.0.0.1", port);
  return to;
};
