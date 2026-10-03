// `nish/net/tls-tcp` over loopback, a Nish client against the Nish carrier in
// one readiness loop:
//
//   1. RFC 8448 §3 replayed over a socket: the server is handed the trace's
//      randomness and signature, the client sends the trace's records, and the
//      ServerHello and flight records come back byte for byte. The echo and
//      the server's close_notify are opened under the trace's keys.
//   2. A production handshake: ChaCha20-Poly1305, a P-256 signature the
//      client verifies, the compatibility change_cipher_spec, two hundred
//      echoes with the server's calls moving the arena not at all, KeyUpdate
//      from each side and on the writer's schedule, and a close from the
//      client.
//   3. The pool: three clients at once for two slots, the third shed; two
//      clients that hang up mid-handshake (one cleanly, one with a reset);
//      and every slot free afterwards.
//   4. A signing key that is not one, and the calls a free slot answers.
//
// openssl s_client and curl drive the same server in `serve` mode from the
// `net_tls_tcp` block of tests/run.js.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { TLS_CHACHA20_POLY1305_SHA256, TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_LEVEL_APPLICATION } from "nish/net/tls";
import {
  TLS_CONTENT_ALERT,
  TLS_CONTENT_APPLICATION_DATA,
  TLS_CONTENT_HANDSHAKE,
  TlsRecordProtection,
  tlsNextTrafficSecret,
} from "nish/net/tls/record";
import { TLS_RECORD_DONE, TLS_RECORD_INVALID, TLS_RECORD_STATE_FAILED } from "nish/net/tls/record-server";
import { TlsTcpServer } from "nish/net/tls-tcp";
import { toHex } from "../crypto_x509/hex";
import { rfc8448Config } from "../net_tls_rfc8448/checks";
import { rfc8448ServerApplicationTraffic, rfc8448ServerPrivate, rfc8448ServerRandom } from "../net_tls_rfc8448/trace";
import { leafPublic, tcpConfig } from "../net_tls_common/server";
import { clientFinish } from "../net_tls_common/client";
import {
  rfc8448ApplicationPayload,
  rfc8448ClientAlertRecord,
  rfc8448ClientApplicationRecord,
  rfc8448ClientFinishedRecord,
  rfc8448ClientHelloRecord,
  rfc8448ServerFlightRecord,
  rfc8448ServerHelloRecord,
} from "../net_tls_record_rfc8448/records";
import { Opened, ZERO, ascii, filled, join, keyUpdateMessage, openOne, protectionFor, range, sealOne } from "../net_tls_record_common/bytes";
import { clearRecord, clientKeysFor, recordHello } from "../net_tls_record_common/client";
import { Loopback, SIGN_BROKEN, SIGN_LEAF, SIGN_TRACE } from "./harness";

/** The next whole record client `index` receives, header and all; empty on a timeout or the end of its stream. */
const nextRecord = (lb: Loopback, index: i32): u8[] => {
  const none: u8[] = [];
  if (!lb.awaitBytes(index, toI32(5))) {
    return none;
  }
  const got: u8[] = lb.peers[index].got;
  const length: i32 = (toI32(got[3]) << 8) | toI32(got[4]);
  if (!lb.awaitBytes(index, 5 + length)) {
    return none;
  }
  return lb.peers[index].take(5 + length);
};

/** The record's body: what follows its five-byte header. */
const bodyOf = (record: u8[]): u8[] => range(record, 5, toI32(record.length));

