// HelloRetryRequest (RFC 8446 §4.1.4) and the transcript rule that goes with
// it (§4.4.1). First RFC 8448 §5: its exchange is over secp256r1, so only the
// transcript and the schedule over it can be replayed, and they are — the
// first ClientHello replaced by `message_hash`, then the HelloRetryRequest,
// the second ClientHello and the ServerHello, hashed to the value the trace's
// "tls13 c hs traffic" step prints, and the secrets derived from it.
//
// Then a constructed exchange the server can complete: a client that offers
// x25519 in `supported_groups` but sends only a secp256r1 share gets a
// HelloRetryRequest naming x25519, sends a second ClientHello with the share,
// and finishes. The HelloRetryRequest, the ServerHello and the handshake
// traffic secrets are pinned against an independent model in Python
// (hashlib, hmac and cryptography's X25519, run once for this pull request):
// the server's secrets come out of its own `restartWithMessageHash`, the
// model's out of the concatenation §4.4.1 describes.
//
// Last, the two ways a retry fails: a second ClientHello still without the
// share, and one whose suites no longer allow the suite the retry chose.
import { Suite } from "nish/testing";
import {
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_GROUP_X25519,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
  TLS_VERSION_13,
  tlsEncodeHelloRetryRequest,
} from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  TlsTranscript,
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsHandshakeSecret,
} from "nish/net/tls/schedule";
import {
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_FAILED,
  TLS_STATE_WAIT_CLIENT_HELLO,
  TlsServer,
} from "nish/net/tls";
import {
  ClientView,
  GROUP_SECP256R1,
  ascii,
  cat,
  clientFinish,
  clientHello,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  sendHandshake,
  sendHello,
  transcriptHash,
} from "../net_tls_common/client";
import { toHex } from "../net_tls_common/hex";
import { leafPublic, newServer, signWithLeaf, tcpConfig } from "../net_tls_common/server";
import {
  rfc8448RetryClientHandshakeTraffic,
  rfc8448RetryClientHello1,
  rfc8448RetryClientHello2,
  rfc8448RetryEcdhe,
  rfc8448RetryHandshakeSecret,
  rfc8448RetryHelloHash,
  rfc8448RetryHelloRetryRequest,
  rfc8448RetryServerHandshakeTraffic,
  rfc8448RetryServerHello,
} from "./trace";

/** A secp256r1 share the server never reads: 0x04 then 64 bytes of 0x11. */
const secpShare = (): u8[] => {
  const out: u8[] = [toU8(4)];
  for (let k: i32 = 0; k < 64; k++) {
    out.push(toU8(0x11));
  }
  return out;
};

/** A ClientHello offering `suites`, groups secp256r1 and x25519, and shares for `shareGroups` only. */
const retryHello = (suites: i32[], shareGroups: i32[]): u8[] => {
  const keys: u8[][] = [];
  for (const group of shareGroups) {
    keys.push(group === TLS_GROUP_X25519 ? clientShare() : secpShare());
  }
  return clientHello(suites, [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([GROUP_SECP256R1, TLS_GROUP_X25519]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256]),
    extKeyShare(shareGroups, keys),
  ]);
};

/** The synthetic `message_hash` message for a SHA-256 transcript: type 254, length 32, Hash(ClientHello1). */
const messageHash = (clientHello1: u8[]): u8[] => {
  const h: i32 = 32;
  return cat([[toU8(254), toU8(0), toU8(0), toU8(32)], transcriptHash(h, clientHello1)]);
};

