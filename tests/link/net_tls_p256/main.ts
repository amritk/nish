// secp256r1 on the TLS 1.3 server (`nish/net/tls`): the group it takes from a
// client that sends no x25519 share, directly from that client's share or
// through a HelloRetryRequest asking for one, and the shares it refuses — a
// point off the curve, one of the wrong length, a compressed one and one with
// the wrong prefix — with `illegal_parameter`.
// The direct case is a whole handshake against `nish/net/tls/client`, whose
// traffic secrets must agree with the server's. The retried one runs to both
// Finished too, against the client half in `retry.ts`, which keeps its own
// transcript: both application secrets must agree, and a record crosses each
// way under them. Last, what a retry does not allow: a second ClientHello
// without the share it asked for, and a second HelloRetryRequest.
import { Suite } from "nish/testing";
import { p256PublicKey } from "nish/crypto/p256";
import { secret, Secret, wipe } from "nish:secret";
import {
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_VERSION_13,
  tlsEncodeHelloRetryRequest,
} from "nish/net/tls/codec";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import {
  TLS_CONTENT_APPLICATION_DATA,
  TLS_RECORD_HEADER_SIZE,
  TLS_RECORD_TAG_SIZE,
  TlsRecordProtection,
} from "nish/net/tls/record";
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_FAILED,
  TLS_STATE_WAIT_CLIENT_HELLO,
  TlsServer,
} from "nish/net/tls";
import {
  TLS_CLIENT_STATE_CONNECTED,
  TLS_CLIENT_STATE_FAILED,
  TlsClient,
  TlsClientConfig,
} from "nish/net/tls/client";
import {
  cat,
  clientHello,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  sendHandshake,
  sendHello,
} from "../net_tls_common/client";
import { bytesOf, textOf, toHex } from "../crypto_x509/hex";
import { secretHex } from "../net_tls_common/secrets";
import { leafPublic, newServer, signWithLeaf, tcpConfig } from "../net_tls_common/server";
import { RetryView, messageHash, retryFinish } from "./retry";