/** An opened record as "type content", or its alert. */
const shown = (o: Opened): string => (o.alert !== 0 ? `alert ${o.alert}` : `${o.type} ${toHex(o.content)}`);

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/net_tls_record_tcp_f64` runs the same checks under
 * `--number-mode f64`.
 */
export const tcpChecks = (): i32 => {
  const t = new Suite("tls over tcp");

  // --- 1. RFC 8448 §3 over a socket ---------------------------------------------
  const trace = new Loopback(rfc8448Config(), 2, SIGN_TRACE);
  t.eqI32("accept with no connection waiting answers -11", trace.server.accept(rfc8448ServerRandom(), rfc8448ServerPrivate()), toI32(-11));
  const a: i32 = trace.connect();
  t.eqI32("a Nish client connects through the loop", a, ZERO);
  trace.send(a, rfc8448ClientHelloRecord());
  t.eqStr("{server} the ServerHello record arrives byte for byte", toHex(nextRecord(trace, a)), toHex(rfc8448ServerHelloRecord()));
  t.eqStr("{server} and the 679-byte flight record, byte for byte", toHex(nextRecord(trace, a)), toHex(rfc8448ServerFlightRecord()));
  trace.send(a, join([rfc8448ClientFinishedRecord(), rfc8448ClientApplicationRecord()]));
  const traceReader: TlsRecordProtection = protectionFor(TLS_AES_128_GCM_SHA256, rfc8448ServerApplicationTraffic());
  t.eqStr(
    "the client's Finished and data in one write: the fifty bytes come back under the trace's server keys",
    shown(openOne(traceReader, nextRecord(trace, a))),
    `23 ${toHex(rfc8448ApplicationPayload())}`
  );
  trace.send(a, rfc8448ClientAlertRecord());
  t.eqStr("the client's close_notify is answered with the server's", shown(openOne(traceReader, nextRecord(trace, a))), "21 0100");
  t.ok("and the server closes the socket", trace.awaitEnd(a) && toI32(trace.peers[a].got.length) === 0);
  t.ok("leaving its slot free", trace.server.busy() === 0 && trace.closed === 1);
  t.eqStr("with nothing gone wrong in the loop", trace.failure, "");
  trace.shutdown();

  // --- 2. A production handshake, data, KeyUpdate ----------------------------------
  const suite: i32 = TLS_CHACHA20_POLY1305_SHA256;
  const lb = new Loopback(tcpConfig([]), 2, SIGN_LEAF);
  const b: i32 = lb.connect();
  const hello: u8[] = recordHello([suite], true, false);
  lb.send(b, clearRecord(hello));
  const serverHello: u8[] = nextRecord(lb, b);
  t.eqI32("ChaCha20: the ServerHello comes in the clear", toI32(serverHello[0]), toI32(22));
  t.eqStr("then the compatibility change_cipher_spec, for the client's session id", toHex(nextRecord(lb, b)), "140303000101");
  const keys = clientKeysFor(32, hello, bodyOf(serverHello));
  const flight: Opened = openOne(protectionFor(suite, keys.serverHandshake), nextRecord(lb, b));
  const view = clientFinish(32, hello, bodyOf(serverHello), flight.content, leafPublic());
  t.ok("the flight opens, its P-256 CertificateVerify verifies, and so does its Finished", view.signatureVerifies && view.serverFinishedVerifies);
  keys.finishWith(flight.content);
  const write: TlsRecordProtection = protectionFor(suite, keys.clientApplication);
  const read: TlsRecordProtection = protectionFor(suite, keys.serverApplication);
  const ccs: u8[] = [toU8(20), toU8(3), toU8(3), toU8(0), toU8(1), toU8(1)];
  lb.send(b, join([ccs, sealOne(protectionFor(suite, keys.clientHandshake), TLS_CONTENT_HANDSHAKE, keys.finished, ZERO), sealOne(write, TLS_CONTENT_APPLICATION_DATA, ascii("ping"), ZERO)]));
  t.eqStr("its change_cipher_spec, Finished and first data in one write, echoed", shown(openOne(read, nextRecord(lb, b))), `23 ${toHex(ascii("ping"))}`);
  t.eqI32("a writable socket with nothing to send: the connection only wants to read", lb.server.writable(ZERO), toI32(1));

  lb.measuring = true;
  let intact: i32 = 0;
  for (let k: i32 = 0; k < 200; k++) {
    const message: u8[] = ascii(`message ${k} of two hundred`);
    lb.send(b, sealOne(write, TLS_CONTENT_APPLICATION_DATA, message, ZERO));
    const back: Opened = openOne(read, nextRecord(lb, b));
    if (back.type === TLS_CONTENT_APPLICATION_DATA && toHex(back.content) === toHex(message)) {
      intact = intact + 1;
    }
  }
  lb.measuring = false;
  t.eqI32("two hundred echoes come back intact", intact, toI32(200));
  t.ok(`and the server's calls moved the arena not at all (${lb.growth} bytes)`, lb.growth === toI64(0));

  lb.send(b, sealOne(write, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(1), ZERO));
  const clientNext: u8[] = tlsNextTrafficSecret(32, keys.clientApplication);
  write.install(suite, clientNext);
  lb.send(b, sealOne(write, TLS_CONTENT_APPLICATION_DATA, ascii("after"), ZERO));
  t.eqStr("the client's KeyUpdate asking for one is answered under the server's old keys", shown(openOne(read, nextRecord(lb, b))), "22 1800000100");
  const serverNext: u8[] = tlsNextTrafficSecret(32, keys.serverApplication);
  read.install(suite, serverNext);
  t.eqStr("and data under the client's next keys is echoed under the server's", shown(openOne(read, nextRecord(lb, b))), `23 ${toHex(ascii("after"))}`);

  t.eqI32("the program asks for a KeyUpdate of its own, wanting one back", lb.server.keyUpdate(ZERO, true), ZERO);
  t.eqStr("it arrives asking", shown(openOne(read, nextRecord(lb, b))), "22 1800000101");
  const serverThird: u8[] = tlsNextTrafficSecret(32, serverNext);
  read.install(suite, serverThird);
  lb.send(b, sealOne(write, TLS_CONTENT_HANDSHAKE, keyUpdateMessage(0), ZERO));
  write.install(suite, tlsNextTrafficSecret(32, clientNext));
  lb.send(b, sealOne(write, TLS_CONTENT_APPLICATION_DATA, ascii("again"), ZERO));
  t.eqStr("both sides move on, and the echo follows", shown(openOne(read, nextRecord(lb, b))), `23 ${toHex(ascii("again"))}`);

  const writer: TlsRecordProtection = lb.server.connection(ZERO).writeProtection;
  writer.recordLimit = writer.sequence + toI64(1);
  lb.send(b, sealOne(write, TLS_CONTENT_APPLICATION_DATA, ascii("x1"), ZERO));
  t.eqStr("the last record the key may protect", shown(openOne(read, nextRecord(lb, b))), `23 ${toHex(ascii("x1"))}`);
  lb.send(b, sealOne(write, TLS_CONTENT_APPLICATION_DATA, ascii("x2"), ZERO));
  t.eqStr("the next is preceded by the writer's own KeyUpdate", shown(openOne(read, nextRecord(lb, b))), "22 1800000100");
  read.install(suite, tlsNextTrafficSecret(32, serverThird));
  t.eqStr("and comes under the next key", shown(openOne(read, nextRecord(lb, b))), `23 ${toHex(ascii("x2"))}`);

  t.eqI32("the program shuts the connection down", lb.server.shutdown(ZERO), TLS_RECORD_DONE);
  t.eqStr("the client reads the server's close_notify", shown(openOne(read, nextRecord(lb, b))), "21 0100");
  lb.serve(ZERO, toI32(2));
  t.ok("and, once it is done, the program closes the socket", lb.awaitEnd(b) && lb.server.busy() === 0);

  // --- 3. The pool -------------------------------------------------------------------
  const c: i32 = lb.connect();
  const d: i32 = lb.connect();
  const e: i32 = lb.connect();
  t.ok("a third client at once for two slots is accepted and shed", lb.awaitEnd(e) && lb.refused === 1 && toI32(lb.peers[e].got.length) === 0);
  t.eqI32("the first two hold both slots, the first reused", lb.server.busy(), toI32(2));
  lb.hangUp(c);
  lb.hangUp(d);
  t.ok("two clients that hang up without a word are closed: the stream was cut short", lb.awaitClosed(toI32(3)) && lb.server.busy() === 0);

  const f: i32 = lb.connect();
  lb.send(f, clearRecord(recordHello([suite], false, false)));
  lb.mute(f);
  let rounds: i32 = 0;
  while (lb.server.connection(ZERO).writeLevel !== TLS_LEVEL_APPLICATION && rounds < 50 && lb.failure === "") {
    lb.step(toI32(-1));
    rounds = rounds + 1;
  }
  lb.hangUp(f);
  t.ok("a client that resets the connection mid-handshake is closed", lb.awaitClosed(toI32(4)) && lb.server.busy() === 0);
  const reset = lb.server.connection(ZERO);
  t.ok("as a socket failure, not as a cut stream, and with nothing sent", reset.state === TLS_RECORD_STATE_FAILED && !reset.ended && reset.alert === 0);
  t.eqI32("every connection was accepted into a slot but the one shed", lb.accepted, toI32(4));
  t.eqI32("each accept copied the key into its slot and wiped the one buffer the program refills", lb.keysWiped, toI32(4));

  // Two handshakes pending at once, their randoms drawn into the one buffer:
  // each ServerHello must carry the random its own accept was handed.
  const p: i32 = lb.connect();
  const q: i32 = lb.connect();
  lb.send(p, clearRecord(recordHello([suite], false, false)));
  lb.send(q, clearRecord(recordHello([suite], false, false)));
  const helloP: u8[] = nextRecord(lb, p);
  const helloQ: u8[] = nextRecord(lb, q);
  // The random follows the record header (5), the message header (4) and the version (2).
  const randomP: u8[] = range(helloP, toI32(11), toI32(43));
  const randomQ: u8[] = range(helloQ, toI32(11), toI32(43));
  t.ok(
    "two pending handshakes whose randoms the program drew into one buffer each send their own (the slot keeps a copy)",
    toHex(randomP) === toHex(filled(32, toI32(0x44))) && toHex(randomQ) === toHex(filled(32, toI32(0x45)))
  );
  lb.hangUp(p);
  lb.hangUp(q);
  t.ok("and both are closed when their clients hang up", lb.awaitClosed(toI32(6)) && lb.server.busy() === 0);

  const shortRandom: u8[] = filled(31, 7);
  const fullKey: u8[] = filled(32, 9);
  t.ok(
    "a random of 31 bytes is refused with -22 before any connection is taken, and both arrays are left as they were",
    lb.server.accept(shortRandom, fullKey) === TLS_RECORD_INVALID && toHex(fullKey) === toHex(filled(32, 9)) && toHex(shortRandom) === toHex(filled(31, 7))
  );
  const fullRandom: u8[] = filled(32, 7);
  const shortKey: u8[] = filled(33, 9);
  t.ok(
    "so is a key of 33 bytes, which stays unwiped",
    lb.server.accept(fullRandom, shortKey) === TLS_RECORD_INVALID && toHex(shortKey) === toHex(filled(33, 9))
  );

  // --- 4. A broken signing key, and a free slot -----------------------------------------
  const free: i32 = 99;
  t.ok(
    "a slot that holds nothing: done to every call, -22 to reads, writes and key updates, no descriptor",
    lb.server.readable(free) === TLS_RECORD_DONE &&
      lb.server.writable(free) === TLS_RECORD_DONE &&
      lb.server.interest(free) === TLS_RECORD_DONE &&
      lb.server.sign(free, ascii("sig")) === TLS_RECORD_DONE &&
      lb.server.read(free, ascii("buf"), ZERO, toI32(3)) === TLS_RECORD_INVALID &&
      lb.server.write(free, ascii("buf"), ZERO, toI32(3)) === TLS_RECORD_INVALID &&
      lb.server.keyUpdate(free, false) === TLS_RECORD_INVALID &&
      lb.server.signatureInput(free) === null &&
      lb.server.fd(free) === -1 &&
      !lb.server.holds(toI32(-1))
  );
  const key: Secret<u8[]> = secret(ascii("not a key"));
  t.eqI32("and signing on one answers done", lb.server.signP256(free, key), TLS_RECORD_DONE);
  wipe(key);
  lb.server.close(free);
  t.ok("closing it does nothing; a slot out of range names the first", lb.server.connection(free) === lb.server.connection(ZERO) && lb.server.size() === 2);
  t.eqStr("with nothing gone wrong in the loop", lb.failure, "");
  lb.shutdown();

  const orphan = new TlsTcpServer(tcpConfig([]), -1, 0);
  t.ok("a pool of no slots has one; accept on a descriptor that is not a socket answers tcpAccept's -9", orphan.size() === 1 && orphan.accept(filled(32, 1), filled(32, 2)) === -9);

  const broken = new Loopback(tcpConfig([]), 1, SIGN_BROKEN);
  const g: i32 = broken.connect();
  const brokenHello: u8[] = recordHello([suite], false, false);
  broken.send(g, clearRecord(brokenHello));
  const brokenServerHello: u8[] = nextRecord(broken, g);
  t.eqI32("a key that is not a P-256 key: the ServerHello goes out", toI32(brokenServerHello[0]), toI32(22));
  const brokenKeys = clientKeysFor(32, brokenHello, bodyOf(brokenServerHello));
  t.eqStr(
    "then internal_error, under the handshake keys like everything after the ServerHello",
    shown(openOne(protectionFor(suite, brokenKeys.serverHandshake), nextRecord(broken, g))),
    "21 0250"
  );
  t.ok("and the connection is closed", broken.awaitEnd(g) && broken.awaitClosed(toI32(1)));
  t.eqStr("with nothing gone wrong in the loop", broken.failure, "");
  broken.shutdown();

  return t.done();
};
