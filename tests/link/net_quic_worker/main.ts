// The worker index in QUIC connection IDs, sans-IO (docs/h3-multicore.md §7,
// rows 2, 3, 13 and 15). With no arguments this program is the driver; it runs
// itself again (`panic <what> <case>`) for each configuration that must panic.
//
//   1. (row 2) a server whose configuration names worker k of a steered group
//      writes k into byte 0 of its first connection ID, of every
//      NEW_CONNECTION_ID, and of a Retry's source connection ID; unset, the IDs
//      are the entropy's bytes;
//   2. (row 3) a listener for worker 0 of 2 drops a short-header packet whose
//      byte 0 names worker 1 and resets one whose byte 0 is its own or no
//      worker's; unset, it resets them all;
//   3. (row 13) `QuicListener` and `Http3Server` panic, naming the pair, on a
//      worker index and count outside 0 <= k < n <= 255, each in a child of
//      its own, and take the unset pair and the edges;
//   4. (row 15) `preforkUdpListener` and `preforkUdpCount` read only the
//      supervisor's well-formed `<fd>,<N>`, and `preforkArgs` strips the flag.
import { readFileSyncOrNull } from "nish:fs";
import { spawnSyncTo } from "nish:process";
import { Suite } from "nish/testing";
import { QuicHeader, quicParseHeader } from "nish/net/quic-packet";
import {
  QUIC_LISTEN_DROP,
  QUIC_LISTEN_RETRY,
  QUIC_LISTEN_STATELESS_RESET,
  QuicListener,
  QuicListenerAnswer,
} from "nish/net/quic-listener";
import { QuicConnection, QuicServerConfig } from "nish/net/quic";
import { Http3Config } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { preforkArgs, preforkUdpCount, preforkUdpListener } from "nish/net/prefork";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QcClient, qcCrypto, qcHello, qcInitial, qcParams } from "../net_quic_conn/client";
import { qcConnected, qcServer } from "../net_quic_conn/common";
import { LcIssuedId, lcClientAddress, lcConfig, lcIssuedIds, lcListenerEntropy, lcShortTo } from "../net_quic_lifecycle/common";

/** The default configuration, with or without Retry, naming worker `k` of `n`. */
const workerConfig = (retry: boolean, k: i32, n: i32): QuicServerConfig => {
  const config: QuicServerConfig = lcConfig(retry);
  config.workerIndex = k;
  config.workerCount = n;
  return config;
};

/** The first connection ID the server picked, and those its NEW_CONNECTION_ID frames issued, under `config`. */
const issuedUnder = (config: QuicServerConfig): u8[][] => {
  const c: QcClient = qcConnected(qcServer(config), n64(65536));
  const out: u8[][] = [c.serverScid];
  const issued: LcIssuedId[] = lcIssuedIds(c.appPayloads);
  for (const id of issued) {
    out.push(id.cid);
  }
  return out;
};

/** Whether every ID in `ids` starts with `k`. */
const allStartWith = (ids: u8[][], k: i32): boolean => {
  for (const id of ids) {
    if (toI32(id.length) === 0 || toI32(id[0]) !== k) {
      return false;
    }
  }
  return true;
};

/** Whether `a` and `b` hold the same IDs from byte 1 on. */
const sameTails = (a: u8[][], b: u8[][]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i].length !== b[i].length) {
      return false;
    }
    for (let j: i32 = 1; j < toI32(a[i].length); j++) {
      if (a[i][j] !== b[i][j]) {
        return false;
      }
    }
  }
  return true;
};

/** The source connection ID of the Retry a listener under `config` answers a first Initial with, or empty. */
const retryScidUnder = (config: QuicServerConfig): u8[] => {
  const listener = new QuicListener(config, lcListenerEntropy());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  const answer: QuicListenerAnswer = listener.handle(qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), lcClientAddress(), n64(0));
  if (answer.kind !== QUIC_LISTEN_RETRY) {
    return [];
  }
  const retry: QuicHeader = quicParseHeader(answer.reply, n32(0), n32(8));
  return retry.scid;
};

