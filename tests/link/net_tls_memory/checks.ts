// What a TLS 1.3 handshake leaves in the arena once its state lives in the
// connection's slot (TLS-3 in docs/security/tls.md). Three runs of a
// thousand handshakes each, every one byte for byte the same as the first:
//
//   1. RFC 8448 §3 replayed through one `TlsRecordServer` and one
//      `TlsServer`, restarted for every connection: every ServerHello and
//      flight record is the trace's, and what each handshake leaves is
//      exactly the four AES-128 key schedules `aesKey` answers (its own
//      allocation, which `nish/crypto/aes` stores and nothing here can
//      scope), nothing of the handshake's own.
//   2. A production handshake — ChaCha20-Poly1305, the P-256 leaf — through
//      the same kind of slot, with a ClientHello padded past the server's
//      first input buffer so that the first handshake grows it: after that
//      first one, `Arena.mark()` does not move at all.
//   3. The same handshake over loopback through `TlsTcpServer`'s slot pool,
//      a Nish client on plain `nish:net` sending recorded bytes: accept,
//      handshake, close, a thousand times, and `Arena.mark()` does not move.
//
// The client's side of 2 and 3 is worked out once, by the record-layer
// tests' client, and replayed: with the randomness and the signature the
// same every time (RFC 6979 makes the P-256 signature deterministic), every
// handshake is the same bytes, so the loops compare every byte and allocate
// nothing of their own. The P-256 signature is the caller's and is made once,
// since `p256SignSha256` stores what it allocates as `aesKey` does.
//
// Then the refusals the slot's own entry points add: a restart with
// randomness of the wrong length, and the in-place key derivations asked for
// a suite or a length they do not know.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net";
import { aesKey } from "nish/crypto/aes";
import { HkdfScratch } from "nish/crypto/hkdf";
import { TLS_STATE_FAILED, TlsServer, TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import {
  TLS_ALERT_INTERNAL_ERROR,
  TLS_GROUP_X25519,
  TLS_LEGACY_VERSION,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_VERSION_13,
} from "nish/net/tls/codec";
import { TLS_CHACHA20_POLY1305_SHA256, tlsTrafficKeysInto } from "nish/net/tls/schedule";
import { TLS_CONTENT_ALERT, TLS_CONTENT_HANDSHAKE, TlsRecordProtection } from "nish/net/tls/record";
import {
  TLS_RECORD_DATA,
  TLS_RECORD_SIGN,
  TLS_RECORD_STATE_OPEN,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { rfc8448Config } from "../net_tls_rfc8448/checks";
import { rfc8448RsaPssSignature, rfc8448ServerPrivate, rfc8448ServerRandom } from "../net_tls_rfc8448/trace";
import {
  rfc8448ClientFinishedRecord,
  rfc8448ClientHelloRecord,
  rfc8448ServerFlightRecord,
  rfc8448ServerHelloRecord,
} from "../net_tls_record_rfc8448/records";
import { leafPrivate, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import {
  GROUP_SECP256R1,
  clientHelloRaw,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  extension,
} from "../net_tls_common/client";
import { Opened, ZERO, drain, feed, filled, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor, splitRecords } from "../net_tls_record_common/client";

/** How many handshakes each run makes. */
const ROUNDS: i32 = 1000;

/** Copies `from` into `to`, element by element: how each run refills the key the server wipes. */
const refill = (to: u8[], from: u8[]): void => {
  for (let k: i32 = 0; k < toI32(to.length) && k < toI32(from.length); k++) {
    to[k] = from[k];
  }
};

/** Whether `got[from .. to)` is exactly `want`, compared in place. */
const sameWindow = (got: u8[], from: i32, to: i32, want: u8[]): boolean => {
  if (to - from !== toI32(want.length) || from < 0 || to > toI32(got.length)) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(want.length) && from + k < toI32(got.length); k++) {
    if (got[from + k] !== want[k]) {
      return false;
    }
  }
  return true;
};

/** Whether `conn` holds exactly `want` to send; if so it is taken. */
const sends = (conn: TlsRecordServer, want: u8[]): boolean => {
  const same: boolean = sameWindow(conn.output, conn.outputStart, conn.outputEnd, want);
  conn.consume(conn.outputEnd - conn.outputStart);
  return same;
};

/**
 * Starts a fresh chunk of the arena, so that `Arena.used()` afterwards counts
 * only what was allocated since, however full the last chunk was: an array
 * of 64 KiB is a chunk of its own, and the next allocation opens another. It
 * answers the array, so that no arena scope of its own takes it back.
 */
const freshChunk = (): u8[] => {
  const filler: u8[] = new Array<u8>(65536);
  filler[0] = toU8(1);
  return filler;
};

/** The bytes one `aesKey` of a 16-byte key leaves in the arena, measured as a handshake is. */
const aesKeyCost = (): i64 => {
  const key: u8[] = new Array<u8>(16);
  freshChunk();
  const answer = aesKey(key);
  const cost: i64 = Arena.used();
  return answer === null ? toI64(-1) : cost;
};

/** Everything a client sends, and a server answers, in one production handshake. */
class Recorded {
  hello: u8[];
  /** The client's Finished and its close_notify, in one write. */
  finish: u8[];
  /** The server's ServerHello record and its flight record. */
  serverFlight: u8[];
  /** The server's close_notify. */
  serverClose: u8[];
  signature: u8[];
  config: TlsServerConfig;
  random: u8[];
  key: u8[];

  constructor() {
    this.hello = [];
    this.finish = [];
    this.serverFlight = [];
    this.serverClose = [];
    this.signature = [];
    this.config = tcpConfig([]);
    this.random = serverRandom();
    this.key = serverPrivate();
  }
}

/**
 * A ClientHello offering ChaCha20-Poly1305 alone, with an x25519 share and a
 * `padding`-byte extension of a type nobody defined (which the server skips),
 * so that `padding` decides how long it is.
 */
const paddedHello = (padding: i32): u8[] => {
  const none: u8[] = [];
  return clientHelloRaw(TLS_LEGACY_VERSION, none, [TLS_CHACHA20_POLY1305_SHA256], [toU8(0)], [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
    extKeyShare([TLS_GROUP_X25519], [clientShare()]),
    extension(0x4a4a, filled(padding, 0)),
  ]);
};

/** Works out a production handshake once, with the record-layer tests' client, for the runs to replay. */
const record = (padding: i32): Recorded => {
  const r = new Recorded();
  const conn = new TlsRecordServer(new TlsServer(r.config, r.random, range(r.key, ZERO, toI32(r.key.length))));
  const hello: u8[] = paddedHello(padding);
  r.hello = clearRecord(hello);
  feed(conn, r.hello);
  const input: u8[] | null = conn.signatureInput();
  const leaf: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(leaf, input);
  wipe(leaf);
  r.signature = signature === null ? [] : signature;
  conn.sign(r.signature);
  r.serverFlight = drain(conn);
  const records: u8[][] = splitRecords(r.serverFlight);
  if (toI32(records.length) !== 2) {
    return r;
  }
  const serverHello: u8[] = range(records[0], toI32(5), toI32(records[0].length));
  const keys = clientKeysFor(32, hello, serverHello);
  const flight: Opened = openOne(protectionFor(TLS_CHACHA20_POLY1305_SHA256, keys.serverHandshake), records[1]);
  keys.finishWith(flight.content);
  const closeNotify: u8[] = [toU8(1), toU8(0)];
  r.finish = join([
    sealOne(protectionFor(TLS_CHACHA20_POLY1305_SHA256, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO),
    sealOne(protectionFor(TLS_CHACHA20_POLY1305_SHA256, keys.clientApplication), TLS_CONTENT_ALERT, closeNotify, ZERO),
  ]);
  feed(conn, r.finish);
  conn.close();
  r.serverClose = drain(conn);
  return r;
};

// ---- Loopback ---------------------------------------------------------------------

const LISTENER: i32 = 1;
const CLIENT: i32 = 2;
/** A slot's token is this plus the slot. */
const SLOTS: i32 = 100;
const WOULD_BLOCK: i32 = -11;

/** The sockets of the loopback run, made once, and what the client has read of the current connection. */
class Wire {
  loop: i32 = -1;
  listener: i32 = -1;
  server: TlsTcpServer;
  ready: i32[];
  address: u8[];
  buf: u8[];
  serverBuf: u8[];
  random: u8[];
  key: u8[];
  client: i32 = -1;
  slot: i32 = -1;
  /** 0 connecting, 1 waiting for the flight, 2 waiting for the close, 3 done. */
  phase: i32 = 0;
  /** How much of what the server should send this phase has arrived, and whether all of it matched. */
  got: i32 = 0;
  matched: boolean = true;

  constructor(config: TlsServerConfig) {
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", 0, 16);
    this.server = new TlsTcpServer(config, this.listener, 2);
    this.ready = new Array<i32>(16);
    this.address = new Array<u8>(18);
    netAddress(this.address, "127.0.0.1", netLocalPort(this.listener));
    this.buf = new Array<u8>(4096);
    this.serverBuf = new Array<u8>(4096);
    this.random = new Array<u8>(32);
    this.key = new Array<u8>(32);
    pollAdd(this.loop, this.listener, 1, LISTENER);
  }
}

/** Writes all of `bytes` on the client socket; false when it will not take them. */
const clientSend = (w: Wire, bytes: u8[]): boolean => {
  let sent: i32 = 0;
  let tries: i32 = 0;
  while (sent < toI32(bytes.length) && tries < 1000) {
    const n: i32 = netWrite(w.client, bytes, sent, toI32(bytes.length) - sent);
    if (n > 0) {
      sent = sent + n;
    } else if (n !== WOULD_BLOCK) {
      return false;
    }
    tries = tries + 1;
  }
  return sent === toI32(bytes.length);
};

/** Reads what the client socket holds, holding it to `want` from `w.got` on; the end of the stream finishes the connection. */
const clientRead = (w: Wire, want: u8[]): void => {
  while (true) {
    const n: i32 = netRead(w.client, w.buf, ZERO, toI32(w.buf.length));
    if (n === 0) {
      w.phase = 3;
      return;
    }
    if (n < 0) {
      return;
    }
    for (let k: i32 = 0; k < n && k < toI32(w.buf.length); k++) {
      if (w.got >= toI32(want.length) || w.buf[k] !== want[w.got]) {
        w.matched = false;
      }
      w.got = w.got + 1;
    }
  }
};

/** Drives the server's slot after its socket woke: sign when asked, read the client's close and close the slot. */
const serveSlot = (w: Wire, r: Recorded, events: i32): void => {
  let wants: i32 = (events & 5) !== 0 ? w.server.readable(w.slot) : w.server.writable(w.slot);
  if ((wants & TLS_RECORD_SIGN) !== 0) {
    wants = w.server.sign(w.slot, r.signature);
  }
  if ((wants & TLS_RECORD_DATA) !== 0 && w.server.read(w.slot, w.serverBuf, ZERO, toI32(w.serverBuf.length)) === 0) {
    w.server.close(w.slot);
    return;
  }
  if (w.server.holds(w.slot)) {
    pollModify(w.loop, w.server.fd(w.slot), wants & 3, SLOTS + w.slot);
  }
};

/** One connection over loopback, the recorded handshake byte for byte; true when every byte matched and it ended cleanly. */
const oneConnection = (w: Wire, r: Recorded): boolean => {
  w.client = tcpConnect(w.address);
  if (w.client < 0) {
    return false;
  }
  w.slot = -1;
  w.phase = 0;
  w.got = 0;
  w.matched = true;
  pollAdd(w.loop, w.client, 2, CLIENT);
  let waits: i32 = 0;
  while (w.phase < 3 && waits < 200) {
    const n: i32 = pollWait(w.loop, w.ready, 5000);
    if (n <= 0) {
      break;
    }
    waits = waits + 1;
    for (let i: i32 = 0; i < n && 2 * i + 1 < toI32(w.ready.length); i++) {
      const who: i32 = w.ready[2 * i];
      const events: i32 = w.ready[2 * i + 1];
      if (who === LISTENER && w.slot < 0) {
        refill(w.key, r.key);
        refill(w.random, r.random);
        w.slot = w.server.accept(w.random, w.key);
        if (w.slot >= 0) {
          pollAdd(w.loop, w.server.fd(w.slot), 1, SLOTS + w.slot);
        }
      } else if (who === CLIENT && w.phase === 0) {
        if (connectResult(w.client) !== 0 || !clientSend(w, r.hello)) {
          w.matched = false;
          w.phase = 3;
        } else {
          w.phase = 1;
          pollModify(w.loop, w.client, 1, CLIENT);
        }
      } else if (who === CLIENT) {
        const want: u8[] = w.phase === 1 ? r.serverFlight : r.serverClose;
        clientRead(w, want);
        if (w.phase === 1 && w.got === toI32(r.serverFlight.length)) {
          w.phase = 2;
          w.got = 0;
          if (!clientSend(w, r.finish)) {
            w.matched = false;
          }
        }
      } else if (who >= SLOTS && w.slot >= 0 && w.server.holds(w.slot)) {
        serveSlot(w, r, events);
      }
    }
  }
  netClose(w.client);
  return w.phase === 3 && w.matched && w.got === toI32(r.serverClose.length) && w.server.busy() === 0;
};

/** Runs every check and answers the exit code; `net_tls_memory_f64` runs them under `--number-mode f64`. */
export const memoryChecks = (): i32 => {
  const t = new Suite("tls memory");

  // --- 1. RFC 8448 §3, restarted in one slot -----------------------------------------
  const traceKey: u8[] = rfc8448ServerPrivate();
  const traceRandom: u8[] = rfc8448ServerRandom();
  const traceHello: u8[] = rfc8448ClientHelloRecord();
  const traceFinished: u8[] = rfc8448ClientFinishedRecord();
  const traceSignature: u8[] = rfc8448RsaPssSignature();
  const traceServerHello: u8[] = rfc8448ServerHelloRecord();
  const traceFlight: u8[] = rfc8448ServerFlightRecord();
  const slotKey: u8[] = new Array<u8>(32);
  refill(slotKey, traceKey);
  const traceTls = new TlsServer(rfc8448Config(), traceRandom, slotKey);
  const traceConn = new TlsRecordServer(traceTls);
  const aesCost: i64 = aesKeyCost();
  let traceExact: i32 = 0;
  let traceLeft: i64 = 0;
  let traceSteady: i32 = 0;
  for (let round: i32 = 0; round < ROUNDS; round++) {
    freshChunk();
    refill(slotKey, traceKey);
    traceTls.restart(traceRandom, slotKey);
    traceConn.start(traceTls);
    feed(traceConn, traceHello);
    const hello: boolean = sends(traceConn, traceServerHello);
    traceConn.sign(traceSignature);
    const flight: boolean = sends(traceConn, traceFlight);
    feed(traceConn, traceFinished);
    if (hello && flight && traceConn.state === TLS_RECORD_STATE_OPEN && traceTls.serverName === "server") {
      traceExact = traceExact + 1;
    }
    const left: i64 = Arena.used();
    if (round === 1) {
      traceLeft = left;
    }
    if (round > 0 && left === traceLeft) {
      traceSteady = traceSteady + 1;
    }
  }
  t.eqI32("a thousand RFC 8448 handshakes in one restarted slot: every ServerHello and flight record is the trace's", traceExact, ROUNDS);
  t.eqI32("and every handshake after the first leaves the arena the same", traceSteady, ROUNDS - 1);
  t.ok(
    `which is aesKey's four AES-128 schedules and nothing else: ${traceLeft} bytes, 4 x ${aesCost} (52,808 before the slot)`,
    aesCost > toI64(0) && traceLeft === toI64(4) * aesCost
  );

  // --- 2. A production handshake in one slot, with a long ClientHello --------------------
  const padded: Recorded = record(3000);
  t.ok("a 3,000-byte padded ChaCha20 handshake works out: two records, then the close", toI32(padded.serverFlight.length) > 0 && toI32(padded.serverClose.length) > 0);
  const slotTls = new TlsServer(padded.config, padded.random, new Array<u8>(32));
  const slot = new TlsRecordServer(slotTls);
  const startInput: i32 = toI32(slotTls.input.length);
  let slotExact: i32 = 0;
  let slotMark: i64 = 0;
  for (let round: i32 = 0; round < ROUNDS; round++) {
    if (round === 1) {
      slotMark = Arena.mark();
    }
    refill(slotKey, padded.key);
    slotTls.restart(padded.random, slotKey);
    slot.start(slotTls);
    feed(slot, padded.hello);
    const signing: boolean = (slot.interest() & TLS_RECORD_SIGN) !== 0;
    slot.sign(padded.signature);
    const flight: boolean = sends(slot, padded.serverFlight);
    feed(slot, padded.finish);
    const open: boolean = slot.state === TLS_RECORD_STATE_OPEN && slot.peerClosed;
    slot.close();
    if (signing && flight && open && sends(slot, padded.serverClose)) {
      slotExact = slotExact + 1;
    }
  }
  const slotAfter: i64 = Arena.mark();
  t.eqI32("a thousand ChaCha20 handshakes in one slot, every byte the recorded one", slotExact, ROUNDS);
  t.ok(
    `the first grew the slot's input buffer for its ClientHello (${startInput} to ${toI32(slotTls.input.length)} bytes)`,
    toI32(slotTls.input.length) > startInput
  );
  t.ok("and after it Arena.mark() did not move: the handshake allocates nothing that outlives it", slotAfter === slotMark);

  // --- 3. Over loopback, through TlsTcpServer's slot pool ---------------------------------
  const wired: Recorded = record(16);
  const w = new Wire(wired.config);
  let wireExact: i32 = 0;
  let wireMark: i64 = 0;
  for (let round: i32 = 0; round < ROUNDS; round++) {
    if (round === 1) {
      wireMark = Arena.mark();
    }
    if (oneConnection(w, wired)) {
      wireExact = wireExact + 1;
    }
  }
  const wireAfter: i64 = Arena.mark();
  t.eqI32("a thousand connections accepted, handshaken and closed over loopback, every byte the recorded one", wireExact, ROUNDS);
  t.ok("and after the first Arena.mark() did not move: accept, handshake and close reuse the slot", wireAfter === wireMark);
  t.eqI32("every slot is free again", w.server.busy(), ZERO);
  netClose(w.listener);
  netClose(w.loop);

  // --- The slot's own refusals ------------------------------------------------------------
  const none: u8[] = [];
  traceTls.restart(none, slotKey);
  t.ok("a restart with a random that is not 32 bytes fails the server with internal_error", traceTls.state === TLS_STATE_FAILED && traceTls.alert === TLS_ALERT_INTERNAL_ERROR);
  traceTls.restart(traceRandom, none);
  t.ok("and so does one with a key that is not 32 bytes", traceTls.state === TLS_STATE_FAILED && traceTls.alert === TLS_ALERT_INTERNAL_ERROR);
  const kdf = new HkdfScratch();
  const key: u8[] = new Array<u8>(32);
  const iv: u8[] = new Array<u8>(12);
  t.ok("tlsTrafficKeysInto refuses a suite it does not negotiate", !tlsTrafficKeysInto(kdf, toI32(0x1304), new Array<u8>(32), key, iv));
  t.ok("a secret that is not the suite's hash length", !tlsTrafficKeysInto(kdf, TLS_CHACHA20_POLY1305_SHA256, new Array<u8>(48), key, iv));
  t.ok("and a key array of the wrong length", !tlsTrafficKeysInto(kdf, TLS_CHACHA20_POLY1305_SHA256, new Array<u8>(32), new Array<u8>(16), iv));
  t.ok("a cleartext protection has no next secret to advance to", !new TlsRecordProtection().advance(new Array<u8>(32)));
  return t.done();
};