/** Runs every check and answers the exit code. */
export const retryChecks = (): i32 => {
  const t = new Suite("tls hello retry");
  const zero: i32 = 0;
  const h: i32 = 32;
  const alpn: string[] = [];

  // --- RFC 8448 §5: the transcript rule and the schedule over it -----------
  const transcript = new TlsTranscript(h);
  const first: u8[] = rfc8448RetryClientHello1();
  transcript.update(first, zero, toI32(first.length));
  transcript.restartWithMessageHash();
  const rest: u8[][] = [rfc8448RetryHelloRetryRequest(), rfc8448RetryClientHello2(), rfc8448RetryServerHello()];
  for (const m of rest) {
    transcript.update(m, zero, toI32(m.length));
  }
  t.eqStr(
    "RFC 8448 §5: message_hash(CH1), HRR, CH2, SH hash to the trace's value",
    toHex(transcript.hash()),
    toHex(rfc8448RetryHelloHash())
  );
  const handshake: u8[] = tlsHandshakeSecret(h, tlsEarlySecret(h), rfc8448RetryEcdhe());
  t.eqStr('RFC 8448 §5: extract secret "handshake"', toHex(handshake), toHex(rfc8448RetryHandshakeSecret()));
  t.eqStr(
    'RFC 8448 §5: derive secret "tls13 c hs traffic" over that transcript',
    toHex(tlsDeriveSecret(h, handshake, "c hs traffic", transcript.hash())),
    toHex(rfc8448RetryClientHandshakeTraffic())
  );
  t.eqStr(
    'RFC 8448 §5: derive secret "tls13 s hs traffic" over that transcript',
    toHex(tlsDeriveSecret(h, handshake, "s hs traffic", transcript.hash())),
    toHex(rfc8448RetryServerHandshakeTraffic())
  );
  // A SHA-384 transcript's message_hash says 48: the header carries HashLen.
  const transcript384 = new TlsTranscript(toI32(48));
  transcript384.update(first, zero, toI32(first.length));
  transcript384.restartWithMessageHash();
  t.eqStr(
    "a SHA-384 transcript restarts as message_hash with a length of 48",
    toHex(transcript384.hash()),
    toHex(transcriptHash(toI32(48), cat([[toU8(254), toU8(0), toU8(0), toU8(48)], transcriptHash(toI32(48), first)])))
  );

  // --- A constructed exchange the server completes --------------------------
  const server: TlsServer = newServer(tcpConfig(alpn));
  const hello1: u8[] = retryHello([TLS_AES_128_GCM_SHA256], [GROUP_SECP256R1]);
  t.eqI32("a ClientHello with no x25519 share is answered, not refused", sendHello(server, hello1), zero);
  t.eqI32("the server waits for a second ClientHello", server.state, TLS_STATE_WAIT_CLIENT_HELLO);
  t.ok("and remembers that it retried", server.retried);
  const retry: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  t.eqStr(
    "the HelloRetryRequest: the fixed random, the suite, key_share naming x25519, TLS 1.3 (checked against Python)",
    toHex(retry),
    "020000340303cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c00130100000c00330002001d002b00020304"
  );
  const none: u8[] = [];
  t.eqStr(
    "tlsEncodeHelloRetryRequest writes the same bytes",
    toHex(tlsEncodeHelloRetryRequest(none, TLS_AES_128_GCM_SHA256, TLS_GROUP_X25519)),
    toHex(retry)
  );
  t.eqStr("nothing at the Handshake level yet", toHex(server.takeOutput(TLS_LEVEL_HANDSHAKE)), "");
  t.eqStr("and no secrets", toHex(server.readSecret(TLS_LEVEL_HANDSHAKE)), "null");

  const hello2: u8[] = retryHello([TLS_AES_128_GCM_SHA256], [GROUP_SECP256R1, TLS_GROUP_X25519]);
  t.eqI32("the second ClientHello, with the share, is accepted", sendHello(server, hello2), zero);
  t.eqI32("and signed", signWithLeaf(server), zero);
  const initial: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
  t.eqStr(
    "the ServerHello (checked against Python)",
    toHex(initial),
    "020000560303a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf00130100002e00330024001d0020de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f002b00020304"
  );
  t.eqStr(
    "client_handshake_traffic_secret over message_hash, HRR, CH2, SH (checked against Python)",
    toHex(server.readSecret(TLS_LEVEL_HANDSHAKE)),
    "5f8007866dc228ced9b5c708f8df0fbc4e34c9e3ca0389afb73a2e0fdb33491d"
  );
  t.eqStr(
    "server_handshake_traffic_secret likewise (checked against Python)",
    toHex(server.writeSecret(TLS_LEVEL_HANDSHAKE)),
    "096d79660af841d713ac9ba26c7433fddae7deea2392cd0c3ef0fc851e2fb98c"
  );
  const before: u8[] = cat([messageHash(hello1), retry, hello2]);
  const view: ClientView = clientFinish(h, before, initial, server.takeOutput(TLS_LEVEL_HANDSHAKE), leafPublic());
  t.ok("the client verifies the signature over the retried transcript", view.signatureVerifies);
  t.ok("and the server's Finished", view.serverFinishedVerifies);
  t.eqI32("the server takes the client's Finished", sendHandshake(server, view.clientFinished), zero);
  t.eqI32("connected after one retry", server.state, TLS_STATE_CONNECTED);

  // --- A second miss is fatal -----------------------------------------------
  const twice: TlsServer = newServer(tcpConfig(alpn));
  sendHello(twice, retryHello([TLS_AES_128_GCM_SHA256], [GROUP_SECP256R1]));
  twice.takeOutput(TLS_LEVEL_INITIAL);
  t.eqI32(
    "a second ClientHello still without the x25519 share is illegal_parameter",
    sendHello(twice, retryHello([TLS_AES_128_GCM_SHA256], [GROUP_SECP256R1])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32("and the server has failed", twice.state, TLS_STATE_FAILED);
  t.eqStr("without writing a second HelloRetryRequest", toHex(twice.takeOutput(TLS_LEVEL_INITIAL)), "");

  // --- The suite the retry chose must still be allowed ----------------------
  const moved: TlsServer = newServer(tcpConfig(alpn));
  sendHello(moved, retryHello([TLS_AES_128_GCM_SHA256], [GROUP_SECP256R1]));
  t.eqI32(
    "a second ClientHello whose suites no longer allow the chosen one is illegal_parameter",
    sendHello(moved, retryHello([TLS_AES_256_GCM_SHA384], [TLS_GROUP_X25519])),
    TLS_ALERT_ILLEGAL_PARAMETER
  );

  // §4.1.3: the HelloRetryRequest random is SHA-256 of "HelloRetryRequest".
  const random: u8[] = [];
  for (let k: i32 = 6; k < 38 && k < toI32(retry.length); k++) {
    random.push(retry[k]);
  }
  t.eqStr(
    "the HelloRetryRequest's random is SHA-256 of \"HelloRetryRequest\"",
    toHex(random),
    toHex(transcriptHash(h, ascii("HelloRetryRequest")))
  );
  return t.done();
};