/** Row 2: the worker byte in every ID the server issues. */
const idChecks = (t: Suite): void => {
  const marked: u8[][] = issuedUnder(workerConfig(false, 3, 8));
  t.eqI32("a server names its first ID and three more in NEW_CONNECTION_ID", toI32(marked.length), 4);
  t.ok("worker 3 of 8 writes 3 into byte 0 of each", allStartWith(marked, 3));
  const plain: u8[][] = issuedUnder(workerConfig(false, -1, 0));
  t.ok("unset, byte 0 is the entropy's (0x80 for the first ID)", toI32(plain[0][0]) === 0x80);
  t.ok("and the other bytes are the same either way", sameTails(marked, plain));
  const last: u8[][] = issuedUnder(workerConfig(false, 254, 255));
  t.ok("worker 254 of 255 writes 254", allStartWith(last, 254));

  const retryScid: u8[] = retryScidUnder(workerConfig(true, 5, 6));
  t.eqI32("a Retry's source connection ID is 8 bytes", toI32(retryScid.length), 8);
  t.eqI32("and worker 5 of 6 writes 5 into its byte 0", toI32(retryScid[0]), 5);
  const plainRetry: u8[] = retryScidUnder(workerConfig(true, -1, 0));
  t.ok("unset, the Retry's byte 0 is the listener's random byte", toI32(plainRetry.length) === 8 && toI32(plainRetry[0]) !== 5);
};

/** What a listener under `config` does with a 100-byte short-header packet whose DCID starts with `first`. */
const shortKind = (listener: QuicListener, first: i32): i32 => {
  const dcid: u8[] = fromHex("00d1d2d3d4d5d6d7");
  dcid[0] = toU8(first);
  return listener.handle(lcShortTo(dcid, n32(100)), lcClientAddress(), n64(0)).kind;
};

/** Row 3: the no-reset rule. */
const resetChecks = (t: Suite): void => {
  const steered = new QuicListener(workerConfig(false, 0, 2), lcListenerEntropy());
  t.eqI32("worker 0 of 2 drops a short packet for worker 1's ID, with no reset", shortKind(steered, 1), QUIC_LISTEN_DROP);
  t.eqI32("and resets one for its own ID", shortKind(steered, 0), QUIC_LISTEN_STATELESS_RESET);
  t.eqI32("and one whose byte 0 is no worker's (2)", shortKind(steered, 2), QUIC_LISTEN_STATELESS_RESET);
  t.eqI32("or 255", shortKind(steered, 255), QUIC_LISTEN_STATELESS_RESET);
  const plain = new QuicListener(workerConfig(false, -1, 0), lcListenerEntropy());
  t.eqI32("unset, a listener resets the packet worker 0 of 2 dropped", shortKind(plain, 1), QUIC_LISTEN_STATELESS_RESET);
};

/** The worker pair a panic case names. */
const caseIndex = (name: string): i32 => {
  if (name === "past") {
    return 2;
  }
  if (name === "below") {
    return -2;
  }
  return 0;
};

/** The worker count a panic case names. */
const caseCount = (name: string): i32 => {
  if (name === "past" || name === "below") {
    return 2;
  }
  return name === "wide" ? 256 : 0;
};

/** A child that builds `what` under case `name`'s pair: each case panics, so it never returns. */
const child = (what: string, name: string): i32 => {
  const config: QuicServerConfig = workerConfig(false, caseIndex(name), caseCount(name));
  if (what === "listener") {
    const listener = new QuicListener(config, lcListenerEntropy());
    console.log(`${shortKind(listener, 1)}`);
  } else {
    const server = new Http3Server(config, new Http3Config(), -1, n32(1), lcListenerEntropy());
    console.log(`${server.size()}`);
  }
  return 0;
};