const bytes = (start: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

/** A valid secp256r1 share: the public point of the scalar 1, 2, ... 32. */
const p256Share = (): u8[] => {
  const key: Secret<u8[]> = secret(bytes(1));
  const point: u8[] | null = p256PublicKey(key);
  wipe(key);
  if (point === null) {
    return [];
  }
  return point;
};

/** A share the size of a point that is not on the curve: 0x04 then 64 bytes of 0x11. */
const offCurve = (): u8[] => {
  const out: u8[] = [toU8(4)];
  for (let k: i32 = 0; k < 64; k++) {
    out.push(toU8(0x11));
  }
  return out;
};

/** `length` bytes: `prefix`, then 0x11 for the rest. */
const filled = (prefix: i32, length: i32): u8[] => {
  const out: u8[] = [toU8(prefix)];
  for (let k: i32 = 1; k < length; k++) {
    out.push(toU8(0x11));
  }
  return out;
};

/** A ClientHello listing `groups` and sharing `keys` for `shareGroups`. */
const hello = (groups: i32[], shareGroups: i32[], keys: u8[][]): u8[] =>
  clientHello(
    [TLS_AES_128_GCM_SHA256],
    [
      extSupportedVersions([TLS_VERSION_13]),
      extSupportedGroups(groups),
      extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      extKeyShare(shareGroups, keys),
    ]
  );

/** What a fresh server answers `message` with. */
const refusal = (message: u8[]): i32 => sendHello(newServer(tcpConfig([])), message);

/** What `opened` answers for a record the protection refuses. */
const REFUSED: string = "refused";

/** `text` as one application-data record under `writer`; empty if it would not seal. */
const sealed = (writer: TlsRecordProtection, text: string): u8[] => {
  const zero: i32 = 0;
  const data: u8[] = bytesOf(text);
  const length: i32 = toI32(data.length);
  // The header, the content, its inner type byte and the tag (RFC 8446 §5.2).
  const record: u8[] = new Array<u8>(TLS_RECORD_HEADER_SIZE + length + 1 + TLS_RECORD_TAG_SIZE);
  if (writer.seal(TLS_CONTENT_APPLICATION_DATA, data, zero, length, zero, record, zero) !== toI32(record.length)) {
    return [];
  }
  return record;
};

/** The text of the application-data record `record` under `reader`, or `REFUSED`. */
const opened = (reader: TlsRecordProtection, record: u8[]): string => {
  const zero: i32 = 0;
  const content: u8[] = new Array<u8>(toI32(record.length));
  const length: i32 = reader.open(record, zero, toI32(record.length), content, zero);
  if (length < 0 || reader.contentType !== TLS_CONTENT_APPLICATION_DATA) {
    return REFUSED;
  }
  const out: u8[] = [];
  for (let k: i32 = 0; k < length; k++) {
    out.push(content[k]);
  }
  return textOf(out);
};

export const main = (): i32 => {
  const t = new Suite("tls p256");
  const zero: i32 = 0;
  const none: u8[][] = [];
  const noGroups: i32[] = [];
  const p256Only: i32[] = [TLS_GROUP_SECP256R1];

  // --- A client that offers only secp256r1, end to end ----------------------
  const config = new TlsClientConfig("localhost", ["h2"]);
  config.groups = [TLS_GROUP_SECP256R1];
  config.shareGroup = TLS_GROUP_SECP256R1;
  const server: TlsServer = newServer(tcpConfig(["h2"]));
  const client = new TlsClient(config, bytes(1), bytes(0x40), bytes(0x60));
  t.eqI32("a secp256r1-only client starts", client.start(), zero);
  const ch: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32("the server takes its ClientHello", server.receive(TLS_LEVEL_INITIAL, ch, zero, toI32(ch.length)), zero);
  t.eqI32("and selects secp256r1", server.group, TLS_GROUP_SECP256R1);
  const sh: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  t.contains("its ServerHello's key_share is secp256r1 with a 65-byte point", toHex(sh), "0033004500170041");
  t.eqI32("the server signs", signWithLeaf(server), zero);
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the client reads the ServerHello", client.receive(TLS_LEVEL_INITIAL, sh, zero, toI32(sh.length)), zero);
  t.eqI32("and the flight", client.receive(TLS_LEVEL_HANDSHAKE, flight, zero, toI32(flight.length)), zero);
  t.eqI32("the client authenticates", client.authenticate(true), zero);
  t.eqI32("the client is connected", client.state, TLS_CLIENT_STATE_CONNECTED);
  const fin: u8[] = client.takeOutput(TLS_LEVEL_HANDSHAKE);
  t.eqI32("the server reads Finished", server.receive(TLS_LEVEL_HANDSHAKE, fin, zero, toI32(fin.length)), zero);
  t.eqI32("the server is connected", server.state, TLS_STATE_CONNECTED);
  t.eqStr(
    "both sides derive the same client traffic secret",
    secretHex(client.secrets().clientApplication),
    secretHex(server.secrets().clientApplication)
  );
  t.eqStr(
    "and the same server traffic secret",
    secretHex(client.secrets().serverApplication),
    secretHex(server.secrets().serverApplication)
  );
  t.eqI32("nothing is left at the application level", toI32(server.takeOutput(TLS_LEVEL_APPLICATION).length), zero);

  // --- x25519 first ---------------------------------------------------------
  const both = newServer(tcpConfig([]));
  t.eqI32(
    "a client listing both groups and sharing both is answered",
    sendHello(both, hello([TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [p256Share(), clientShare()])),
    zero
  );
  t.eqI32("over x25519, the server's preference", both.group, TLS_GROUP_X25519);
  const bothGroups: i32[] = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  const p256Shared = newServer(tcpConfig([]));
  t.eqI32(
    "a client listing both groups and sharing only secp256r1 gets an answer",
    sendHello(p256Shared, hello(bothGroups, p256Only, [p256Share()])),
    zero
  );
  t.ok("a HelloRetryRequest, since x25519 is listed", p256Shared.retried);
  t.contains("whose key_share names x25519", toHex(p256Shared.takeOutput(TLS_LEVEL_INITIAL)), "00330002001d");
  const neither = newServer(tcpConfig([]));
  t.eqI32("a client listing both groups and sharing neither gets an answer", sendHello(neither, hello(bothGroups, noGroups, none)), zero);
  t.contains("a HelloRetryRequest whose key_share names x25519", toHex(neither.takeOutput(TLS_LEVEL_INITIAL)), "00330002001d");

  // --- A HelloRetryRequest for secp256r1, to both Finished ------------------
  const retry = newServer(tcpConfig([]));
  const hello1: u8[] = hello(p256Only, noGroups, none);
  t.eqI32("a secp256r1-only client with no share gets an answer", sendHello(retry, hello1), zero);
  t.ok("a HelloRetryRequest, which the server remembers", retry.retried);
  t.eqI32("and it waits for a second ClientHello", retry.state, TLS_STATE_WAIT_CLIENT_HELLO);
  const hrr: u8[] = retry.takeOutput(TLS_LEVEL_INITIAL);
  t.contains("a HelloRetryRequest whose key_share names secp256r1", toHex(hrr), "003300020017");
  const hello2: u8[] = hello(p256Only, p256Only, [p256Share()]);
  t.eqI32("the second ClientHello, with a secp256r1 share, is answered", sendHello(retry, hello2), zero);
  t.eqI32("over secp256r1", retry.group, TLS_GROUP_SECP256R1);
  const retrySh: u8[] = retry.takeOutput(TLS_LEVEL_INITIAL);
  t.contains("with a ServerHello sharing a 65-byte point", toHex(retrySh), "0033004500170041");
  t.eqI32("and it signs", signWithLeaf(retry), zero);
  // The client's transcript is its own: message_hash(ClientHello1), the
  // HelloRetryRequest and the second ClientHello, concatenated (§4.4.1).
  const view: RetryView = retryFinish(
    bytes(1),
    cat([messageHash(hello1), hrr, hello2]),
    retrySh,
    retry.takeOutput(TLS_LEVEL_HANDSHAKE),
    leafPublic()
  );
  t.ok("the client shares a secret with it and reads a whole flight", view.complete);
  t.ok("the client verifies the signature over the retried transcript", view.signatureVerifies);
  t.ok("and the server's Finished", view.serverFinishedVerifies);
  t.eqI32("the server takes the client's Finished", sendHandshake(retry, view.clientFinished), zero);
  t.eqI32("and is connected after one retry", retry.state, TLS_STATE_CONNECTED);
  t.eqStr(
    "both sides of the retried handshake derive the same client traffic secret",
    toHex(view.clientApplication),
    secretHex(retry.secrets().clientApplication)
  );
  t.eqStr(
    "and the same server traffic secret",
    toHex(view.serverApplication),
    secretHex(retry.secrets().serverApplication)
  );
  t.ok("which are two secrets, not one", toHex(view.clientApplication) !== toHex(view.serverApplication));
  // One record each way: sealed under one side's secret, opened under the other's.
  const clientWrites = new TlsRecordProtection();
  const serverReads = new TlsRecordProtection();
  const serverWrites = new TlsRecordProtection();
  const clientReads = new TlsRecordProtection();
  t.ok(
    "each direction takes its key from its own side's secret",
    clientWrites.install(TLS_AES_128_GCM_SHA256, view.clientApplication) &&
      serverReads.installHeld(TLS_AES_128_GCM_SHA256, retry.secrets().clientApplication) &&
      serverWrites.installHeld(TLS_AES_128_GCM_SHA256, retry.secrets().serverApplication) &&
      clientReads.install(TLS_AES_128_GCM_SHA256, view.serverApplication)
  );
  const ping: u8[] = sealed(clientWrites, "ping");
  t.eqStr("the server opens the client's record", opened(serverReads, ping), "ping");
  t.eqStr("the client opens the server's record", opened(clientReads, sealed(serverWrites, "pong")), "pong");
  const wrongWay = new TlsRecordProtection();
  wrongWay.installHeld(TLS_AES_128_GCM_SHA256, retry.secrets().serverApplication);
  t.eqStr("a record opened under the other direction's secret is refused", opened(wrongWay, ping), REFUSED);

  // --- What a retry does not allow ------------------------------------------
  const again = newServer(tcpConfig([]));
  sendHello(again, hello(p256Only, noGroups, none));
  again.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32(
    "a second ClientHello still without a secp256r1 share is illegal_parameter",
    sendHello(again, hello([TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [TLS_GROUP_X25519], [clientShare()])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32("and the server has failed", again.state, TLS_STATE_FAILED);
  t.eqI32("without writing a second HelloRetryRequest", toI32(again.takeOutput(TLS_LEVEL_INITIAL).length), zero);
  const unlisted = newServer(tcpConfig([]));
  sendHello(unlisted, hello(p256Only, noGroups, none));
  t.eqI32(
    "a second ClientHello whose secp256r1 share comes without secp256r1 listed is illegal_parameter",
    sendHello(unlisted, hello([TLS_GROUP_X25519], [TLS_GROUP_SECP256R1, TLS_GROUP_X25519], [p256Share(), clientShare()])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  // The client's side of the same rule: one HelloRetryRequest to secp256r1 is
  // answered with a secp256r1 share, a second is fatal (§4.1.4).
  const twoGroups = new TlsClientConfig("localhost", []);
  twoGroups.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1];
  const retried = new TlsClient(twoGroups, bytes(1), bytes(0x40), bytes(0x60));
  retried.start();
  retried.takeOutput(TLS_LEVEL_INITIAL);
  const forged: u8[] = tlsEncodeHelloRetryRequest(retried.sessionId, TLS_AES_128_GCM_SHA256, TLS_GROUP_SECP256R1);
  t.eqI32(
    "a client sharing x25519 takes a HelloRetryRequest for secp256r1",
    retried.receive(TLS_LEVEL_INITIAL, forged, zero, toI32(forged.length)),
    zero
  );
  t.contains(
    "and its second ClientHello shares one 65-byte secp256r1 point",
    toHex(retried.takeOutput(TLS_LEVEL_INITIAL)),
    "0033004700450017004104"
  );
  t.eqI32(
    "a second HelloRetryRequest is unexpected_message",
    retried.receive(TLS_LEVEL_INITIAL, forged, zero, toI32(forged.length)),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  t.eqI32("and the client has failed", retried.state, TLS_CLIENT_STATE_FAILED);

  // --- Shares the server refuses --------------------------------------------
  t.eqI32(
    "a secp256r1 share off the curve is illegal_parameter",
    refusal(hello(p256Only, p256Only, [offCurve()])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a 64-byte secp256r1 share is illegal_parameter",
    refusal(hello(p256Only, p256Only, [filled(4, 64)])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a 66-byte secp256r1 share is illegal_parameter",
    refusal(hello(p256Only, p256Only, [cat([p256Share(), [toU8(0)]])])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a 65-byte secp256r1 share whose prefix is not 0x04 is illegal_parameter",
    refusal(hello(p256Only, p256Only, [filled(6, 65)])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a compressed secp256r1 point is illegal_parameter",
    refusal(hello(p256Only, p256Only, [cat([[toU8(2)], bytes(3)])])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "a client listing neither group is handshake_failure",
    refusal(hello([toI32(0x0018)], p256Only, [p256Share()])),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  return t.done();
};
