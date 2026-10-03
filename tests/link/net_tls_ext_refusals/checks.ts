// Every refusal in `nish/net/tls`, each as the alert it answers and never a
// panic: what the configuration or the randomness gets wrong
// (`internal_error`), the carrier handing over bytes at the wrong level or out
// of turn (`unexpected_message`), a ClientHello that does not parse
// (`decode_error`) or parses to something TLS 1.3 forbids, the negotiation
// failing (`protocol_version`, `handshake_failure`, `missing_extension`,
// `illegal_parameter`), the signing hand-off misused (`internal_error`), and
// a client Finished that is the wrong size (`decode_error`) or wrong
// (`decrypt_error`). After a refusal the server stays failed and answers the
// same alert to every call.
import { Suite } from "nish/testing";
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_ALERT_PROTOCOL_VERSION,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_EXT_ALPN,
  TLS_EXT_KEY_SHARE,
  TLS_EXT_PRE_SHARED_KEY,
  TLS_EXT_SERVER_NAME,
  TLS_EXT_SUPPORTED_VERSIONS,
  TLS_GROUP_X25519,
  TLS_LEGACY_VERSION,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
  TLS_VERSION_13,
  TlsClientHello,
  tlsListHas,
  tlsParseClientHello,
} from "nish/net/tls/codec";
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  tlsExpandLabel,
  tlsExtract,
  tlsSuiteHashLength,
  tlsSuiteKeyLength,
  tlsTrafficIv,
  tlsTrafficKey,
} from "nish/net/tls/schedule";
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_MAX_HANDSHAKE_MESSAGE,
  TLS_STATE_CONNECTED,
  TLS_STATE_FAILED,
  TLS_STATE_WAIT_CLIENT_HELLO,
  TlsServer,
  TlsServerConfig,
} from "nish/net/tls";
import {
  ClientView,
  bytesFrom,
  cat,
  clientRandom,
  clientFinish,
  clientHello,
  clientHelloRaw,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  extension,
  sendHandshake,
  sendHello,
  standardExtensions,
  standardWith,
  u16,
  u16List,
  vec16,
  vec24,
  vec8,
} from "../net_tls_common/client";
import { bytesOf, fromHex, toHex } from "../crypto_x509/hex";
import { leafPublic, newServer, quicConfig, serverPrivate, serverRandom, signWithLeaf, tcpConfig } from "../net_tls_common/server";

const SUITE: i32 = TLS_AES_128_GCM_SHA256;

/** A fresh TCP server with no ALPN. */
const fresh = (): TlsServer => {
  const none: string[] = [];
  return newServer(tcpConfig(none));
};

/** A ClientHello offering the one suite with `extensions`. */
const hello = (extensions: u8[][]): u8[] => clientHello([SUITE], extensions);

/** What a fresh server answers to `message` at the Initial level. */
const refusal = (message: u8[]): i32 => sendHello(fresh(), message);

/** A handshake message of `type` around `body`. */
const message = (type: i32, body: u8[]): u8[] => cat([[toU8(type)], vec24(body)]);

/** `bytes` without its last `n` bytes. */
const cut = (bytes: u8[], n: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(bytes.length) - n && k < toI32(bytes.length); k++) {
    out.push(bytes[k]);
  }
  return out;
};

/** A ClientHello body with no extensions block at all, as TLS 1.2 allows. */
const helloWithoutExtensions = (): u8[] => {
  const none: u8[] = [];
  return message(
    1,
    cat([u16(TLS_LEGACY_VERSION), clientRandom(), vec8(none), vec16(u16List([SUITE])), vec8([toU8(0)])])
  );
};

/** A server that has read a ClientHello and signed, waiting for the client's Finished, and the client's view of it. */
class Waiting {
  server: TlsServer;
  view: ClientView;
  constructor() {
    this.server = fresh();
    const h: u8[] = hello(standardExtensions());
    sendHello(this.server, h);
    signWithLeaf(this.server);
    const h32: i32 = 32;
    this.view = clientFinish(
      h32,
      h,
      this.server.takeOutput(TLS_LEVEL_INITIAL),
      this.server.takeOutput(TLS_LEVEL_HANDSHAKE),
      leafPublic()
    );
  }
}