/** A child that builds `what` under `name`'s pair exits 1 and names the pair on stderr. */
const panics = (t: Suite, what: string, name: string): void => {
  const err: string = `build/net-quic-worker-${what}-${name}.err`;
  const rc: i32 = spawnSyncTo([process.argv[0], "panic", what, name], "", err);
  const text: string | null = readFileSyncOrNull(err);
  const k: i32 = caseIndex(name);
  const n: i32 = caseCount(name);
  t.eqI32(`${what}, workerIndex ${k} and workerCount ${n}: the child exits 1`, rc, 1);
  t.contains(
    "and says why",
    text === null ? "" : text,
    `nish/net/quic: workerIndex ${k} and workerCount ${n}, not 0 <= k < n <= 255`
  );
};

/** Whether a listener and a server take the pair `k`, `n`: both build, and the listener resets a packet for its own ID. */
const takes = (k: i32, n: i32): boolean => {
  const config: QuicServerConfig = workerConfig(false, k, n);
  const listener = new QuicListener(config, lcListenerEntropy());
  const server = new Http3Server(config, new Http3Config(), -1, n32(1), lcListenerEntropy());
  return shortKind(listener, k < 0 ? 0 : k) === QUIC_LISTEN_STATELESS_RESET && server.size() === 1;
};

/** Row 13: the configuration's worker pair is checked when the listener or server is built. */
const panicChecks = (t: Suite): void => {
  const whats: string[] = ["listener", "server"];
  const names: string[] = ["past", "zero", "below", "wide"];
  for (const what of whats) {
    for (const name of names) {
      panics(t, what, name);
    }
  }
  t.ok("the unset pair, -1 and 0, builds", takes(-1, 0));
  t.ok("as do 0 of 1 and 254 of 255", takes(0, 1) && takes(254, 255));
};

/** A worker's argv with `udp` as the UDP flag's value, after the listener and channels flags. */
const argvWith = (udp: string): string[] => [
  "app",
  "serve",
  `--nish-prefork-udp=${udp}`,
  "--nish-prefork-listener=4",
  "--nish-prefork-channels=6,7",
  "--nish-prefork-worker=1",
];

/** Row 15: the UDP flag's parser. */
const flagChecks = (t: Suite): void => {
  t.eqI32("a worker reads the UDP socket from `<fd>,<N>`", preforkUdpListener(argvWith("5,2")), 5);
  t.eqI32("and the group's size", preforkUdpCount(argvWith("5,2")), 2);
  t.eqI32("and finds the flag right before the worker flag", preforkUdpListener(["app", "--nish-prefork-udp=9,3", "--nish-prefork-worker=0"]), 9);
  const kept: string[] = preforkArgs(argvWith("5,2"));
  t.ok("preforkArgs strips it with the other flags", toI32(kept.length) === 2 && kept[1] === "serve");
  t.eqI32("a process with no worker flag has no UDP socket", preforkUdpListener(["app", "--nish-prefork-udp=5,2"]), -1);
  t.eqI32("and no group", preforkUdpCount(["app", "--nish-prefork-udp=5,2"]), 0);
  t.eqI32("a worker without the flag has none", preforkUdpListener(["app", "--nish-prefork-worker=1"]), -1);
  const bad: string[] = ["5,", ",2", "5", "5,0", "5,256", "-1,2", "5,2,1", "5,x", ""];
  for (const value of bad) {
    t.eqI32(`"${value}" is refused: no socket`, preforkUdpListener(argvWith(value)), -1);
    t.eqI32("and no group", preforkUdpCount(argvWith(value)), 0);
  }
};

export const main = (): i32 => {
  if (process.argv.length > 3 && process.argv[1] === "panic") {
    return child(process.argv[2], process.argv[3]);
  }
  const t = new Suite("quic worker");
  idChecks(t);
  resetChecks(t);
  panicChecks(t);
  flagChecks(t);
  return t.done();
};
