// Every refusal of `nish/net/tls/record` and `nish/net/tls/record-server` as
// the alert it is, and the paths a well-behaved peer never takes: the
// compatibility change_cipher_spec, a HelloRetryRequest, a flight larger
// than the output buffer, KeyUpdate both ways and on a schedule, and a
// caller that reads too slowly. Each case names the rule of RFC 8446 it
// holds the module to; none may panic.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { AesKey, aesGcmSeal } from "nish/crypto/aes";
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule";
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
} from "nish/net/tls/codec";
import { TlsServer, TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import {
  TLS_ALERT_BAD_RECORD_MAC,
  TLS_ALERT_RECORD_OVERFLOW,
  TLS_ALERT_USER_CANCELED,
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_CHANGE_CIPHER_SPEC,
  TLS_CONTENT_HANDSHAKE,
  TLS_LAST_SEQUENCE,
  TLS_MAX_PLAINTEXT,
  TLS_MAX_RECORD,
  TlsRecordProtection,
  TlsRecordReader,
  tlsNextTrafficSecret,
  tlsRecordLength,
} from "nish/net/tls/record";
import {
  TLS_RECORD_AGAIN,
  TLS_RECORD_DATA,
  TLS_RECORD_DONE,
  TLS_RECORD_INVALID,
  TLS_RECORD_PIPE,
  TLS_RECORD_RESET,
  TLS_RECORD_STATE_CLOSED,
  TLS_RECORD_STATE_FAILED,
  TLS_RECORD_STATE_HANDSHAKE,
  TLS_RECORD_STATE_OPEN,
  TLS_RECORD_WANT_READ,
  TlsRecordServer,
} from "nish/net/tls/record-server";
import { fromHex, toHex } from "../crypto_x509/hex";
import { rfc8448Config } from "../net_tls_rfc8448/checks";
import {
  rfc8448ClientApplicationTraffic,
  rfc8448ClientHandshakeTraffic,
  rfc8448ClientHello,
  rfc8448RsaPssSignature,
  rfc8448ServerApplicationTraffic,
  rfc8448ServerPrivate,
  rfc8448ServerRandom,
} from "../net_tls_rfc8448/trace";
import { leafCertificate, leafPrivate, serverPrivate, serverRandom, tcpConfig } from "../net_tls_common/server";
import { cat, splitMessages } from "../net_tls_common/client";
import {
  rfc8448ClientFinishedRecord,
  rfc8448ClientHelloRecord,
} from "../net_tls_record_rfc8448/records";
import {
  Opened,
  ZERO,
  allZero,
  ascii,
  drain,
  feed,
  filled,
  join,
  keyUpdateMessage,
  openOne,
  protectionFor,
  range,
  readAll,
  sealOne,
} from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor, recordHello, splitRecords } from "../net_tls_record_common/client";

const SUITE: i32 = TLS_AES_128_GCM_SHA256;

/** A record of `type` holding `body`, header and all, with no protection: for headers no sealer would write. */
const rawRecord = (type: i32, body: u8[]): u8[] => {
  const n: i32 = toI32(body.length);
  return join([[toU8(type), toU8(3), toU8(3), toU8(n >> 8), toU8(n & 255)], body]);
};

/**
 * A protected record whose decrypted contents are exactly `inner` — no type
 * byte added — sealed under `p` at its sequence number, which then moves on.
 * For contents `seal` refuses to write: all padding, or longer than §5.4 allows.
 */
const craft = (p: TlsRecordProtection, inner: u8[]): u8[] => {
  const body: i32 = toI32(inner.length) + 16;
  const aad: u8[] = [toU8(23), toU8(3), toU8(3), toU8(body >> 8), toU8(body & 255)];
  const nonce: u8[] = new Array<u8>(12);
  p.nonceInto(nonce);
  const key: AesKey | null = p.aes;
  const sealed: u8[] | null = key === null ? null : aesGcmSeal(key, nonce, aad, inner);
  p.sequence = p.sequence + toI64(1);
  const none: u8[] = [];
  return join([aad, sealed === null ? none : sealed]);
};

/** The one alert record in `bytes`, read under `p` (or in the clear), as "level description". */
const alertIn = (p: TlsRecordProtection, bytes: u8[]): string => {
  const o: Opened = openOne(p, bytes);
  if (o.alert !== 0 || o.type !== TLS_CONTENT_ALERT || toI32(o.content.length) !== 2) {
    return `not an alert: ${toHex(bytes)}`;
  }
  return `${o.content[0]} ${o.content[1]}`;
};

/** A connection to the RFC 8448 trace server, `key` the ephemeral key array it is handed. */
const traceConnection = (): TlsRecordServer =>
  new TlsRecordServer(new TlsServer(rfc8448Config(), rfc8448ServerRandom(), rfc8448ServerPrivate()));

/** A trace connection that has read the ClientHello and signed: it waits for the client's Finished. */
const traceAwaitingFinished = (): TlsRecordServer => {
  const conn = traceConnection();
  feed(conn, rfc8448ClientHelloRecord());
  conn.sign(rfc8448RsaPssSignature());
  drain(conn);
  return conn;
};

/** A trace connection past the client's Finished: open, its output drained. */
const traceOpen = (): TlsRecordServer => {
  const conn = traceAwaitingFinished();
  feed(conn, rfc8448ClientFinishedRecord());
  return conn;
};

/** What the client writes application records with, from sequence 0. */
const clientWriter = (): TlsRecordProtection => protectionFor(SUITE, rfc8448ClientApplicationTraffic());

/** What the client reads the server's application records with, from sequence 0. */
const clientReader = (): TlsRecordProtection => protectionFor(SUITE, rfc8448ServerApplicationTraffic());

/** The P-256 signature over what `conn` is waiting to sign, with the test leaf, or empty. */
const leafSignature = (conn: TlsRecordServer): u8[] => {
  const input: u8[] | null = conn.signatureInput();
  const key: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(key, input);
  wipe(key);
  const none: u8[] = [];
  return signature === null ? none : signature;
};

