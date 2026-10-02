// The client half the `nish/net/tls` tests play: ClientHellos built byte by
// byte from RFC 8446's structures (so a test can also build a broken one), and
// the client's side of the key exchange, written without the server's code
// paths, to check what the server sent and to answer with a Finished.
//
// The client hashes its transcript as one concatenation of the messages it
// saw, with `sha256` / `sha384` directly, rather than through the server's
// `TlsTranscript`; the secrets it derives go through `nish/net/tls/schedule`,
// whose every step `tests/link/net_tls_rfc8448` pins against RFC 8448.
import { p256VerifySha256 } from "nish/crypto/p256";
import { sha256 } from "nish/crypto/sha256";
import { sha384 } from "nish/crypto/sha512";
import { x25519, x25519Base } from "nish/crypto/x25519";
import { x509DerSignatureRS } from "nish/crypto/x509";
import {
  TLS_EXT_ALPN,
  TLS_EXT_KEY_SHARE,
  TLS_EXT_QUIC_TRANSPORT_PARAMETERS,
  TLS_EXT_SERVER_NAME,
  TLS_EXT_SIGNATURE_ALGORITHMS,
  TLS_EXT_SUPPORTED_GROUPS,
  TLS_EXT_SUPPORTED_VERSIONS,
  TLS_GROUP_X25519,
  TLS_LEGACY_VERSION,
  TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  TLS_SIGNATURE_RSA_PSS_RSAE_SHA256,
  TLS_VERSION_13,
} from "nish/net/tls/codec";
import { tlsDeriveSecret, tlsEarlySecret, tlsFinishedVerifyData, tlsHandshakeSecret } from "nish/net/tls/schedule";
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TlsServer } from "nish/net/tls";
import { fromHex } from "./hex";

/** secp256r1, a group the server does not take, for a share it must look past. */
export const GROUP_SECP256R1: i32 = 0x0017;

/** `a` followed by every array of `parts`, in a fresh array. */
export const cat = (parts: u8[][]): u8[] => {
  const out: u8[] = [];
  for (const part of parts) {
    for (const b of part) {
      out.push(b);
    }
  }
  return out;
};

/** `v` as two bytes, big-endian. */
export const u16 = (v: i32): u8[] => [toU8((v >> 8) & 255), toU8(v & 255)];

/** `body` behind a one-byte length. */
export const vec8 = (body: u8[]): u8[] => cat([[toU8(toI32(body.length))], body]);

/** `body` behind a two-byte length. */
export const vec16 = (body: u8[]): u8[] => cat([u16(toI32(body.length)), body]);

/** `body` behind a three-byte length. */
export const vec24 = (body: u8[]): u8[] => {
  const n: i32 = toI32(body.length);
  return cat([[toU8((n >> 16) & 255), toU8((n >> 8) & 255), toU8(n & 255)], body]);
};

/** Each of `values` as two bytes, in order. */
export const u16List = (values: i32[]): u8[] => {
  const out: u8[] = [];
  for (const v of values) {
    out.push(toU8((v >> 8) & 255));
    out.push(toU8(v & 255));
  }
  return out;
};

/** The bytes of an ASCII string. */
export const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)));
  }
  return out;
};

/** One extension: its type, then its body behind a two-byte length (RFC 8446 §4.2). */
export const extension = (type: i32, body: u8[]): u8[] => cat([u16(type), vec16(body)]);

export const extSupportedVersions = (versions: i32[]): u8[] =>
  extension(TLS_EXT_SUPPORTED_VERSIONS, vec8(u16List(versions)));

export const extSupportedGroups = (groups: i32[]): u8[] => extension(TLS_EXT_SUPPORTED_GROUPS, vec16(u16List(groups)));

export const extSignatureAlgorithms = (schemes: i32[]): u8[] =>
  extension(TLS_EXT_SIGNATURE_ALGORITHMS, vec16(u16List(schemes)));

/** `key_share` with one share per group, `keys[i]` for `groups[i]`. */
export const extKeyShare = (groups: i32[], keys: u8[][]): u8[] => {
  const entries: u8[][] = [];
  for (let k: i32 = 0; k < toI32(groups.length) && k < toI32(keys.length); k++) {
    entries.push(cat([u16(groups[k]), vec16(keys[k])]));
  }
  return extension(TLS_EXT_KEY_SHARE, vec16(cat(entries)));
};

/** `server_name` with one `host_name`. */
export const extServerName = (host: string): u8[] =>
  extension(TLS_EXT_SERVER_NAME, vec16(cat([[toU8(0)], vec16(ascii(host))])));

