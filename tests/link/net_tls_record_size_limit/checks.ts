// The record_size_limit extension (RFC 8449) on `nish/net/tls/record-server`.
// A client's limit caps the inner plaintext — content, type and padding — of
// every protected record the server writes, read here off the record lengths
// on the wire; a limit below 64 is illegal_parameter and an extension body
// that is not two bytes is decode_error; and the server's EncryptedExtensions
// carries its own limit, 2^14 + 1, only when the client sent one.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_ALERT_DECODE_ERROR, TLS_ALERT_ILLEGAL_PARAMETER, TLS_ALERT_INTERNAL_ERROR, TLS_GROUP_X25519, TLS_LEGACY_VERSION, TLS_RECORD_SIZE_LIMIT_MAX, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { TlsServer, tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_CONTENT_APPLICATION_DATA, TLS_CONTENT_HANDSHAKE, TLS_RECORD_HEADER_SIZE } from "nish/net/tls/record";
import { TLS_RECORD_STATE_FAILED, TLS_RECORD_STATE_OPEN, TlsRecordServer } from "nish/net/tls/record-server";
import { toHex } from "../crypto_x509/hex";
import { clientHelloRaw, clientShare, extKeyShare, extSignatureAlgorithms, extSupportedGroups, extSupportedVersions, extension, splitMessages } from "../net_tls_common/client";
import { leafPrivate, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import { ClientKeys, clearRecord, clientKeysFor, splitRecords } from "../net_tls_record_common/client";
import { Opened, ZERO, drain, feed, join, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { TlsRecordProtection } from "nish/net/tls/record";

/** What `peerRecordSizeLimit` reads when the client sent no limit. */
const NO_LIMIT: i32 = 0;

const SUITE: i32 = TLS_AES_128_GCM_SHA256;
/** The AEAD tag on every protected record of the suite. */
const TAG: i32 = 16;

/** The P-256 signature over what `conn` is waiting to sign, with the test leaf, or empty. */
const leafSignature = (conn: TlsRecordServer): u8[] => {
  const input: u8[] | null = conn.signatureInput();
  const key: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(key, input);
  wipe(key);
  const none: u8[] = [];
  return signature === null ? none : signature;
};

/** A record_size_limit extension whose body is `body`, well formed or not. */
const extLimitBody = (body: u8[]): u8[] => extension(28, body);

/** A record_size_limit extension of `limit`. */
const extLimit = (limit: i32): u8[] => extLimitBody([toU8((limit >> 8) & 255), toU8(limit & 255)]);

/** A ClientHello for AES-128-GCM over x25519, with `more` extensions after the usual four. */
const helloWith = (more: u8[][]): u8[] => {
  const none: u8[] = [];
  const extensions: u8[][] = [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([TLS_GROUP_X25519]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
    extKeyShare([TLS_GROUP_X25519], [clientShare()]),
  ];
  for (const e of more) {
    extensions.push(e);
  }
  return clientHelloRaw(TLS_LEGACY_VERSION, none, [SUITE], [toU8(0)], extensions);
};

/** The longest inner plaintext — content, type and padding — of `records`, read off their lengths. */
const longestInner = (records: u8[][]): i32 => {
  let most: i32 = 0;
  for (const record of records) {
    const inner: i32 = toI32(record.length) - TLS_RECORD_HEADER_SIZE - TAG;
    most = inner > most ? inner : most;
  }
  return most;
};

/** A handshake driven to the end, with what the client saw on the way. */
class Run {
  conn: TlsRecordServer;
  keys: ClientKeys;
  /** The server's protected handshake records, as they came off the wire. */
  flightRecords: u8[][];
  /** The handshake bytes those records carried. */
  flight: u8[];

  constructor(conn: TlsRecordServer, keys: ClientKeys) {
    this.conn = conn;
    this.keys = keys;
    this.flightRecords = [];
    this.flight = [];
  }
}

/** A server padding each protected record with `padding` zeros, taken through a handshake with `hello`. */
const handshake = (hello: u8[], padding: i32): Run => {
  const conn = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  conn.padding = padding;
  feed(conn, clearRecord(hello));
  const helloOut: u8[] = drain(conn);
  const keys = clientKeysFor(32, hello, range(helloOut, 5, toI32(helloOut.length)));
  const run = new Run(conn, keys);
  if (conn.state === TLS_RECORD_STATE_FAILED) {
    return run;
  }
  conn.sign(leafSignature(conn));
  // The flight may be more than the output buffer holds: drain until it stops.
  const reader: TlsRecordProtection = protectionFor(SUITE, keys.serverHandshake);
  const pieces: u8[][] = [];
  let rounds: i32 = 0;
  while (conn.outputEnd > conn.outputStart && rounds < 1000) {
    for (const record of splitRecords(drain(conn))) {
      run.flightRecords.push(record);
      const opened: Opened = openOne(reader, record);
      if (opened.type === TLS_CONTENT_HANDSHAKE) {
        pieces.push(opened.content);
      }
    }
    rounds = rounds + 1;
  }
  run.flight = join(pieces);
  keys.finishWith(run.flight);
  feed(conn, sealOne(protectionFor(SUITE, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO));
  return run;
};

/** What a write of `n` bytes put on the wire, and what the client read of it. */
class Written {
  records: u8[][];
  content: u8[];

  constructor() {
    this.records = [];
    this.content = [];
  }
}

/** `n` bytes of 0x5a written through `run`'s open connection, drained as they are sealed. */
const writeThrough = (run: Run, n: i32): Written => {
  const data: u8[] = [];
  for (let k: i32 = 0; k < n; k++) {
    data.push(toU8(0x5a));
  }
  const out = new Written();
  const reader: TlsRecordProtection = protectionFor(SUITE, run.keys.serverApplication);
  const pieces: u8[][] = [];
  let at: i32 = 0;
  let rounds: i32 = 0;
  while (rounds < 1000) {
    if (at < n) {
      const wrote: i32 = run.conn.write(data, at, n - at);
      at = wrote > 0 ? at + wrote : at;
    }
    const records: u8[][] = splitRecords(drain(run.conn));
    if (toI32(records.length) === 0 && at >= n) {
      break;
    }
    for (const record of records) {
      out.records.push(record);
      const opened: Opened = openOne(reader, record);
      if (opened.type === TLS_CONTENT_APPLICATION_DATA) {
        pieces.push(opened.content);
      }
    }
    rounds = rounds + 1;
  }
  out.content = join(pieces);
  return out;
};

/** Whether `hex` holds `part` at an even (byte) offset. */
const holds = (hex: string, part: string): boolean => {
  const n: i32 = toI32(hex.length) - toI32(part.length);
  for (let k: i32 = 0; k <= n; k = k + 2) {
    if (hex.substring(k, k + toI32(part.length)) === part) {
      return true;
    }
  }
  return false;
};

/** The EncryptedExtensions message of `run`'s flight, in hex, or empty. */
const encryptedExtensions = (run: Run): string => {
  const messages: u8[][] = splitMessages(run.flight);
  return toI32(messages.length) > 0 && toI32(messages[0][0]) === 8 ? toHex(messages[0]) : "";
};

/** One client limit taken through a handshake and a write of `n` bytes, checked on the wire. */
const capped = (t: Suite, limit: i32, padding: i32, n: i32): void => {
  const run: Run = handshake(helloWith([extLimit(limit)]), padding);
  t.eqI32(`limit ${limit}, padding ${padding}: the server keeps the client's limit`, run.conn.tls.peerRecordSizeLimit, limit);
  t.eqI32(`limit ${limit}, padding ${padding}: the handshake completes`, run.conn.state, TLS_RECORD_STATE_OPEN);
  t.ok(`limit ${limit}, padding ${padding}: no flight record's inner plaintext passes ${limit}`, longestInner(run.flightRecords) <= limit);
  const perRecord: i32 = limit - 1 - padding;
  const flightBytes: i32 = toI32(run.flight.length);
  t.eqI32(
    `limit ${limit}, padding ${padding}: the flight's ${flightBytes} bytes take ${(flightBytes + perRecord - 1) / perRecord} records`,
    toI32(run.flightRecords.length),
    (flightBytes + perRecord - 1) / perRecord
  );
  const written: Written = writeThrough(run, n);
  t.eqI32(`limit ${limit}, padding ${padding}: the client reads back all ${n} bytes`, toI32(written.content.length), n);
  t.eqI32(`limit ${limit}, padding ${padding}: the fullest application record is exactly the limit`, longestInner(written.records), limit);
  t.eqI32(
    `limit ${limit}, padding ${padding}: ${n} bytes take ${(n + perRecord - 1) / perRecord} records`,
    toI32(written.records.length),
    (n + perRecord - 1) / perRecord
  );
};

/** A ClientHello whose record_size_limit is refused: the alert, and what went on the wire. */
const refused = (t: Suite, label: string, extension: u8[], alert: i32, wire: string): void => {
  const conn = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  feed(conn, clearRecord(helloWith([extension])));
  t.eqI32(`${label}: the alert`, conn.alert, alert);
  t.eqStr(`${label}: sent as a fatal alert in the clear`, toHex(drain(conn)), wire);
};

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_tls_record_size_limit_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const recordSizeLimitChecks = (): i32 => {
  const t = new Suite("tls record_size_limit");

  // --- The cap on what the server writes (RFC 8449 §4) ---
  capped(t, 64, 0, 1000);
  capped(t, 512, 0, 5000);
  capped(t, 512, 11, 5000);

  // --- Refusals ---
  refused(t, "a limit of 63", extLimit(63), TLS_ALERT_ILLEGAL_PARAMETER, "1503030002022f");
  refused(t, "a limit of 0", extLimit(0), TLS_ALERT_ILLEGAL_PARAMETER, "1503030002022f");
  refused(t, "a body of one byte", extLimitBody([toU8(64)]), TLS_ALERT_DECODE_ERROR, "15030300020232");
  refused(t, "a body of three bytes", extLimitBody([toU8(0), toU8(64), toU8(0)]), TLS_ALERT_DECODE_ERROR, "15030300020232");
  refused(t, "an empty body", extLimitBody([]), TLS_ALERT_DECODE_ERROR, "15030300020232");

  // --- What the server advertises, and the top of the range ---
  const offered: Run = handshake(helloWith([extLimit(512)]), 0);
  t.ok("a client that sent a limit gets the server's own, 2^14 + 1, in EncryptedExtensions", holds(encryptedExtensions(offered), "001c00024001"));
  const silent: Run = handshake(helloWith([]), 0);
  t.ok("one that did not gets none", encryptedExtensions(silent) !== "" && !holds(encryptedExtensions(silent), "001c"));
  t.eqI32("and is not limited", silent.conn.tls.peerRecordSizeLimit, NO_LIMIT);
  t.eqI32("and its application records still carry 2^14 bytes", longestInner(writeThrough(silent, 20000).records), TLS_RECORD_SIZE_LIMIT_MAX);
  const huge: Run = handshake(helloWith([extLimit(65535)]), 0);
  t.eqI32("a limit past 2^14 + 1 is taken as 2^14 + 1 (§4)", huge.conn.tls.peerRecordSizeLimit, TLS_RECORD_SIZE_LIMIT_MAX);
  t.eqI32("and the records it gets are the usual ones", longestInner(writeThrough(huge, 20000).records), TLS_RECORD_SIZE_LIMIT_MAX);
  const exact: Run = handshake(helloWith([extLimit(64)]), 0);
  t.eqI32("a limit of 64 is the least one allowed", exact.conn.state, TLS_RECORD_STATE_OPEN);

  // --- A padding the limit leaves no room for ---
  const crowded: Run = handshake(helloWith([extLimit(64)]), 63);
  t.eqI32("a padding of 63 under a limit of 64 fails the connection with internal_error", crowded.conn.alert, TLS_ALERT_INTERNAL_ERROR);

  return t.done();
};
