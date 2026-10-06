// What a QUIC connection leaves in the arena once its handshake lives in the
// slot (H3-1 in docs/security/http3.md, QUIC-3 in docs/security/quic.md).
// Each run takes one recorded connection through one `QuicConnection` slot,
// `reset` for every pass, with the slot's fixed entropy, so every pass is the
// same bytes both ways and every datagram the server writes is compared
// with the first pass's, byte for byte:
//
//   1. aioquic's AES-128-GCM handshake, stream echo and close
//      (`net_quic_conn_replay`'s transcript, with its recorded clock).
//   2. A ChaCha20-Poly1305 and an AES-256-GCM-SHA384 connection with the
//      test client of `net_quic_conn`, recorded on the first pass: the
//      handshake, an echo, a key update the client starts and the probe
//      timeout after it, which derives the next read keys again, and the
//      server's close.
//
// After two warm-up passes, which grow what a slot grows once (the CRYPTO
// buffers, the TLS input), `Arena.mark()` must not move across a hundred
// passes: the loop allocates nothing of its own, so any byte a server call
// kept would move it, whichever chunk it landed in. One pass is also metered
// call by call from a chunk of its own (`QmMeter`), which is how the bytes a
// connection used to keep were measured.
//
// The signature is the caller's and is made once: RFC 6979 makes the P-256
// signature of a fixed input the same every time.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { QUIC_STREAM_END } from "nish/net/quic-stream";
import { QuicKeys, QuicKeysSlot, quicKeyUpdateSecret, quicKeysUpdate } from "nish/net/quic-packet";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_CONN_DATAGRAM_SIZE, QUIC_STATE_CONNECTED, QuicConnection, QuicServerConfig } from "nish/net/quic";
import { TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { echoConfig, fixedEntropy } from "../net_quic_conn_replay/server";
import { transcript } from "../net_quic_conn_replay/recording";
import {
  CLIENT_SCID,
  QcClient,
  qcAead,
  qcCrypto,
  qcFinishedPacket,
  qcHello,
  qcInitial,
  qcParams,
  qcReadFlight,
  qcReceive,
  qcShort,
  qcShortWith,
} from "../net_quic_conn/client";
import { qcDefaultConfig } from "../net_quic_conn/common";
import { qcStream } from "../net_quic_conn/data";
import { QmMeter, qmBegin, qmEnd } from "./meter";
import { qmZero, unitChecks } from "./units";

/** Passes measured by `Arena.mark()`, after the warm-up. */
const PASSES: i32 = 100;
/** Passes first, unmeasured, so that every buffer a slot grows once has grown. */
const WARM: i32 = 2;

/**
 * One connection as the client sent it: each datagram and the time it
 * arrived, and every datagram the server answered, in order, which every
 * later pass must write again byte for byte.
 */
class QmScript {
  inputs: u8[][];
  times: i64[];
  outputs: u8[][];
  /** The CertificateVerify signature, made on the first pass. */
  signature: u8[];
  /** When the server closes the connection, after the last datagram. */
  closeAt: i64 = 0;

  constructor() {
    this.inputs = [];
    this.times = [];
    this.outputs = [];
    this.signature = [];
  }
}

/** What a replay pass found: how many datagrams the server wrote, and how many differed from the script's. */
class QmPass {
  written: i32 = 0;
  wrong: i32 = 0;
  connected: boolean = false;
}

/** The buffers a replay works in, made once: nothing in the loop allocates. */
class QmBuffers {
  out: u8[];
  stream: u8[];
  entropy: u8[];
  fixed: u8[];

  constructor() {
    this.out = new Array<u8>(QUIC_CONN_DATAGRAM_SIZE);
    this.stream = new Array<u8>(65536);
    this.fixed = fixedEntropy();
    this.entropy = new Array<u8>(toI32(this.fixed.length));
  }

  /** The fixed entropy again, in the array `reset` wipes. */
  refill(): u8[] {
    for (let k: i32 = 0; k < toI32(this.entropy.length) && k < toI32(this.fixed.length); k++) {
      this.entropy[k] = this.fixed[k];
    }
    return this.entropy;
  }
}

/**
 * The echo application, as `net_quic_conn_replay`'s `serveDatagram` runs it
 * with `readStream` and `writeStream`, through the calls that allocate
 * nothing: every run of stream data goes straight back, its FIN with it.
 */
const qmEcho = (conn: QuicConnection, b: QmBuffers): void => {
  let id: i64 = conn.nextStreamEvent();
  while (id >= n64(0)) {
    const n: i32 = conn.streamRead(id, b.stream, n32(0), toI32(b.stream.length));
    const end: boolean = n === QUIC_STREAM_END || (n > 0 && conn.streamRead(id, b.stream, n32(0), n32(0)) === QUIC_STREAM_END);
    if (n > 0 || end) {
      conn.streamWrite(id, b.stream, n32(0), n > 0 ? n : n32(0), end);
    }
    id = conn.nextStreamEvent();
  }
};

/** Whether the server's `n` bytes in `b.out` are `want`, byte for byte. */
const qmSame = (b: QmBuffers, n: i32, want: u8[]): boolean => {
  if (n !== toI32(want.length)) {
    return false;
  }
  for (let k: i32 = 0; k < n; k++) {
    if (b.out[k] !== want[k]) {
      return false;
    }
  }
  return true;
};

/**
 * Hands the server one datagram at `now`, signs when it asks, echoes, and
 * takes what it writes: compared with the script's from `pass.written` on,
 * or, when `record`, appended to the script and to `c`, the live client.
 * Every server call is metered when `m` is set.
 */
const qmServe = (
  conn: QuicConnection,
  datagram: u8[],
  now: i64,
  s: QmScript,
  b: QmBuffers,
  pass: QmPass,
  c: QcClient | null,
  m: QmMeter | null
): void => {
  qmBegin(m);
  conn.receive(datagram, now);
  qmEnd(m);
  qmBegin(m);
  const input: u8[] | null = conn.signatureInput();
  qmEnd(m);
  if (input !== null) {
    if (toI32(s.signature.length) === 0) {
      const key: Secret<u8[]> = secret(leafPrivate());
      const signature: u8[] | null = tlsSignEcdsaP256(key, input);
      wipe(key);
      if (signature !== null) {
        s.signature = signature;
      }
    }
    qmBegin(m);
    conn.sign(s.signature);
    qmEnd(m);
  }
  qmBegin(m);
  qmEcho(conn, b);
  qmEnd(m);
  qmDrain(conn, now, s, b, pass, c, m);
};

/** `qmServe`'s last step alone: everything the server has to send at `now`. */
const qmDrain = (conn: QuicConnection, now: i64, s: QmScript, b: QmBuffers, pass: QmPass, c: QcClient | null, m: QmMeter | null): void => {
  for (let guard: i32 = 0; guard < 64; guard++) {
    qmBegin(m);
    const n: i32 = conn.takeDatagramInto(b.out, n32(0), now);
    qmEnd(m);
    if (n <= 0) {
      return;
    }
    if (c !== null) {
      const copy: u8[] = new Array<u8>(n);
      for (let k: i32 = 0; k < n; k++) {
        copy[k] = b.out[k];
      }
      s.outputs.push(copy);
      c.datagrams.push(copy);
      qcReceive(c, copy);
    } else if (pass.written >= toI32(s.outputs.length) || !qmSame(b, n, s.outputs[pass.written])) {
      pass.wrong = pass.wrong + 1;
    }
    pass.written = pass.written + 1;
  }
};

/** One pass of `s` through `conn`, reset first: every datagram in at its time, the close at the end. */
const qmReplay = (conn: QuicConnection, s: QmScript, b: QmBuffers, pass: QmPass, m: QmMeter | null): void => {
  pass.written = 0;
  pass.wrong = 0;
  pass.connected = false;
  qmBegin(m);
  conn.reset(b.refill());
  qmEnd(m);
  for (let k: i32 = 0; k < toI32(s.inputs.length) && k < toI32(s.times.length); k++) {
    qmServe(conn, s.inputs[k], s.times[k], s, b, pass, null, m);
    pass.connected = pass.connected || conn.state === QUIC_STATE_CONNECTED;
  }
  qmBegin(m);
  conn.close(n64(0));
  qmEnd(m);
  qmDrain(conn, s.closeAt, s, b, pass, null, m);
  if (pass.written !== toI32(s.outputs.length)) {
    pass.wrong = pass.wrong + 1;
  }
};

/** `net_quic_conn_replay`'s transcript as a script: aioquic's datagrams and times, and the server's answers. */
const qmAioquic = (): QmScript => {
  const s = new QmScript();
  for (const line of transcript()) {
    const kind: string = line.substring(0, 1);
    const rest: string = line.substring(2);
    if (kind === "c") {
      const space: i32 = toI32(rest.indexOf(" "));
      const now: i64 = toI64(parseInt(rest.substring(0, space)));
      s.inputs.push(fromHex(rest.substring(space + 1)));
      s.times.push(now);
      s.closeAt = now;
    } else if (kind === "s") {
      s.outputs.push(fromHex(rest));
    }
  }
  return s;
};

/** Sends `datagram` from the live client at its time, recording it and the server's answers. */
const qmRecord = (conn: QuicConnection, c: QcClient, datagram: u8[], s: QmScript, b: QmBuffers, pass: QmPass): void => {
  s.inputs.push(datagram);
  s.times.push(c.now);
  qmServe(conn, datagram, c.now, s, b, pass, c, null);
};

/**
 * A connection under `suite` recorded on its first pass through `conn`: the
 * handshake, an echo on stream 0, the client's key update with an echo on
 * stream 4, and a PING a probe timeout later, when the server derives the
 * next read keys again; then the server's close. Answers the script, with
 * `ok` false in `pass` when the handshake did not complete.
 */
const qmRecordSuite = (conn: QuicConnection, suite: i32, b: QmBuffers, pass: QmPass): QmScript => {
  const s = new QmScript();
  conn.reset(b.refill());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(suite, scid);
  const hello: u8[] = qcHello([suite], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  c.before = hello;
  qmRecord(conn, c, qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), s, b, pass);
  if (!qcReadFlight(c, n32(0), n32(0))) {
    return s;
  }
  qmRecord(conn, c, qcFinishedPacket(c), s, b, pass);
  pass.connected = conn.state === QUIC_STATE_CONNECTED;
  qmRecord(conn, c, qcShort(c, qcStream(n64(0), n64(0), "before the update", true)), s, b, pass);
  const keys: QuicKeys | null = c.appWrite;
  if (keys !== null) {
    const next: u8[] | null = quicKeyUpdateSecret(qcAead(suite), c.appWriteSecret);
    if (next !== null) {
      const updated: QuicKeys | null = quicKeysUpdate(keys, next);
      qmRecord(conn, c, qcShortWith(c, updated, true, c.appPn, qcStream(n64(4), n64(0), "after it", true)), s, b, pass);
      c.appPn = c.appPn + n64(1);
      c.now = c.now + conn.recovery.probeTimeout() * n64(2);
      qmRecord(conn, c, qcShortWith(c, updated, true, c.appPn, fromHex("01")), s, b, pass);
      c.appPn = c.appPn + n64(1);
    }
  }
  s.closeAt = c.now;
  conn.close(n64(0));
  qmDrain(conn, s.closeAt, s, b, pass, c, null);
  return s;
};

/**
 * What `TlsServer` keeps of each handshake over QUIC: its copy of the
 * client's transport parameters, a fresh array of their length
 * (`handleClientHello` in std/net/tls.ts, TLS-3's named remainder), made
 * here once and metered the same way.
 */
const qmParametersCopy = (conn: QuicConnection): i64 => {
  const tls: TlsServer | null = conn.tls;
  if (tls === null) {
    return n64(-1);
  }
  const m = new QmMeter();
  m.begin();
  const copy: u8[] = new Array<u8>(toI32(tls.clientTransportParameters.length));
  m.end();
  return toI32(copy.length) >= 0 ? m.kept : n64(-1);
};

/**
 * Runs `s` through the slot `conn`: the warm-up, one pass metered call by
 * call, then `PASSES` metered a pass at a time. `label` names the run. Each
 * connection must keep exactly the copy of the client's transport
 * parameters that `TlsServer` makes, and nothing else.
 */
const qmRun = (t: Suite, label: string, conn: QuicConnection, s: QmScript, b: QmBuffers): void => {
  const pass = new QmPass();
  let exact: i32 = 0;
  for (let k: i32 = 0; k < WARM; k++) {
    qmReplay(conn, s, b, pass, null);
  }
  const m = new QmMeter();
  qmReplay(conn, s, b, pass, m);
  const metered: i64 = m.kept;
  exact = exact + (pass.wrong === 0 && pass.connected ? 1 : 0);
  const residue: i64 = qmParametersCopy(conn);
  const whole = new QmMeter();
  for (let k: i32 = 0; k < PASSES; k++) {
    whole.begin();
    qmReplay(conn, s, b, pass, null);
    whole.end();
    exact = exact + (pass.wrong === 0 && pass.connected ? 1 : 0);
  }
  t.eqI32(`${label}: ${PASSES + 1} connections through one slot, every datagram the recorded one`, exact, PASSES + 1);
  t.ok(
    `${label}: a connection keeps only TlsServer's copy of the client's transport parameters, ${residue} bytes, metered call by call`,
    residue > n64(0) && metered === residue
  );
  t.eqI64(`${label}: and ${PASSES} more keep exactly that each`, whole.kept, residue * toI64(PASSES));
};

/** Whether every key in `slots` is zero, the AES-256 schedules included. */
const qmSlotsZero = (slots: QuicKeysSlot[]): boolean => {
  let zero: boolean = true;
  for (const slot of slots) {
    zero = zero && qmZero(slot.key16) && qmZero(slot.key32) && qmZero(slot.hp16) && qmZero(slot.hp32) && qmZero(slot.keys.iv);
    for (const w of slot.packet256.roundKeys) {
      zero = zero && w === toU64(0);
    }
  }
  return zero;
};

/** Whether every key slot of `conn`, every key-update secret and the Initial secrets are zero. */
const qmKeysZero = (conn: QuicConnection): boolean => {
  let zero: boolean =
    qmZero(conn.initialClient) &&
    qmZero(conn.initialServer) &&
    qmSlotsZero(conn.initial.keySlots) &&
    qmSlotsZero(conn.handshake.keySlots) &&
    qmSlotsZero(conn.application.keySlots);
  for (const secret of conn.readSecrets) {
    zero = zero && qmZero(secret);
  }
  for (const secret of conn.writeSecrets) {
    zero = zero && qmZero(secret);
  }
  return zero;
};

/**
 * What a slot holds once its connection is over, and what `reset` leaves of
 * it for the next: `conn` has just run an AES-256-GCM-SHA384 connection with
 * a key update, so its slots, its key-update secrets and its `TlsServer`'s
 * SHA-384 secrets are full; `reset` must zero every one of them.
 */
const qmResetWipes = (t: Suite, conn: QuicConnection, b: QmBuffers): void => {
  const tls: TlsServer | null = conn.tlsSlot;
  const live: TlsServer | null = conn.tls;
  if (tls === null || live === null) {
    t.ok("the slot keeps its TlsServer across connections", false);
    return;
  }
  t.ok("the slot keeps its TlsServer across connections", live === tls);
  // Index 7 is the CertificateVerify input, which is public.
  const secrets: u8[][] = tls.secrets384;
  // The key updates already wiped the application secrets TLS made; the
  // exporter secret and the expected client Finished are still there.
  let tlsHeld: boolean = false;
  let wiped: boolean = true;
  for (let k: i32 = 0; k < 7 && k < toI32(secrets.length); k++) {
    tlsHeld = tlsHeld || !qmZero(secrets[k]);
  }
  const held: boolean = tlsHeld && !qmKeysZero(conn);
  conn.reset(b.refill());
  for (let k: i32 = 0; k < 7 && k < toI32(secrets.length); k++) {
    wiped = wiped && qmZero(secrets[k]);
  }
  t.ok("before the next connection, the slot holds the last one's keys and secrets", held);
  t.ok(
    "and reset zeroes them all: every space's key slots, AES schedules included, the key-update and Initial secrets, and TlsServer's secrets",
    qmKeysZero(conn) && wiped && conn.tls === null
  );
  t.ok(
    "and the server's own parameters' reset token, and their encoding, which carries it",
    toI32(conn.localParameters.statelessResetToken.length) === 16 &&
      qmZero(conn.localParameters.statelessResetToken) &&
      qmZero(conn.localEncoded)
  );
};

/** Every check, and the exit code. */
export const memoryChecks = (): i32 => {
  const t = new Suite("quic memory");
  unitChecks(t);
  const b = new QmBuffers();

  const echo: QuicConnection = new QuicConnection(echoConfig(), b.refill());
  qmRun(t, "aioquic, AES-128-GCM", echo, qmAioquic(), b);

  const config: QuicServerConfig = qcDefaultConfig();
  const suites: i32[] = [TLS_CHACHA20_POLY1305_SHA256, TLS_AES_256_GCM_SHA384];
  const names: string[] = ["ChaCha20-Poly1305", "AES-256-GCM"];
  for (let k: i32 = 0; k < toI32(suites.length); k++) {
    const conn: QuicConnection = new QuicConnection(config, b.refill());
    const recorded = new QmPass();
    const s: QmScript = qmRecordSuite(conn, suites[k], b, recorded);
    const updated: boolean = conn.keyUpdates === 1;
    t.ok(`${names[k]}: the recorded connection completes, echoes and follows the client's key update`, recorded.connected && updated && toI32(s.outputs.length) > 4);
    qmRun(t, names[k], conn, s, b);
    if (suites[k] === TLS_AES_256_GCM_SHA384) {
      qmResetWipes(t, conn, b);
    }
  }
  return t.done();
};