/** `application_layer_protocol_negotiation` offering `names`, in order. */
export const extAlpn = (names: string[]): u8[] => {
  const list: u8[][] = [];
  for (const name of names) {
    list.push(vec8(ascii(name)));
  }
  return extension(TLS_EXT_ALPN, vec16(cat(list)));
};

/** `quic_transport_parameters`, opaque. */
export const extQuic = (params: u8[]): u8[] => extension(TLS_EXT_QUIC_TRANSPORT_PARAMETERS, params);

/** The 32-byte client random every test hello carries: 0x00, 0x01, … 0x1f. */
export const clientRandom = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(k));
  }
  return out;
};

/**
 * A ClientHello (RFC 8446 §4.1.2) with every field the caller's: the
 * legacy version, the session id, the suites, the compression methods, and
 * the extensions, already encoded.
 */
export const clientHelloRaw = (
  legacyVersion: i32,
  sessionId: u8[],
  suites: i32[],
  compression: u8[],
  extensions: u8[][]
): u8[] => {
  const body: u8[] = cat([
    u16(legacyVersion),
    clientRandom(),
    vec8(sessionId),
    vec16(u16List(suites)),
    vec8(compression),
    vec16(cat(extensions)),
  ]);
  return cat([[toU8(1)], vec24(body)]);
};

/** A well-formed TLS 1.3 ClientHello offering `suites` with `extensions`. */
export const clientHello = (suites: i32[], extensions: u8[][]): u8[] => {
  const none: u8[] = [];
  return clientHelloRaw(TLS_LEGACY_VERSION, none, suites, [toU8(0)], extensions);
};

/** The client's ephemeral x25519 private key in every test: RFC 7748 §6.1's Alice. */
export const clientPrivate = (): u8[] => fromHex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");

/** The client's x25519 share. */
export const clientShare = (): u8[] => {
  const share: u8[] | null = x25519Base(clientPrivate());
  if (share === null) {
    return [];
  }
  return share;
};

/**
 * The extensions a plain TLS 1.3 client sends: TLS 1.3, x25519 with its
 * share, and both signature schemes the tests use.
 */
export const standardExtensions = (): u8[][] => [
  extSupportedVersions([TLS_VERSION_13]),
  extSupportedGroups([TLS_GROUP_X25519]),
  extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256]),
  extKeyShare([TLS_GROUP_X25519], [clientShare()]),
];

/** `standardExtensions()` followed by `more`. */
export const standardWith = (more: u8[][]): u8[][] => {
  const out: u8[][] = standardExtensions();
  for (const e of more) {
    out.push(e);
  }
  return out;
};

/** The whole messages in a run of handshake bytes, each with its header. */
export const splitMessages = (bytes: u8[]): u8[][] => {
  const out: u8[][] = [];
  let at: i32 = 0;
  const n: i32 = toI32(bytes.length);
  while (at + 4 <= n && at >= 0) {
    const length: i32 = (toI32(bytes[at + 1]) << 16) | (toI32(bytes[at + 2]) << 8) | toI32(bytes[at + 3]);
    const message: u8[] = [];
    for (let k: i32 = at; k < at + 4 + length && k < toI32(bytes.length); k++) {
      message.push(bytes[k]);
    }
    out.push(message);
    at = at + 4 + length;
  }
  return out;
};

/** `message[from .. message.length)`. */
export const bytesFrom = (message: u8[], from: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = from; k >= 0 && k < toI32(message.length); k++) {
    out.push(message[k]);
  }
  return out;
};

/**
 * The server's x25519 share in a ServerHello: its `key_share` is the first
 * extension (the order `nish/net/tls/codec` writes), so the key sits after
 * the header, version, random, session id, suite, compression, the extensions'
 * length and the extension's type, length, group and key length.
 */
export const serverShareOf = (serverHello: u8[]): u8[] => {
  const sessionLength: i32 = toI32(serverHello[38]);
  // Header 4, version 2, random 32, the session id's length 1; then suite 2,
  // compression 1, the extensions' length 2, and type, length, group and key
  // length, 2 each.
  const beforeSession: i32 = 39;
  const afterSession: i32 = 13;
  const keyAt: i32 = beforeSession + sessionLength + afterSession;
  const out: u8[] = [];
  for (let k: i32 = keyAt; k < keyAt + 32 && k < toI32(serverHello.length); k++) {
    out.push(serverHello[k]);
  }
  return out;
};

/** The transcript hash of `transcript` under the hash `hashLength` names. */
export const transcriptHash = (hashLength: i32, transcript: u8[]): u8[] =>
  hashLength === 48 ? sha384(transcript) : sha256(transcript);