/** Runs every check and answers the exit code. */
export const refusalChecks = (): i32 => {
  const t = new Suite("tls refusals");
  const zero: i32 = 0;
  const one: i32 = 1;
  const none: string[] = [];
  const empty: u8[] = [];
  const good: u8[] = hello(standardExtensions());

  // --- The configuration and the randomness ---------------------------------
  const config: TlsServerConfig = tcpConfig(none);
  const shortRandom = new TlsServer(config, cut(serverRandom(), one), serverPrivate());
  t.eqI32("a 31-byte server random fails the server at once", shortRandom.state, TLS_STATE_FAILED);
  t.eqI32("with internal_error", shortRandom.alert, TLS_ALERT_INTERNAL_ERROR);
  t.eqI32("and every receive answers it", sendHello(shortRandom, good), TLS_ALERT_INTERNAL_ERROR);
  const shortKey = new TlsServer(config, serverRandom(), cut(serverPrivate(), one));
  t.eqI32("a 31-byte x25519 key is internal_error", shortKey.alert, TLS_ALERT_INTERNAL_ERROR);
  const chain: u8[][] = [];
  const noCertificate = new TlsServer(
    {
      certificateChain: chain,
      alpn: none,
      quicTransportParameters: empty,
      extraExtensions: empty,
      signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
      quic: false,
    },
    serverRandom(),
    serverPrivate()
  );
  t.eqI32("an empty certificate chain is internal_error", noCertificate.alert, TLS_ALERT_INTERNAL_ERROR);
  const longName: string[] = [];
  for (let k: i32 = 0; k < 256; k++) {
    longName.push("a");
  }
  t.eqI32(
    "an ALPN protocol of 256 bytes is internal_error",
    newServer(tcpConfig([longName.join("")])).alert,
    TLS_ALERT_INTERNAL_ERROR
  );
  t.eqI32("so is an empty one", newServer(tcpConfig([""])).alert, TLS_ALERT_INTERNAL_ERROR);
  t.eqI32(
    "transport parameters too long for EncryptedExtensions are internal_error",
    newServer(quicConfig(["h3"], new Array<u8>(65536))).alert,
    TLS_ALERT_INTERNAL_ERROR
  );
  const emptyCertificate: u8[][] = [empty];
  t.eqI32(
    "an empty certificate is internal_error",
    new TlsServer(
      {
        certificateChain: emptyCertificate,
        alpn: none,
        quicTransportParameters: empty,
        extraExtensions: empty,
        signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
        quic: false,
      },
      serverRandom(),
      serverPrivate()
    ).alert,
    TLS_ALERT_INTERNAL_ERROR
  );
  t.eqI32("a configuration that fits is not refused", newServer(tcpConfig(["h2"])).alert, zero);

  // --- The carrier ------------------------------------------------------------
  const window: TlsServer = fresh();
  t.eqI32(
    "a window past the end of the buffer is internal_error, not a panic",
    window.receive(TLS_LEVEL_INITIAL, good, one, toI32(good.length)),
    TLS_ALERT_INTERNAL_ERROR
  );
  t.eqI32(
    "so is a negative offset",
    fresh().receive(TLS_LEVEL_INITIAL, good, toI32(-1), toI32(good.length)),
    TLS_ALERT_INTERNAL_ERROR
  );
  const idle: TlsServer = fresh();
  t.eqI32("zero bytes are no message and no refusal", idle.receive(TLS_LEVEL_HANDSHAKE, good, zero, zero), zero);
  t.eqI32("and change nothing", idle.state, TLS_STATE_WAIT_CLIENT_HELLO);
  t.eqI32(
    "a ClientHello at the Handshake level is unexpected_message",
    fresh().receive(TLS_LEVEL_HANDSHAKE, good, zero, toI32(good.length)),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  t.eqI32(
    "so is one at the Application level",
    fresh().receive(TLS_LEVEL_APPLICATION, good, zero, toI32(good.length)),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  t.eqI32(
    "a Finished where the ClientHello belongs is unexpected_message",
    refusal(message(20, fromHex("00000000000000000000000000000000"))),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  t.eqI32(
    "a byte after the ClientHello, in the same flight, is unexpected_message",
    refusal(cat([good, [toU8(1)]])),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  t.eqI32(
    "a header announcing more than TLS_MAX_HANDSHAKE_MESSAGE bytes is decode_error before they arrive",
    refusal(fromHex("01010001")),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32("the cap is 64 KiB", TLS_MAX_HANDSHAKE_MESSAGE, toI32(65536));
  const flood: u8[] = cat([fromHex("0100ffff"), new Array<u8>(70000)]);
  t.eqI32(
    "one call carrying more than a whole maximal message is decode_error before it is copied",
    refusal(flood),
    TLS_ALERT_DECODE_ERROR
  );
  const signing: TlsServer = fresh();
  sendHello(signing, good);
  t.eqI32(
    "bytes while the server waits for its own signature are unexpected_message",
    signing.receive(TLS_LEVEL_HANDSHAKE, good, zero, toI32(good.length)),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );

  // --- A ClientHello that does not parse --------------------------------------
  t.eqI32(
    "a body cut short, so a vector runs past its end, is decode_error",
    refusal(message(1, cut(bytesFrom(good, toI32(4)), toI32(10)))),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "a session id of 33 bytes is decode_error",
    refusal(clientHelloRaw(TLS_LEGACY_VERSION, new Array<u8>(33), [SUITE], [toU8(0)], standardExtensions())),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an odd-length cipher_suites is decode_error",
    refusal(
      message(
        1,
        cat([u16(TLS_LEGACY_VERSION), clientRandom(), vec8(empty), vec16([toU8(0x13), toU8(0x01), toU8(0x13)]), vec8([toU8(0)]), vec16(cat(standardExtensions()))])
      )
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an empty cipher_suites is decode_error",
    refusal(clientHelloRaw(TLS_LEGACY_VERSION, empty, [], [toU8(0)], standardExtensions())),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an empty supported_versions list is decode_error",
    refusal(
      hello([
        extension(TLS_EXT_SUPPORTED_VERSIONS, vec8(empty)),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an extension with a byte after its contents is decode_error",
    refusal(
      hello([
        extension(TLS_EXT_SUPPORTED_VERSIONS, cat([vec8(u16List([TLS_VERSION_13])), [toU8(0)]])),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "a key_share with a byte after its list is decode_error",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extension(TLS_EXT_KEY_SHARE, cat([vec16(cat([u16(TLS_GROUP_X25519), vec16(clientShare())])), [toU8(0)]])),
      ])
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an ALPN extension with a byte after its list is decode_error",
    refusal(hello(standardWith([extension(TLS_EXT_ALPN, cat([vec16(vec8(bytesOf("h2"))), [toU8(0)]]))]))),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an empty ALPN protocol name is decode_error",
    refusal(hello(standardWith([extension(TLS_EXT_ALPN, vec16(vec8(empty)))]))),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "a server_name with a byte after its list is decode_error",
    refusal(hello(standardWith([extension(TLS_EXT_SERVER_NAME, cat([vec16(cat([[toU8(0)], vec16(bytesOf("a.test"))])), [toU8(0)]]))]))),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "a key share whose length runs past the extension is decode_error",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extension(TLS_EXT_KEY_SHARE, vec16(cat([u16(TLS_GROUP_X25519), u16(toI32(33)), clientShare()]))),
      ])
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an extension running past the extensions vector's declared end is decode_error, though the message's length balances",
    refusal(
      message(
        1,
        cat([
          u16(TLS_LEGACY_VERSION),
          clientRandom(),
          vec8(empty),
          vec16(u16List([SUITE])),
          vec8([toU8(0)]),
          u16(toI32(4)),
          extension(toI32(0xfafa), [toU8(0)]),
        ])
      )
    ),
    TLS_ALERT_DECODE_ERROR
  );
  // A list declared shorter than its last entry, inside an extension whose
  // own length balances: the entry must lie inside the list, not merely inside
  // the extension.
  const share: u8[] = cat([u16(TLS_GROUP_X25519), vec16(clientShare())]);
  t.eqI32(
    "a key_share list declared one byte shorter than its last share is decode_error",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extension(TLS_EXT_KEY_SHARE, cat([u16(toI32(share.length) - 1), share])),
      ])
    ),
    TLS_ALERT_DECODE_ERROR
  );
  const hostEntry: u8[] = cat([[toU8(0)], vec16(bytesOf("a.test"))]);
  t.eqI32(
    "a server_name list declared one byte shorter than its last name is decode_error",
    refusal(hello(standardWith([extension(TLS_EXT_SERVER_NAME, cat([u16(toI32(hostEntry.length) - 1), hostEntry]))]))),
    TLS_ALERT_DECODE_ERROR
  );
  const alpnEntry: u8[] = vec8(bytesOf("h2"));
  t.eqI32(
    "an ALPN list declared one byte shorter than its last name is decode_error",
    refusal(hello(standardWith([extension(TLS_EXT_ALPN, cat([u16(toI32(alpnEntry.length) - 1), alpnEntry]))]))),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "a byte after the extensions block is decode_error",
    refusal(
      message(
        1,
        cat([u16(TLS_LEGACY_VERSION), clientRandom(), vec8(empty), vec16(u16List([SUITE])), vec8([toU8(0)]), vec16(cat(standardExtensions())), [toU8(0)]])
      )
    ),
    TLS_ALERT_DECODE_ERROR
  );
  t.eqI32(
    "an extension sent twice is illegal_parameter",
    refusal(hello(standardWith([extSupportedVersions([TLS_VERSION_13])]))),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "two shares for x25519 are illegal_parameter",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519, TLS_GROUP_X25519], [clientShare(), clientShare()]),
      ])
    ),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  const parsed: TlsClientHello = tlsParseClientHello(good, zero, toI32(good.length) + 1);
  t.eqI32("tlsParseClientHello refuses a window past its buffer with decode_error", parsed.alert, TLS_ALERT_DECODE_ERROR);
  const body: TlsClientHello = tlsParseClientHello(good, toI32(4), toI32(good.length) - 4);
  t.eqI32("and parses the body of a good one", body.alert, zero);
  t.ok("whose groups hold x25519", tlsListHas(body.groups, TLS_GROUP_X25519));

  // --- What TLS 1.3 forbids ---------------------------------------------------
  t.eqI32(
    "a ClientHello with no extensions offers no TLS 1.3: protocol_version",
    refusal(helloWithoutExtensions()),
    TLS_ALERT_PROTOCOL_VERSION
  );
  t.eqI32(
    "a legacy_version of SSL 3.0 is protocol_version (RFC 8446 §D.5)",
    refusal(clientHelloRaw(toI32(0x0300), empty, [SUITE], [toU8(0)], standardExtensions())),
    TLS_ALERT_PROTOCOL_VERSION
  );
  t.eqI32(
    "a legacy_version of TLS 1.0 that offers TLS 1.3 in supported_versions is accepted: §4.2.1 negotiates by that alone",
    refusal(clientHelloRaw(toI32(0x0301), empty, [SUITE], [toU8(0)], standardExtensions())),
    zero
  );
  t.eqI32(
    "supported_versions without TLS 1.3 is protocol_version",
    refusal(
      hello([
        extSupportedVersions([toI32(0x0303)]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_PROTOCOL_VERSION
  );
  t.eqI32(
    "so is a legacy_version of 0x0304",
    refusal(clientHelloRaw(TLS_VERSION_13, empty, [SUITE], [toU8(0)], standardExtensions())),
    zero
  );
  t.eqI32(
    "a pre_shared_key that is not the last extension is illegal_parameter (§4.2.11)",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extension(TLS_EXT_PRE_SHARED_KEY, fromHex("00")),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "last, it is ignored and the handshake goes on without the PSK",
    refusal(hello(standardWith([extension(TLS_EXT_PRE_SHARED_KEY, fromHex("00"))]))),
    zero
  );
  t.eqI32(
    "a compression method other than null is illegal_parameter",
    refusal(clientHelloRaw(TLS_LEGACY_VERSION, empty, [SUITE], [toU8(0), toU8(1)], standardExtensions())),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqI32(
    "no suite in common is handshake_failure",
    refusal(clientHello([toI32(0x1304), toI32(0xc02f)], standardExtensions())),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  t.eqI32(
    "no signature_algorithms is missing_extension",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_MISSING_EXTENSION
  );
  t.eqI32(
    "no supported_groups is missing_extension",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_MISSING_EXTENSION
  );
  t.eqI32(
    "no key_share is missing_extension",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
      ])
    ),
    TLS_ALERT_MISSING_EXTENSION
  );
  t.eqI32(
    "supported_groups without x25519 is handshake_failure",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([toI32(0x0017)]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  t.eqI32(
    "a client that cannot verify ecdsa_secp256r1_sha256 is handshake_failure",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_RSA_PSS_RSAE_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [clientShare()]),
      ])
    ),
    TLS_ALERT_HANDSHAKE_FAILURE
  );
  t.eqI32(
    "a 31-byte x25519 share is illegal_parameter",
    refusal(
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [cut(clientShare(), one)]),
      ])
    ),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  const lowOrder: TlsServer = fresh();
  t.eqI32(
    "a low-order share, whose shared secret is all zeros, is illegal_parameter (RFC 8446 §7.4.2)",
    sendHello(
      lowOrder,
      hello([
        extSupportedVersions([TLS_VERSION_13]),
        extSupportedGroups([TLS_GROUP_X25519]),
        extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256]),
        extKeyShare([TLS_GROUP_X25519], [new Array<u8>(32)]),
      ])
    ),
    TLS_ALERT_ILLEGAL_PARAMETER
  );
  t.eqStr("and no ServerHello is written for it", toHex(lowOrder.takeOutput(TLS_LEVEL_INITIAL)), "");

  // --- The signing hand-off ---------------------------------------------------
  t.eqI32("sign before any ClientHello is internal_error", fresh().sign(fromHex("3006020101020101")), TLS_ALERT_INTERNAL_ERROR);
  const emptySignature: TlsServer = fresh();
  sendHello(emptySignature, good);
  t.eqI32("an empty signature is internal_error", emptySignature.sign(empty), TLS_ALERT_INTERNAL_ERROR);
  const longSignature: TlsServer = fresh();
  sendHello(longSignature, good);
  t.eqI32(
    "a signature longer than 65535 bytes is internal_error",
    longSignature.sign(new Array<u8>(65536)),
    TLS_ALERT_INTERNAL_ERROR
  );
  t.eqI32("a failed server answers sign with its alert", longSignature.sign(empty), TLS_ALERT_INTERNAL_ERROR);
  t.eqStr("and has no signature input", toHex(longSignature.signatureInput()), "null");

  // --- The client's Finished ---------------------------------------------------
  const short = new Waiting();
  t.eqI32(
    "a Finished of 31 bytes is decode_error",
    sendHandshake(short.server, message(20, cut(bytesFrom(short.view.clientFinished, toI32(4)), one))),
    TLS_ALERT_DECODE_ERROR
  );
  const wrong = new Waiting();
  const flipped: u8[] = cut(wrong.view.clientFinished, zero);
  flipped[toI32(flipped.length) - 1] = toU8(toI32(flipped[toI32(flipped.length) - 1]) ^ 1);
  t.eqI32("a Finished with one bit flipped is decrypt_error", sendHandshake(wrong.server, flipped), TLS_ALERT_DECRYPT_ERROR);
  t.eqI32("and the server has failed", wrong.server.state, TLS_STATE_FAILED);
  t.eqI32(
    "a ClientHello where the Finished belongs is unexpected_message",
    new Waiting().server.receive(TLS_LEVEL_HANDSHAKE, good, zero, toI32(good.length)),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );
  const done = new Waiting();
  sendHandshake(done.server, done.view.clientFinished);
  t.eqI32("the honest Finished connects", done.server.state, TLS_STATE_CONNECTED);
  t.eqI32(
    "and a handshake message after it is unexpected_message",
    sendHandshake(done.server, done.view.clientFinished),
    TLS_ALERT_UNEXPECTED_MESSAGE
  );

  // --- The schedule's edges ---------------------------------------------------
  t.eqI32("an unknown suite has no hash", tlsSuiteHashLength(toI32(0x1304)), zero);
  t.eqI32("and no key", tlsSuiteKeyLength(toI32(0x1304)), zero);
  t.eqI32(
    "and tlsTrafficKey answers an empty key for it rather than panicking",
    toI32(tlsTrafficKey(toI32(0x1304), new Array<u8>(32)).length),
    zero
  );
  t.eqI32("as tlsTrafficIv answers an empty IV", toI32(tlsTrafficIv(toI32(0x1304), new Array<u8>(32)).length), zero);
  t.eqI32("TLS_AES_256_GCM_SHA384 has a 32-byte key", tlsSuiteKeyLength(TLS_AES_256_GCM_SHA384), toI32(32));
  t.eqI32(
    "tlsExpandLabel answers the length asked",
    toI32(tlsExpandLabel(toI32(48), tlsExtract(toI32(48), empty, empty), "key", empty, toI32(32)).length),
    toI32(32)
  );
  return t.done();
};
