// The client's half of the record-layer tests: ClientHellos with and without
// a session id, the client's secrets derived from what the server sent, and a
// stream of records cut back into records. The hello, the key and the
// server's half (P-256 leaf, randomness, configuration) are `nish/net/tls`'s
// own test fixtures, in `../net_tls_common/`.
import { TLS_GROUP_X25519, TLS_LEGACY_VERSION, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256, TLS_VERSION_13 } from "nish/net/tls/codec";
import { tlsDeriveSecret, tlsEarlySecret, tlsFinishedVerifyData, tlsHandshakeSecret, tlsMasterSecret } from "nish/net/tls/schedule";
import { TLS_CONTENT_HANDSHAKE, TLS_RECORD_HEADER_SIZE, TlsRecordProtection } from "nish/net/tls/record";
import { x25519Plain } from "../crypto_x25519/plain";
import {
  GROUP_SECP256R1,
  cat,
  clientHelloRaw,
  clientPrivate,
  clientShare,
  extKeyShare,
  extSignatureAlgorithms,
  extSupportedGroups,
  extSupportedVersions,
  serverShareOf,
  splitMessages,
  transcriptHash,
} from "../net_tls_common/client";
import { ZERO, filled, range, sealOne } from "./bytes";

/** A 32-byte session id, 0x20 to 0x3f: what a client in middlebox-compatibility mode sends (RFC 8446 §D.4). */
export const sessionId = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(0x20 + k));
  }
  return out;
};

/**
 * A ClientHello offering `suites`, x25519 and secp256r1, both test signature
 * schemes, a session id when `compatible`, and an x25519 share unless
 * `retry` — then only a secp256r1 one, so the server answers with a
 * HelloRetryRequest.
 */
export const recordHello = (suites: i32[], compatible: boolean, retry: boolean): u8[] => {
  const none: u8[] = [];
  const shareGroups: i32[] = retry ? [GROUP_SECP256R1] : [TLS_GROUP_X25519];
  const shares: u8[][] = retry ? [filled(65, 4)] : [clientShare()];
  return clientHelloRaw(TLS_LEGACY_VERSION, compatible ? sessionId() : none, suites, [toU8(0)], [
    extSupportedVersions([TLS_VERSION_13]),
    extSupportedGroups([TLS_GROUP_X25519, GROUP_SECP256R1]),
    extSignatureAlgorithms([TLS_SIGNATURE_ECDSA_SECP256R1_SHA256, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256]),
    extKeyShare(shareGroups, shares),
  ]);
};

/** `message` in one record in the clear, as a client sends its ClientHello. */
export const clearRecord = (message: u8[]): u8[] => {
  const clear = new TlsRecordProtection();
  return sealOne(clear, TLS_CONTENT_HANDSHAKE, message, ZERO);
};

/** The whole records in `stream`, each with its header; a cut-off record at the end is left out. */
export const splitRecords = (stream: u8[]): u8[][] => {
  const out: u8[][] = [];
  let at: i32 = 0;
  const n: i32 = toI32(stream.length);
  while (at + TLS_RECORD_HEADER_SIZE <= n && at >= 0) {
    const length: i32 = (toI32(stream[at + 3]) << 8) | toI32(stream[at + 4]);
    const end: i32 = at + TLS_RECORD_HEADER_SIZE + length;
    if (end > n) {
      return out;
    }
    out.push(range(stream, at, end));
    at = end;
  }
  return out;
};

/** Every secret the client derives, and the Finished it sends. */
export class ClientKeys {
  clientHandshake: u8[];
  serverHandshake: u8[];
  clientApplication: u8[];
  serverApplication: u8[];
  /** The client's Finished message, header included. Empty until `finishWith`. */
  finished: u8[];
  hashLength: i32 = 0;
  /** The transcript before the ServerHello and the ServerHello, kept for `finishWith`. */
  helloTranscript: u8[];
  handshakeSecret: u8[];

  constructor() {
    this.clientHandshake = [];
    this.serverHandshake = [];
    this.clientApplication = [];
    this.serverApplication = [];
    this.finished = [];
    this.helloTranscript = [];
    this.handshakeSecret = [];
  }

  /**
   * The rest, once the client has opened the server's flight: the server's
   * flight is the handshake bytes of its handshake-level records.
   */
  finishWith(flight: u8[]): void {
    const h: i32 = this.hashLength;
    const messages: u8[][] = splitMessages(flight);
    if (toI32(messages.length) !== 4) {
      return;
    }
    const flightHash: u8[] = transcriptHash(h, cat([this.helloTranscript, flight]));
    const master: u8[] = tlsMasterSecret(h, this.handshakeSecret);
    this.clientApplication = tlsDeriveSecret(h, master, "c ap traffic", flightHash);
    this.serverApplication = tlsDeriveSecret(h, master, "s ap traffic", flightHash);
    this.finished = cat([
      [toU8(20), toU8(0), toU8(0), toU8(h)],
      tlsFinishedVerifyData(h, this.clientHandshake, flightHash),
    ]);
  }
}

/**
 * The client's handshake secrets for a server that answered with
 * `serverHello`: `before` is every message the client hashes ahead of it
 * (its ClientHello, or `message_hash`, the HelloRetryRequest and its second
 * ClientHello), and `hashLength` the negotiated suite's.
 */
export const clientKeysFor = (hashLength: i32, before: u8[], serverHello: u8[]): ClientKeys => {
  const keys = new ClientKeys();
  keys.hashLength = hashLength;
  const shared: u8[] | null = x25519Plain(clientPrivate(), serverShareOf(serverHello));
  const none: u8[] = [];
  keys.handshakeSecret = tlsHandshakeSecret(hashLength, tlsEarlySecret(hashLength), shared === null ? none : shared);
  keys.helloTranscript = cat([before, serverHello]);
  const helloHash: u8[] = transcriptHash(hashLength, keys.helloTranscript);
  keys.clientHandshake = tlsDeriveSecret(hashLength, keys.handshakeSecret, "c hs traffic", helloHash);
  keys.serverHandshake = tlsDeriveSecret(hashLength, keys.handshakeSecret, "s hs traffic", helloHash);
  return keys;
};