/** A configuration signing with the P-256 leaf and sending a certificate chain of `extra` more bytes besides. */
const bigConfig = (extra: i32): TlsServerConfig => {
  const config: TlsServerConfig = tcpConfig([]);
  config.certificateChain = [leafCertificate(), filled(extra, 0x30)];
  return config;
};

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_tls_record_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const refusalChecks = (): i32 => {
  const t = new Suite("tls records refusals");
  const none: u8[] = [];

  // --- Framing (§5.1, §5.2) -------------------------------------------------
  t.eqI32("a header of type 19 is unexpected_message", tlsRecordLength(rawRecord(19, none), ZERO, 5), -TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqI32("so is type 24, heartbeat, which TLS 1.3 does not define", tlsRecordLength(rawRecord(24, none), ZERO, 5), -TLS_ALERT_UNEXPECTED_MESSAGE);
  const longest: u8[] = [toU8(23), toU8(3), toU8(3), toU8(0x41), toU8(0x00)];
  t.eqI32("a body of 2^14 + 256 bytes is allowed", tlsRecordLength(longest, ZERO, 5), TLS_MAX_RECORD);
  const tooLong: u8[] = [toU8(23), toU8(3), toU8(3), toU8(0x41), toU8(0x01)];
  t.eqI32("one byte more is record_overflow, from the header alone", tlsRecordLength(tooLong, ZERO, 5), -TLS_ALERT_RECORD_OVERFLOW);
  t.eqI32("four bytes are not yet a header", tlsRecordLength(tooLong, ZERO, 4), ZERO);
  t.eqI32("a window outside the buffer is the caller's mistake", tlsRecordLength(tooLong, 3, 5), -TLS_ALERT_INTERNAL_ERROR);
  const reader = new TlsRecordReader();
  t.eqI32("the reader refuses a window outside its input", reader.push(longest, toI32(2), toI32(4)), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("it takes no more than one largest record", reader.push(filled(20000, 23), ZERO, toI32(20000)), TLS_MAX_RECORD);
  t.eqI32("and then has no room", reader.space(), ZERO);
  reader.consume(toI32(-1));
  t.eqI32("consuming a negative count lets nothing go", reader.end - reader.start, TLS_MAX_RECORD);
  reader.consume(toI32(1048576));
  t.eqI32("consuming past the end lets everything go", reader.space(), TLS_MAX_RECORD);

  // --- Protection: install and seal ------------------------------------------
  const unknown = new TlsRecordProtection();
  t.ok("an unknown suite is not installed", !unknown.install(toI32(0x1304), filled(32, 1)) && !unknown.isProtected());
  t.ok("nor a secret of the wrong length", !unknown.install(SUITE, filled(48, 1)) && !unknown.isProtected());
  const out: u8[] = new Array<u8>(TLS_MAX_RECORD);
  const clear = new TlsRecordProtection();
  const big: u8[] = filled(TLS_MAX_PLAINTEXT + 1, 7);
  t.eqI32("seal: content over 2^14 bytes", clear.seal(TLS_CONTENT_HANDSHAKE, big, ZERO, TLS_MAX_PLAINTEXT + 1, ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: a negative padding", clear.seal(TLS_CONTENT_HANDSHAKE, big, ZERO, toI32(1), toI32(-1), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: padding in the clear, which TLSPlaintext has no room for", clear.seal(TLS_CONTENT_HANDSHAKE, big, ZERO, toI32(1), toI32(1), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: a cleartext record past the end of the output", clear.seal(TLS_CONTENT_HANDSHAKE, big, ZERO, toI32(10), ZERO, out, TLS_MAX_RECORD - 14), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: application data in the clear, which a direction without keys never sends", clear.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(1), ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: a window outside the content", clear.seal(TLS_CONTENT_HANDSHAKE, big, toI32(16380), toI32(10), ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  const sealer = protectionFor(SUITE, rfc8448ServerApplicationTraffic());
  t.eqI32("seal: padding that takes the inner plaintext past 2^14 + 1", sealer.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(10), toI32(16375), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("seal: a protected record past the end of the output", sealer.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(10), ZERO, out, TLS_MAX_RECORD - 30), -TLS_ALERT_INTERNAL_ERROR);
  t.ok("a refused seal spends no sequence number", sealer.sequence === toI64(0));
  t.eqI32("seal: 2^14 bytes of content is the largest record", sealer.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, TLS_MAX_PLAINTEXT, ZERO, out, ZERO), 5 + TLS_MAX_PLAINTEXT + 17);
  const allPadding: u8[] = sealOne(sealer, TLS_CONTENT_APPLICATION_DATA, none, TLS_MAX_PLAINTEXT);
  t.eqI32("and so is no content with 2^14 bytes of padding", toI32(allPadding.length), TLS_MAX_RECORD - 239);
  const opener = protectionFor(SUITE, rfc8448ServerApplicationTraffic());
  openOne(opener, range(out, ZERO, 5 + TLS_MAX_PLAINTEXT + 17));
  t.eqStr("which opens to nothing, its padding gone", toHex(openOne(opener, allPadding).content), "");
  sealer.sequence = TLS_LAST_SEQUENCE;
  t.eqI32("seal: the last sequence number is never used, so the counter cannot wrap", sealer.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(1), ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  const handMade = protectionFor(SUITE, rfc8448ServerApplicationTraffic());
  const noRounds: u64[] = [];
  handMade.aes = new AesKey(10, noRounds);
  t.eqI32("seal: an AES key aesKey did not make", handMade.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(1), ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  const shortKey = protectionFor(TLS_CHACHA20_POLY1305_SHA256, rfc8448ServerApplicationTraffic());
  shortKey.key = filled(16, 1);
  t.eqI32("seal: a ChaCha20 key of the wrong length", shortKey.seal(TLS_CONTENT_APPLICATION_DATA, big, ZERO, toI32(1), ZERO, out, ZERO), -TLS_ALERT_INTERNAL_ERROR);

  // One protection given one suite after another reshapes its key and its AES
  // schedule, and each record it seals opens under a fresh one of that suite.
  const reused = new TlsRecordProtection();
  const reusedSecret256: u8[] = rfc8448ServerApplicationTraffic();
  const reusedSecret384: u8[] = filled(48, 0x5a);
  const turns: string[] = [];
  const order: i32[] = [SUITE, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256, SUITE];
  for (const s of order) {
    const secretFor: u8[] = s === TLS_AES_256_GCM_SHA384 ? reusedSecret384 : reusedSecret256;
    reused.install(s, secretFor);
    const sealed: u8[] = sealOne(reused, TLS_CONTENT_APPLICATION_DATA, ascii("turn"), ZERO);
    turns.push(`${toI32(reused.key.length)}:${toHex(openOne(protectionFor(s, secretFor), sealed).content)}`);
  }
  t.eqStr(
    "one protection installed under AES-128, AES-256, ChaCha20 and AES-128 again seals under each",
    turns.join(" "),
    "16:7475726e 32:7475726e 32:7475726e 16:7475726e"
  );

  // --- Protection: open -------------------------------------------------------
  t.eqStr("open: application data in the clear is unexpected_message", `${openOne(clear, rawRecord(23, filled(3, 1))).alert}`, `${TLS_ALERT_UNEXPECTED_MESSAGE}`);
  t.eqI32("open: a cleartext body over 2^14 bytes is record_overflow", openOne(clear, rawRecord(22, filled(TLS_MAX_PLAINTEXT + 1, 1))).alert, TLS_ALERT_RECORD_OVERFLOW);
  t.eqI32("open: a header of unknown type", openOne(clear, rawRecord(30, filled(3, 1))).alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const small: u8[] = new Array<u8>(1);
  const three: u8[] = rawRecord(22, filled(3, 1));
  t.eqI32("open: no room for the content", clear.open(three, ZERO, toI32(8), small, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("open: a length that is not the header's", clear.open(three, ZERO, toI32(7), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("open: a window outside the record", clear.open(three, toI32(4), toI32(8), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("open: fewer bytes than a header", clear.open(three, ZERO, toI32(4), out, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  const reading = clientReader();
  const writing = clientReader();
  const good: u8[] = sealOne(writing, TLS_CONTENT_APPLICATION_DATA, ascii("hi"), ZERO);
  t.eqI32("open: a protected record must say application_data outside", openOne(reading, rawRecord(22, range(good, 5, 24))).alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqI32("open: a body shorter than a tag and a type is bad_record_mac", openOne(reading, rawRecord(23, filled(16, 0))).alert, TLS_ALERT_BAD_RECORD_MAC);
  const flipped: u8[] = range(good, ZERO, toI32(good.length));
  flipped[toI32(flipped.length) - 1] = toU8(toI32(flipped[toI32(flipped.length) - 1]) ^ 1);
  t.eqI32("open: one flipped bit of the tag is bad_record_mac", openOne(reading, flipped).alert, TLS_ALERT_BAD_RECORD_MAC);
  t.ok("and spends no sequence number", reading.sequence === toI64(0));
  const skipped = clientReader();
  skipped.sequence = toI64(1);
  t.eqI32("open: a record read at the wrong sequence number is bad_record_mac", openOne(skipped, good).alert, TLS_ALERT_BAD_RECORD_MAC);
  t.eqStr("the record itself opens at its own", toHex(openOne(reading, good).content), toHex(ascii("hi")));
  const crafter = clientReader();
  crafter.sequence = toI64(1);
  const zeros: u8[] = craft(crafter, filled(40, 0));
  const overlong: u8[] = craft(crafter, filled(16386, 1));
  const unknownType: u8[] = craft(crafter, [toU8(1), toU8(2), toU8(99)]);
  t.eqI32("open: a record of nothing but padding is unexpected_message (§5.4)", openOne(reading, zeros).alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqI32("open: an inner plaintext of 2^14 + 2 bytes is record_overflow", openOne(reading, overlong).alert, TLS_ALERT_RECORD_OVERFLOW);
  t.eqStr("open: an inner type nobody defined is answered, for the caller to refuse", `${openOne(reading, unknownType).type}`, "99");
  const tiny = clientReader();
  t.eqI32("open: no room for the protected content", tiny.open(good, ZERO, toI32(good.length), small, ZERO), -TLS_ALERT_INTERNAL_ERROR);
  const last = clientReader();
  last.sequence = TLS_LAST_SEQUENCE;
  t.eqI32("open: the last sequence number is never used", openOne(last, good).alert, TLS_ALERT_INTERNAL_ERROR);

  // --- The server's handshake: change_cipher_spec (§5, §D.4) -----------------
  const ccs: u8[] = rawRecord(20, [toU8(1)]);
  const early = traceConnection();
  feed(early, ccs);
  t.eqI32("a change_cipher_spec before the first ClientHello is unexpected_message", early.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqStr("sent as a fatal alert in the clear", toHex(drain(early)), "1503030002020a");
  const dropped = traceConnection();
  feed(dropped, join([rfc8448ClientHelloRecord(), ccs]));
  t.ok("one after the ClientHello is dropped", dropped.state === TLS_RECORD_STATE_HANDSHAKE && dropped.alert === 0);
  dropped.sign(rfc8448RsaPssSignature());
  const clientHandshake = protectionFor(SUITE, rfc8448ClientHandshakeTraffic());
  feed(dropped, ccs);
  t.ok("so is one between the server's flight and the client's Finished", dropped.alert === 0);
  const wrongValue = traceConnection();
  feed(wrongValue, join([rfc8448ClientHelloRecord(), rawRecord(20, [toU8(2)])]));
  wrongValue.sign(rfc8448RsaPssSignature());
  t.eqI32("a change_cipher_spec of 2 is unexpected_message", wrongValue.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const twoBytes = traceConnection();
  feed(twoBytes, join([rfc8448ClientHelloRecord(), rawRecord(20, [toU8(1), toU8(1)])]));
  twoBytes.sign(rfc8448RsaPssSignature());
  t.eqI32("so is one of two bytes", twoBytes.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const hello: u8[] = rfc8448ClientHello();
  const firstHalf: u8[] = clearRecord(range(hello, ZERO, 100));
  const secondHalf: u8[] = clearRecord(range(hello, 100, toI32(hello.length)));
  const fragmented = traceConnection();
  feed(fragmented, join([firstHalf, secondHalf]));
  t.ok("a ClientHello in two records is one ClientHello", fragmented.tls.state === 1 && fragmented.alert === 0);
  const between = traceConnection();
  feed(between, join([firstHalf, ccs]));
  t.eqI32("a change_cipher_spec between them is unexpected_message (§5.1)", between.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const alertBetween = traceConnection();
  feed(alertBetween, join([firstHalf, rawRecord(21, [toU8(1), toU8(90)])]));
  t.eqI32("and so is an alert", alertBetween.alert, TLS_ALERT_UNEXPECTED_MESSAGE);

  // --- The server's handshake: other records ----------------------------------
  const empty = traceConnection();
  feed(empty, rawRecord(22, none));
  t.eqI32("an empty handshake record is unexpected_message (§5.1)", empty.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const clearData = traceConnection();
  feed(clearData, rawRecord(23, filled(4, 1)));
  t.eqI32("application data in the clear is unexpected_message", clearData.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const waiting = traceConnection();
  feed(waiting, join([rfc8448ClientHelloRecord(), rawRecord(23, filled(20, 1))]));
  t.ok("records after the ClientHello wait while the server signs", waiting.alert === 0);
  waiting.sign(rfc8448RsaPssSignature());
  t.eqI32("and are then read under the handshake keys it installed: bad_record_mac", waiting.alert, TLS_ALERT_BAD_RECORD_MAC);
  const overflow = traceConnection();
  feed(overflow, rawRecord(22, filled(TLS_MAX_PLAINTEXT + 1, 1)));
  t.eqI32("a cleartext record over 2^14 bytes is record_overflow", overflow.alert, TLS_ALERT_RECORD_OVERFLOW);
  const header = traceConnection();
  feed(header, tooLong);
  t.eqI32("a header announcing more than 2^14 + 256 bytes, before the body", header.alert, TLS_ALERT_RECORD_OVERFLOW);
  const strange = traceConnection();
  feed(strange, rawRecord(26, filled(2, 1)));
  t.eqI32("a header of a type nobody defined", strange.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const refused = traceConnection();
  feed(refused, rawRecord(21, [toU8(2), toU8(TLS_ALERT_HANDSHAKE_FAILURE)]));
  t.ok(
    "the client's handshake_failure ends the connection, with nothing sent back",
    refused.state === TLS_RECORD_STATE_FAILED && refused.peerAlert === TLS_ALERT_HANDSHAKE_FAILURE && refused.alert === 0 && toI32(drain(refused).length) === 0
  );
  const odd = traceConnection();
  feed(odd, rawRecord(21, [toU8(2), toU8(255)]));
  t.eqI32("an alert nobody defined is an error alert too (§6.2)", odd.peerAlert, toI32(255));
  const canceled = traceConnection();
  feed(canceled, rawRecord(21, [toU8(1), toU8(TLS_ALERT_USER_CANCELED)]));
  t.ok("user_canceled is passed over", canceled.state === TLS_RECORD_STATE_HANDSHAKE && canceled.peerAlert === -1);
  feed(canceled, rawRecord(21, [toU8(1), toU8(0)]));
  t.ok("and the close_notify after it ends the client's stream", canceled.peerClosed && (canceled.interest() & TLS_RECORD_DATA) !== 0);
  const unusedKey: u8[] = rfc8448ServerPrivate();
  const failedEarly = new TlsRecordServer(new TlsServer(rfc8448Config(), rfc8448ServerRandom(), unusedKey));
  feed(failedEarly, clearRecord(range(rfc8448ClientHello(), ZERO, 60)));
  feed(failedEarly, rawRecord(21, [toU8(2), toU8(40), toU8(0)]));
  t.ok("a handshake that fails before its ServerHello wipes the ephemeral key it never used", failedEarly.state === TLS_RECORD_STATE_FAILED && allZero(unusedKey));
  const longAlert = traceConnection();
  feed(longAlert, rawRecord(21, [toU8(2), toU8(40), toU8(0)]));
  t.eqI32("an alert of three bytes is decode_error", longAlert.alert, TLS_ALERT_DECODE_ERROR);

  // At the handshake level, under the client's handshake keys.
  const asData = traceAwaitingFinished();
  feed(asData, sealOne(protectionFor(SUITE, rfc8448ClientHandshakeTraffic()), TLS_CONTENT_APPLICATION_DATA, ascii("early"), ZERO));
  t.eqI32("application data before the client's Finished is unexpected_message", asData.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqStr("sent under the server's application keys, which its Finished switched to", alertIn(clientReader(), drain(asData)), "2 10");
  const innerCcs = traceAwaitingFinished();
  feed(innerCcs, sealOne(protectionFor(SUITE, rfc8448ClientHandshakeTraffic()), TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)], ZERO));
  t.eqI32("a protected change_cipher_spec is unexpected_message (§5)", innerCcs.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const innerUnknown = traceAwaitingFinished();
  feed(innerUnknown, craft(protectionFor(SUITE, rfc8448ClientHandshakeTraffic()), [toU8(1), toU8(99)]));
  t.eqI32("so is a protected record of a type nobody defined", innerUnknown.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const forged = traceAwaitingFinished();
  const forgedFinished: u8[] = rfc8448ClientFinishedRecord();
  forgedFinished[10] = toU8(toI32(forgedFinished[10]) ^ 0x80);
  feed(forged, forgedFinished);
  t.eqI32("a Finished record that does not authenticate is bad_record_mac", forged.alert, TLS_ALERT_BAD_RECORD_MAC);
  const wrongFinished = traceAwaitingFinished();
  const badVerify: u8[] = cat([[toU8(20), toU8(0), toU8(0), toU8(32)], filled(32, 1)]);
  feed(wrongFinished, sealOne(protectionFor(SUITE, rfc8448ClientHandshakeTraffic()), TLS_CONTENT_HANDSHAKE, badVerify, ZERO));
  t.eqI32("a Finished that authenticates but does not verify is TlsServer's decrypt_error", wrongFinished.alert, TLS_ALERT_DECRYPT_ERROR);
  t.eqStr("sent as a fatal alert under the server's application keys", alertIn(clientReader(), drain(wrongFinished)), `2 ${TLS_ALERT_DECRYPT_ERROR}`);
  t.ok(
    "the failure wipes what TlsServer still held: the client's application secret, the exporter secret, the expected Finished",
    allZero(wrongFinished.tls.clientApplicationSecret) && allZero(wrongFinished.tls.exporterSecret) && allZero(wrongFinished.tls.expectedClientFinished) && toI32(wrongFinished.tls.exporterSecret.length) === 32
  );

  // The caller's mistakes.
  const badRandom = new TlsRecordServer(new TlsServer(rfc8448Config(), none, rfc8448ServerPrivate()));
  t.ok("a TlsServer that refused its randomness fails the connection at once", badRandom.state === TLS_RECORD_STATE_FAILED);
  t.eqStr("with internal_error in the clear", toHex(drain(badRandom)), "15030300020250");
  const unsigned = traceConnection();
  t.ok("there is no signature input before the ClientHello", unsigned.signatureInput() === null);
  t.eqI32("signing before one is due is internal_error", unsigned.sign(rfc8448RsaPssSignature()), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("and the failure is answered again", unsigned.sign(rfc8448RsaPssSignature()), TLS_ALERT_INTERNAL_ERROR);
  t.ok("nor once the connection has failed", unsigned.signatureInput() === null);
  const emptySignature = traceConnection();
  feed(emptySignature, rfc8448ClientHelloRecord());
  t.eqI32("an empty signature is TlsServer's internal_error", emptySignature.sign(none), TLS_ALERT_INTERNAL_ERROR);
  const overPadded = traceConnection();
  feed(overPadded, rfc8448ClientHelloRecord());
  drain(overPadded);
  overPadded.padding = TLS_MAX_PLAINTEXT;
  t.eqI32("a padding no record can carry fails the flight with internal_error", overPadded.sign(rfc8448RsaPssSignature()), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("and the alert, which cannot carry it either, is not sent", toI32(drain(overPadded).length), ZERO);
  // --- After the handshake: application records -------------------------------
  const conn = traceOpen();
  const writer = clientWriter();
  feed(conn, join([sealOne(writer, TLS_CONTENT_APPLICATION_DATA, ascii("one"), ZERO), sealOne(writer, TLS_CONTENT_APPLICATION_DATA, ascii("two"), 9)]));
  t.eqStr("two data records, one padded, read as their content", toHex(readAll(conn)), toHex(ascii("onetwo")));
  const nothing: u8[] = new Array<u8>(4);
  t.eqI32("a read with nothing waiting answers -11", conn.read(nothing, ZERO, toI32(4)), TLS_RECORD_AGAIN);
  t.eqI32("a read of no bytes answers 0", conn.read(nothing, ZERO, ZERO), ZERO);
  t.eqI32("a read window outside the buffer is -22", conn.read(nothing, toI32(2), toI32(4)), TLS_RECORD_INVALID);
  t.eqI32("so is a write window", conn.write(nothing, toI32(3), toI32(2)), TLS_RECORD_INVALID);
  t.eqI32("and a receive window", conn.receive(nothing, toI32(5), toI32(1)), TLS_RECORD_INVALID);
  t.eqI32("an empty write sends nothing", conn.write(nothing, ZERO, ZERO), ZERO);
  feed(conn, rawRecord(20, [toU8(1)]));
  t.eqI32("a change_cipher_spec after the client's Finished is unexpected_message", conn.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  t.eqStr("sent under the server's application keys", alertIn(clientReader(), drain(conn)), "2 10");
  t.eqI32("a failed connection reads -104", conn.read(nothing, ZERO, toI32(4)), TLS_RECORD_RESET);
  t.eqI32("writes -32", conn.write(nothing, ZERO, toI32(4)), TLS_RECORD_PIPE);
  t.eqI32("refuses a key update with -32", conn.keyUpdate(false), TLS_RECORD_PIPE);
  t.eqI32("and takes and drops what arrives", conn.receive(nothing, ZERO, toI32(4)), toI32(4));
  conn.close();
  t.ok("closing it sends nothing more", conn.interest() === TLS_RECORD_DONE);

  const refusalsAfter: string[] = [];
  const cases: u8[][] = [
    keyUpdateMessage(2),
    [toU8(4), toU8(0), toU8(0), toU8(1), toU8(0)],
    [toU8(24), toU8(0), toU8(0), toU8(2), toU8(0), toU8(0)],
    join([keyUpdateMessage(0), [toU8(24)]]),
    none,
  ];
  for (const message of cases) {
    const c = traceOpen();
    feed(c, sealOne(clientWriter(), TLS_CONTENT_HANDSHAKE, message, ZERO));
    refusalsAfter.push(`${c.alert}`);
  }
  t.eqStr(
    "after the handshake: a KeyUpdate of 2 (illegal_parameter), a NewSessionTicket from the client (unexpected_message), a KeyUpdate of length 2 (decode_error), one followed by another message in its record (unexpected_message, §5.1), an empty handshake record (unexpected_message)",
    refusalsAfter.join(" "),
    `${TLS_ALERT_ILLEGAL_PARAMETER} ${TLS_ALERT_UNEXPECTED_MESSAGE} ${TLS_ALERT_DECODE_ERROR} ${TLS_ALERT_UNEXPECTED_MESSAGE} ${TLS_ALERT_UNEXPECTED_MESSAGE}`
  );
  const interleaved = traceOpen();
  const w2 = clientWriter();
  feed(interleaved, join([sealOne(w2, TLS_CONTENT_HANDSHAKE, range(keyUpdateMessage(0), ZERO, 3), ZERO), sealOne(w2, TLS_CONTENT_APPLICATION_DATA, ascii("x"), ZERO)]));
  t.eqI32("application data between the records of a KeyUpdate is unexpected_message (§5.1)", interleaved.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const appCcs = traceOpen();
  feed(appCcs, sealOne(clientWriter(), TLS_CONTENT_CHANGE_CIPHER_SPEC, [toU8(1)], ZERO));
  t.eqI32("a protected change_cipher_spec after the handshake is unexpected_message", appCcs.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const appUnknown = traceOpen();
  feed(appUnknown, craft(clientWriter(), [toU8(5), toU8(99)]));
  t.eqI32("so is a record of a type nobody defined", appUnknown.alert, TLS_ALERT_UNEXPECTED_MESSAGE);
  const appForged = traceOpen();
  const forgedData: u8[] = sealOne(clientWriter(), TLS_CONTENT_APPLICATION_DATA, ascii("forged"), ZERO);
  forgedData[6] = toU8(toI32(forgedData[6]) ^ 1);
  feed(appForged, forgedData);
  t.eqI32("and a data record that does not authenticate is bad_record_mac", appForged.alert, TLS_ALERT_BAD_RECORD_MAC);
  const appAlert = traceOpen();
  feed(appAlert, sealOne(clientWriter(), TLS_CONTENT_ALERT, [toU8(2), toU8(TLS_ALERT_DECODE_ERROR)], ZERO));
  t.ok("the client's error alert ends an open connection", appAlert.state === TLS_RECORD_STATE_FAILED && appAlert.peerAlert === TLS_ALERT_DECODE_ERROR);

  // --- KeyUpdate (§4.6.3, §7.2) ------------------------------------------------
  const updating = traceOpen();
  const updater = clientWriter();
  const update: u8[] = sealOne(updater, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(0), ZERO);
  const next: u8[] = tlsNextTrafficSecret(32, rfc8448ClientApplicationTraffic());
  const updated = protectionFor(SUITE, next);
  feed(updating, join([update, sealOne(updated, TLS_CONTENT_APPLICATION_DATA, ascii("after"), ZERO)]));
  t.eqStr("the client's KeyUpdate moves the read keys: its next record is under the next secret", toHex(readAll(updating)), toHex(ascii("after")));
  t.ok("nothing is owed back when the client did not ask", toI32(drain(updating).length) === 0 && updating.state === TLS_RECORD_STATE_OPEN);
  feed(updating, sealOne(updater, TLS_CONTENT_APPLICATION_DATA, ascii("stale"), ZERO));
  t.eqI32("a record under the old keys no longer authenticates", updating.alert, TLS_ALERT_BAD_RECORD_MAC);

  const asked = traceOpen();
  const askWriter = clientWriter();
  const askRecords: u8[] = join([
    sealOne(askWriter, TLS_CONTENT_HANDSHAKE, range(keyUpdateMessage(1), ZERO, 3), ZERO),
    sealOne(askWriter, TLS_CONTENT_HANDSHAKE, range(keyUpdateMessage(1), 3, 5), ZERO),
  ]);
  feed(asked, askRecords);
  const serverReader = clientReader();
  const answer: Opened = openOne(serverReader, drain(asked));
  t.eqStr("a KeyUpdate asking for one, in two records, is answered with the server's own, under its old keys", `${answer.type} ${toHex(answer.content)}`, "22 1800000100");
  t.eqI32("the server's next write takes everything", asked.write(ascii("fresh"), ZERO, toI32(5)), toI32(5));
  const nextServer = protectionFor(SUITE, tlsNextTrafficSecret(32, rfc8448ServerApplicationTraffic()));
  t.eqStr("and is under its next secret", toHex(openOne(nextServer, drain(asked)).content), toHex(ascii("fresh")));
  t.eqI32("keyUpdate(true) sends one asking the client back", asked.keyUpdate(true), ZERO);
  t.eqStr("whose request byte is 1", toHex(openOne(nextServer, drain(asked)).content), "1800000101");

  const scheduled = traceOpen();
  scheduled.writeProtection.recordLimit = toI64(2);
  for (let k: i32 = 0; k < 3; k++) {
    scheduled.write(ascii("tick"), ZERO, toI32(4));
  }
  const ticks: u8[][] = splitRecords(drain(scheduled));
  const tickReader = clientReader();
  const shownTicks: string[] = [];
  for (const record of ticks) {
    const o: Opened = openOne(tickReader, record);
    shownTicks.push(`${o.type}:${toHex(o.content)}`);
    if (o.type === TLS_CONTENT_HANDSHAKE) {
      tickReader.install(SUITE, tlsNextTrafficSecret(32, rfc8448ServerApplicationTraffic()));
    }
  }
  t.eqStr(
    "after recordLimit records the writer sends a KeyUpdate of its own before the next",
    shownTicks.join(" "),
    "23:7469636b 23:7469636b 22:1800000100 23:7469636b"
  );

  // A client may ask for KeyUpdates as often as it sends data: each one, and
  // the server's answer, is written into arrays the connection already has.
  const spam = traceOpen();
  const spamWriter = clientWriter();
  let spamSecret: u8[] = rfc8448ClientApplicationTraffic();
  const updates: u8[][] = [];
  for (let k: i32 = 0; k < 100; k++) {
    const update: u8[] = sealOne(spamWriter, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(1), ZERO);
    spamSecret = tlsNextTrafficSecret(32, spamSecret);
    spamWriter.install(SUITE, spamSecret);
    updates.push(join([update, sealOne(spamWriter, TLS_CONTENT_APPLICATION_DATA, ascii("k"), ZERO)]));
  }
  const sink: u8[] = new Array<u8>(8);
  let moved: i64 = 0;
  let answered: i32 = 0;
  for (const u of updates) {
    const before: i64 = Arena.used();
    feed(spam, u);
    answered = answered + (spam.outputEnd > spam.outputStart ? 1 : 0);
    spam.consume(spam.outputEnd - spam.outputStart);
    spam.read(sink, ZERO, toI32(sink.length));
    moved = moved + (Arena.used() - before);
  }
  t.ok(
    `a hundred KeyUpdates asking for one back, each followed by data, are each answered, and move the arena not at all (${moved} bytes)`,
    answered === 100 && moved === toI64(0) && spam.state === TLS_RECORD_STATE_OPEN
  );
  feed(spam, sealOne(spamWriter, TLS_CONTENT_APPLICATION_DATA, ascii("still here"), ZERO));
  t.eqStr("and the hundred-and-first key reads the next record", toHex(readAll(spam)), toHex(ascii("still here")));

  // Records that carry nothing for the caller are refused after sixteen in a row.
  const idleKinds: string[] = [];
  for (let kind: i32 = 0; kind < 3; kind++) {
    const c = traceOpen();
    const w = clientWriter();
    let s2: u8[] = rfc8448ClientApplicationTraffic();
    let records: i32 = 0;
    while (c.state === TLS_RECORD_STATE_OPEN && records < 20) {
      if (kind === 0) {
        feed(c, sealOne(w, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(0), ZERO));
        s2 = tlsNextTrafficSecret(32, s2);
        w.install(SUITE, s2);
      } else if (kind === 1) {
        feed(c, sealOne(w, TLS_CONTENT_APPLICATION_DATA, none, ZERO));
      } else {
        feed(c, sealOne(w, TLS_CONTENT_ALERT, [toU8(1), toU8(TLS_ALERT_USER_CANCELED)], ZERO));
      }
      records = records + 1;
    }
    idleKinds.push(`${records}:${c.alert}`);
  }
  t.eqStr(
    "seventeen KeyUpdates, empty data records or user_canceled warnings in a row are unexpected_message",
    idleKinds.join(" "),
    `17:${TLS_ALERT_UNEXPECTED_MESSAGE} 17:${TLS_ALERT_UNEXPECTED_MESSAGE} 17:${TLS_ALERT_UNEXPECTED_MESSAGE}`
  );
  const ccsFlood = traceAwaitingFinished();
  let floods: i32 = 0;
  while (ccsFlood.state === TLS_RECORD_STATE_HANDSHAKE && floods < 20) {
    feed(ccsFlood, rawRecord(20, [toU8(1)]));
    floods = floods + 1;
  }
  t.eqStr("and so are seventeen change_cipher_specs", `${floods}:${ccsFlood.alert}`, `17:${TLS_ALERT_UNEXPECTED_MESSAGE}`);

  // A key that does not install fails the connection rather than leave a direction in the clear.
  const badRead = traceOpen();
  badRead.readSecret = filled(33, 1);
  feed(badRead, sealOne(clientWriter(), TLS_CONTENT_HANDSHAKE, keyUpdateMessage(0), ZERO));
  t.eqI32("a read secret that installs no keys fails the client's KeyUpdate with internal_error", badRead.alert, TLS_ALERT_INTERNAL_ERROR);
  const badWrite = traceOpen();
  badWrite.writeSecret = filled(33, 1);
  t.eqI32("and a write secret that installs none fails the server's: -104", badWrite.keyUpdate(false), TLS_RECORD_RESET);
  t.eqI32("with internal_error", badWrite.alert, TLS_ALERT_INTERNAL_ERROR);

  // --- A caller that reads slowly, and one that writes too much ------------------
  const slow = traceOpen();
  const slowWriter = clientWriter();
  const full: u8[] = filled(TLS_MAX_PLAINTEXT, 0x61);
  const threeRecords: u8[] = join([
    sealOne(slowWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
    sealOne(slowWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
    sealOne(slowWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
  ]);
  let fed: i32 = 0;
  let taken: i32 = slow.receive(threeRecords, ZERO, toI32(threeRecords.length));
  while (taken > 0) {
    fed = fed + taken;
    taken = slow.receive(threeRecords, fed, toI32(threeRecords.length) - fed);
  }
  t.ok(
    "with two records unread, the third waits and the connection stops asking to be read",
    fed === toI32(threeRecords.length) && (slow.interest() & TLS_RECORD_WANT_READ) === 0 && slow.plainEnd - slow.plainStart === 2 * TLS_MAX_PLAINTEXT
  );
  t.eqI32("reading everything lets the third in", toI32(readAll(slow).length), 3 * TLS_MAX_PLAINTEXT);
  t.ok("and it asks to be read again", (slow.interest() & TLS_RECORD_WANT_READ) !== 0);

  const busy = traceOpen();
  const lots: u8[] = filled(40000, 0x62);
  const first: i32 = busy.write(lots, ZERO, toI32(40000));
  t.ok("a write larger than the output takes what fits, in records shortened to the room", first > 2 * TLS_MAX_PLAINTEXT && first < 40000);
  t.eqI32("the next write waits", busy.write(lots, first, 40000 - first), TLS_RECORD_AGAIN);
  t.eqI32("and so does a key update", busy.keyUpdate(false), TLS_RECORD_AGAIN);
  const busyReader = clientReader();
  let echoed: i32 = 0;
  for (const record of splitRecords(drain(busy))) {
    echoed = echoed + toI32(openOne(busyReader, record).content.length);
  }
  t.eqI32("what it took arrives whole", echoed, first);
  t.eqI32("once the socket has taken it, the rest fits", busy.write(lots, first, toI32(40000) - first), toI32(40000) - first);
  const before: i32 = busy.outputEnd - busy.outputStart;
  busy.consume(toI32(-1));
  t.eqI32("consuming a negative count sends nothing", busy.outputEnd - busy.outputStart, before);
  busy.consume(toI32(100));
  t.eqI32("a partial send leaves the rest in order", busy.outputEnd - busy.outputStart, before - 100);
  const moreRoom: i32 = busy.write(lots, ZERO, toI32(30000));
  t.ok("and the unsent bytes move to the front to make room for more", moreRoom > 0 && busy.outputStart === 0);
  t.eqI32("signing an open connection is internal_error, and changes nothing", busy.sign(rfc8448RsaPssSignature()), TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("it is still open", busy.state, TLS_RECORD_STATE_OPEN);

  // --- Ends: truncation, an orderly end, a socket failure, a close mid-handshake ---
  const cut = traceOpen();
  cut.write(ascii("written"), ZERO, toI32(7));
  cut.end();
  t.ok("a stream that ends without close_notify is truncation: failed", cut.state === TLS_RECORD_STATE_FAILED && cut.write(ascii("more"), ZERO, toI32(4)) === TLS_RECORD_PIPE);
  t.eqStr("though what was written before may still go out", toHex(openOne(clientReader(), drain(cut)).content), toHex(ascii("written")));
  t.ok("and then nothing is due", cut.interest() === TLS_RECORD_DONE);
  const partial = traceOpen();
  feed(partial, range(sealOne(clientWriter(), TLS_CONTENT_APPLICATION_DATA, ascii("cut short"), ZERO), ZERO, toI32(10)));
  partial.end();
  t.eqI32("a stream that ends inside a record is truncation too", partial.state, TLS_RECORD_STATE_FAILED);
  const heldClose = traceOpen();
  const heldWriter = clientWriter();
  const heldStream: u8[] = join([
    sealOne(heldWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
    sealOne(heldWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
    sealOne(heldWriter, TLS_CONTENT_APPLICATION_DATA, full, ZERO),
    sealOne(heldWriter, TLS_CONTENT_ALERT, [toU8(1), toU8(0)], ZERO),
  ]);
  let heldFed: i32 = 0;
  let heldTaken: i32 = heldClose.receive(heldStream, ZERO, toI32(heldStream.length));
  while (heldTaken > 0) {
    heldFed = heldFed + heldTaken;
    heldTaken = heldClose.receive(heldStream, heldFed, toI32(heldStream.length) - heldFed);
  }
  heldClose.end();
  t.ok("a stream that ends while its close_notify waits behind unread data is not truncation yet", heldClose.state === TLS_RECORD_STATE_OPEN);
  t.eqI32("reading everything reaches the close_notify", toI32(readAll(heldClose).length), 3 * TLS_MAX_PLAINTEXT);
  t.ok("and the stream ends in order", heldClose.peerClosed && heldClose.read(nothing, ZERO, toI32(4)) === 0);
  const orderly = traceOpen();
  feed(orderly, sealOne(clientWriter(), TLS_CONTENT_ALERT, [toU8(1), toU8(0)], ZERO));
  orderly.end();
  t.ok("after close_notify the end of the stream is orderly", orderly.state === TLS_RECORD_STATE_OPEN && orderly.read(nothing, ZERO, toI32(4)) === 0);
  t.eqI32("and later records are taken and dropped (§6.1)", feed(orderly, filled(9, 23)), toI32(9));
  t.eqI32("the server may still write after the client's close_notify", orderly.write(ascii("bye"), ZERO, toI32(3)), toI32(3));
  const broken = traceOpen();
  broken.write(ascii("unsent"), ZERO, toI32(6));
  broken.abort();
  t.ok("a socket failure ends the connection with nothing sent", broken.state === TLS_RECORD_STATE_FAILED && toI32(drain(broken).length) === 0);
  const quitting = traceConnection();
  quitting.close();
  t.eqStr("closing before the handshake sends close_notify in the clear", toHex(drain(quitting)), "15030300020100");
  t.ok("after which writes are -32, key updates -32 and nothing is due", quitting.write(nothing, ZERO, toI32(1)) === TLS_RECORD_PIPE && quitting.keyUpdate(true) === TLS_RECORD_PIPE && quitting.state === TLS_RECORD_STATE_CLOSED);
  quitting.close();
  t.eqI32("closing twice sends nothing more", toI32(drain(quitting).length), ZERO);
  const closing = traceOpen();
  closing.close();
  drain(closing);
  feed(closing, sealOne(clientWriter(), TLS_CONTENT_HANDSHAKE, keyUpdateMessage(1), ZERO));
  t.eqI32("after its close_notify the server answers no KeyUpdate (§6.1)", toI32(drain(closing).length), ZERO);
  feed(closing, rawRecord(23, filled(30, 1)));
  t.ok("and sends no alert when it then fails", closing.state === TLS_RECORD_STATE_FAILED && toI32(drain(closing).length) === 0);
  const crowded = traceOpen();
  const crowd: u8[] = filled(40000, 0x64);
  let crowdAt: i32 = 0;
  let crowdTook: i32 = crowded.write(crowd, ZERO, toI32(crowd.length));
  while (crowdTook > 0) {
    crowdAt = crowdAt + crowdTook;
    crowdTook = crowded.write(crowd, crowdAt, toI32(crowd.length) - crowdAt);
  }
  crowded.close();
  t.ok("a close with the output full waits for room, and is not done", (crowded.interest() & TLS_RECORD_DONE) === 0 && crowded.closeDue);
  const crowdReader = clientReader();
  let lastType: i32 = 0;
  let rounds2: i32 = 0;
  while (crowded.outputEnd > crowded.outputStart && rounds2 < 10) {
    for (const record of splitRecords(drain(crowded))) {
      lastType = openOne(crowdReader, record).type;
    }
    rounds2 = rounds2 + 1;
  }
  t.ok("its close_notify follows the data once there is room, and then it is done", lastType === TLS_CONTENT_ALERT && crowded.interest() === TLS_RECORD_DONE);
  const handshaking = traceConnection();
  t.eqI32("a write during the handshake waits", handshaking.write(nothing, ZERO, toI32(1)), TLS_RECORD_AGAIN);
  t.eqI32("and so does a key update", handshaking.keyUpdate(false), TLS_RECORD_AGAIN);
  const onePad = traceOpen();
  onePad.padding = 1;
  const twenty: u8[] = filled(20000, 0x63);
  t.eqI32("with one byte of padding a 20,000-byte write is taken whole", onePad.write(twenty, ZERO, toI32(twenty.length)), toI32(20000));
  const padReader = clientReader();
  const padSizes: string[] = [];
  for (const record of splitRecords(drain(onePad))) {
    padSizes.push(`${toI32(openOne(padReader, record).content.length)}`);
  }
  t.eqStr("in records of 2^14 − 1 bytes, the padding's byte taken from the content's room (§5.4)", padSizes.join(" "), "16383 3617");
  const padded = traceOpen();
  padded.padding = TLS_MAX_PLAINTEXT;
  t.eqI32("a write whose padding no record can carry fails the connection: -104", padded.write(ascii("hello"), ZERO, toI32(5)), TLS_RECORD_RESET);
  t.eqI32("with internal_error", padded.alert, TLS_ALERT_INTERNAL_ERROR);

  // --- Middlebox compatibility, HelloRetryRequest, a flight bigger than the buffer ---
  const ccsRecord: string = "140303000101";
  const compat = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  const compatHello: u8[] = recordHello([TLS_AES_128_GCM_SHA256], true, false);
  feed(compat, clearRecord(compatHello));
  const compatOut: u8[][] = splitRecords(drain(compat));
  t.ok(
    "a client with a session id gets the ServerHello and then one change_cipher_spec (§D.4)",
    toI32(compatOut.length) === 2 && toI32(compatOut[0][0]) === 22 && toHex(compatOut[1]) === ccsRecord
  );
  compat.sign(leafSignature(compat));
  const compatFlight: u8[][] = splitRecords(drain(compat));
  const compatKeys = clientKeysFor(32, compatHello, range(compatOut[0], 5, toI32(compatOut[0].length)));
  const compatFlightOpened: Opened = openOne(protectionFor(SUITE, compatKeys.serverHandshake), compatFlight[0]);
  compatKeys.finishWith(compatFlightOpened.content);
  t.eqI32("its flight is one record of four messages", toI32(splitMessages(compatFlightOpened.content).length), toI32(4));
  feed(compat, join([rawRecord(20, [toU8(1)]), sealOne(protectionFor(SUITE, compatKeys.clientHandshake), TLS_CONTENT_HANDSHAKE, compatKeys.finished, ZERO)]));
  t.eqI32("and its change_cipher_spec and Finished open the connection", compat.state, TLS_RECORD_STATE_OPEN);

  const retry = new TlsRecordServer(new TlsServer(tcpConfig([]), serverRandom(), serverPrivate()));
  const retryHello1: u8[] = recordHello([TLS_AES_128_GCM_SHA256], true, true);
  feed(retry, clearRecord(retryHello1));
  const retryOut: u8[][] = splitRecords(drain(retry));
  t.ok(
    "a HelloRetryRequest is followed by the change_cipher_spec, since it is the first message",
    toI32(retryOut.length) === 2 && toHex(retryOut[1]) === ccsRecord
  );
  const retryHello2: u8[] = recordHello([TLS_AES_128_GCM_SHA256], true, false);
  feed(retry, join([rawRecord(20, [toU8(1)]), clearRecord(retryHello2)]));
  const retryOut2: u8[][] = splitRecords(drain(retry));
  t.ok("the second ServerHello comes alone: one change_cipher_spec per connection", toI32(retryOut2.length) === 1 && toI32(retryOut2[0][0]) === 22);
  t.ok("and the server waits for its signature", retry.signatureInput() !== null);

  const large = new TlsRecordServer(new TlsServer(bigConfig(50000), serverRandom(), serverPrivate()));
  const largeHello: u8[] = recordHello([TLS_AES_128_GCM_SHA256], false, false);
  feed(large, clearRecord(largeHello));
  const largeHelloOut: u8[] = drain(large);
  large.sign(leafSignature(large));
  const largeKeys = clientKeysFor(32, largeHello, range(largeHelloOut, 5, toI32(largeHelloOut.length)));
  const largeReader = protectionFor(SUITE, largeKeys.serverHandshake);
  const pieces: u8[][] = [];
  let records: i32 = 0;
  let rounds: i32 = 0;
  let held: i32 = large.outputEnd - large.outputStart;
  let mostHeld: i32 = held;
  while (held > 0 && rounds < 10) {
    for (const record of splitRecords(drain(large))) {
      pieces.push(openOne(largeReader, record).content);
      records = records + 1;
    }
    rounds = rounds + 1;
    held = large.outputEnd - large.outputStart;
    mostHeld = held > mostHeld ? held : mostHeld;
  }
  const largeFlight: u8[] = join(pieces);
  t.ok("a 50 KB flight is held back and sealed as the output drains", rounds > 1 && mostHeld <= 2 * TLS_MAX_RECORD);
  t.eqI32("in records of at most 2^14 bytes, four in all", records, toI32(4));
  t.eqI32("which join into its four messages", toI32(splitMessages(largeFlight).length), toI32(4));
  largeKeys.finishWith(largeFlight);
  feed(large, sealOne(protectionFor(SUITE, largeKeys.clientHandshake), TLS_CONTENT_HANDSHAKE, largeKeys.finished, ZERO));
  t.eqI32("and the client that read it finishes the handshake", large.state, TLS_RECORD_STATE_OPEN);

  return t.done();
};