/** What the client found checking the server's flight, and its own Finished. */
export class ClientView {
  /** The four handshake-level messages, or fewer when the flight was short. */
  messages: u8[][];
  clientHandshakeSecret: u8[];
  serverHandshakeSecret: u8[];
  /** Whether the CertificateVerify's ECDSA signature verifies under the leaf key (`false` when no key was given). */
  signatureVerifies: boolean = false;
  /** Whether the server's Finished matches the client's own computation. */
  serverFinishedVerifies: boolean = false;
  /** The client's Finished message, header included. */
  clientFinished: u8[];

  constructor() {
    this.messages = [];
    this.clientHandshakeSecret = [];
    this.serverHandshakeSecret = [];
    this.clientFinished = [];
  }
}

/** CertificateVerify's 64 spaces, its context string and the zero byte (RFC 8446 §4.4.3), as hex. */
const SPACES_AND_CONTEXT_HEX: string =
  "20202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020544c5320312e332c2073657276657220436572746966696361746556657269667900";

/**
 * Plays the client from the ServerHello on. `before` is every message of the
 * transcript before the ServerHello as the client hashes it (the ClientHello;
 * or `message_hash`, the HelloRetryRequest and the second ClientHello).
 * `initial` and `handshake` are the server's output at the two levels after
 * the hello that completed it, and `leafPublic`, when not empty, is the P-256
 * key CertificateVerify must verify under.
 */
export const clientFinish = (
  hashLength: i32,
  before: u8[],
  initial: u8[],
  handshake: u8[],
  leafPublic: u8[]
): ClientView => {
  const view = new ClientView();
  const serverHello: u8[] = initial;
  const shared: u8[] | null = x25519(clientPrivate(), serverShareOf(serverHello));
  const none: u8[] = [];
  const ecdhe: u8[] = shared === null ? none : shared;
  const handshakeSecret: u8[] = tlsHandshakeSecret(hashLength, tlsEarlySecret(hashLength), ecdhe);
  const helloHash: u8[] = transcriptHash(hashLength, cat([before, serverHello]));
  view.clientHandshakeSecret = tlsDeriveSecret(hashLength, handshakeSecret, "c hs traffic", helloHash);
  view.serverHandshakeSecret = tlsDeriveSecret(hashLength, handshakeSecret, "s hs traffic", helloHash);
  view.messages = splitMessages(handshake);
  if (toI32(view.messages.length) !== 4) {
    return view;
  }
  const encryptedExtensions: u8[] = view.messages[0];
  const certificate: u8[] = view.messages[1];
  const certificateVerify: u8[] = view.messages[2];
  const finished: u8[] = view.messages[3];
  if (toI32(leafPublic.length) > 0) {
    const content: u8[] = cat([
      fromHex(SPACES_AND_CONTEXT_HEX),
      transcriptHash(hashLength, cat([before, serverHello, encryptedExtensions, certificate])),
    ]);
    // CertificateVerify: header (4), scheme (2), length (2), then the DER signature.
    const rs: u8[] | null = x509DerSignatureRS(bytesFrom(certificateVerify, 8));
    view.signatureVerifies = rs !== null && p256VerifySha256(leafPublic, content, rs);
  }
  const expected: u8[] = tlsFinishedVerifyData(
    hashLength,
    view.serverHandshakeSecret,
    transcriptHash(hashLength, cat([before, serverHello, encryptedExtensions, certificate, certificateVerify]))
  );
  view.serverFinishedVerifies = bytesEqual(bytesFrom(finished, 4), expected);
  const verifyData: u8[] = tlsFinishedVerifyData(
    hashLength,
    view.clientHandshakeSecret,
    transcriptHash(
      hashLength,
      cat([before, serverHello, encryptedExtensions, certificate, certificateVerify, finished])
    )
  );
  view.clientFinished = cat([[toU8(20), toU8(0), toU8(0), toU8(hashLength)], verifyData]);
  return view;
};

/** Whether two byte arrays are equal (public test data, so an early exit is fine). */
export const bytesEqual = (a: u8[], b: u8[]): boolean => {
  if (toI32(a.length) !== toI32(b.length)) {
    return false;
  }
  for (let k: i32 = 0; k < toI32(a.length) && k < toI32(b.length); k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

/** Feeds a whole ClientHello to `server` at the Initial level and answers the alert. */
export const sendHello = (server: TlsServer, hello: u8[]): i32 => {
  const zero: i32 = 0;
  return server.receive(TLS_LEVEL_INITIAL, hello, zero, toI32(hello.length));
};

/** Feeds a whole message to `server` at the Handshake level and answers the alert. */
export const sendHandshake = (server: TlsServer, message: u8[]): i32 => {
  const zero: i32 = 0;
  return server.receive(TLS_LEVEL_HANDSHAKE, message, zero, toI32(message.length));
};
