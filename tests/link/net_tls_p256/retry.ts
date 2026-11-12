// The client half of a handshake over secp256r1, for the case `main.ts` runs
// through a HelloRetryRequest. `nish/net/tls/client` cannot play it against
// this server: it always shares a group it lists, and the server asks for
// secp256r1 only of a client that lists no x25519, so a retry to secp256r1
// needs a first ClientHello with no share at all.
//
// Like `../net_tls_common/client`, whose `clientFinish` is the x25519 one, it
// hashes its transcript as one concatenation of the messages it saw, with
// `sha256` directly and not through the server's `TlsTranscript`, so the
// `message_hash` rule (RFC 8446 §4.4.1) is applied twice, by two pieces of
// code. It goes one step further than `clientFinish`: the master secret and
// both application traffic secrets, which are what `main.ts` compares with
// the server's and protects a record under.
import { p256Ecdh, p256VerifySha256 } from "nish/crypto/p256";
import { x509DerSignatureRS } from "nish/crypto/x509";
import {
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsFinishedVerifyData,
  tlsHandshakeSecret,
  tlsMasterSecret,
} from "nish/net/tls/schedule";
import { Secret, secret, wipe } from "nish:secret";
import { copyOf } from "../crypto_x25519/plain";
import { fromHex, sameBytes } from "../crypto_x509/hex";
import { bytesFrom, cat, splitMessages, transcriptHash } from "../net_tls_common/client";
import { secretCopy } from "../net_tls_common/secrets";

/** SHA-256's length: the hash of the one suite the retried handshake offers. */
const HASH: i32 = 32;

/** CertificateVerify's 64 spaces, its context string and the zero byte (RFC 8446 §4.4.3), as hex. */
const SPACES_AND_CONTEXT_HEX: string =
  "20202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020544c5320312e332c2073657276657220436572746966696361746556657269667900";

/** The synthetic `message_hash` message that stands for `clientHello1` (§4.4.1): type 254, length 32, its SHA-256. */
export const messageHash = (clientHello1: u8[]): u8[] =>
  cat([[toU8(254), toU8(0), toU8(0), toU8(HASH)], transcriptHash(HASH, clientHello1)]);

/**
 * The server's 65-byte secp256r1 share in a ServerHello. Its `key_share` is
 * the first extension (the order `nish/net/tls/codec` writes), so the point
 * sits after the header (4), version (2), random (32) and the session id
 * behind its length (1), then the suite (2), compression (1), the extensions'
 * length (2), and the extension's type, length, group and key length, 2 each.
 */
const retryServerShare = (serverHello: u8[]): u8[] => {
  const keyAt: i32 = 39 + toI32(serverHello[38]) + 13;
  const out: u8[] = [];
  for (let k: i32 = keyAt; k < keyAt + 65 && k < toI32(serverHello.length); k++) {
    out.push(serverHello[k]);
  }
  return out;
};

/** What the client found in the server's flight, its own Finished, and the application secrets it derived. */
export class RetryView {
  /** Whether the ECDH with the server's share gave a secret, and the flight was four messages. */
  complete: boolean = false;
  /** Whether CertificateVerify's signature verifies under the leaf key. */
  signatureVerifies: boolean = false;
  /** Whether the server's Finished matches the client's own computation. */
  serverFinishedVerifies: boolean = false;
  /** The client's Finished message, header included. */
  clientFinished: u8[];
  /** client_application_traffic_secret_0, plain: a test value, kept to compare and to key a record. */
  clientApplication: u8[];
  /** server_application_traffic_secret_0, likewise. */
  serverApplication: u8[];

  constructor() {
    this.clientFinished = [];
    this.clientApplication = [];
    this.serverApplication = [];
  }
}

/**
 * Plays the client from the ServerHello on, over secp256r1 and SHA-256.
 * `privateKey` is the scalar of the share the client sent, `before` every
 * message of the transcript before the ServerHello as the client hashes it
 * (`message_hash`, the HelloRetryRequest and the second ClientHello),
 * `serverHello` and `handshake` the server's output at the two levels, and
 * `leafPublic` the P-256 key CertificateVerify must verify under.
 */
export const retryFinish = (
  privateKey: u8[],
  before: u8[],
  serverHello: u8[],
  handshake: u8[],
  leafPublic: u8[]
): RetryView => {
  const view = new RetryView();
  const key: Secret<u8[]> = secret(copyOf(privateKey));
  const ecdhe: Secret<u8[]> | null = p256Ecdh(key, retryServerShare(serverHello));
  wipe(key);
  const messages: u8[][] = splitMessages(handshake);
  if (ecdhe === null) {
    return view;
  }
  if (toI32(messages.length) !== 4) {
    wipe(ecdhe);
    return view;
  }
  view.complete = true;
  const early: Secret<u8[]> = tlsEarlySecret(HASH);
  const handshakeSecret: Secret<u8[]> = tlsHandshakeSecret(HASH, early, ecdhe);
  wipe(early);
  wipe(ecdhe);
  const helloHash: u8[] = transcriptHash(HASH, cat([before, serverHello]));
  const clientHandshake: Secret<u8[]> = tlsDeriveSecret(HASH, handshakeSecret, "c hs traffic", helloHash);
  const serverHandshake: Secret<u8[]> = tlsDeriveSecret(HASH, handshakeSecret, "s hs traffic", helloHash);
  const master: Secret<u8[]> = tlsMasterSecret(HASH, handshakeSecret);
  wipe(handshakeSecret);

  const encryptedExtensions: u8[] = messages[0];
  const certificate: u8[] = messages[1];
  const certificateVerify: u8[] = messages[2];
  const finished: u8[] = messages[3];
  const throughCertificate: u8[] = cat([before, serverHello, encryptedExtensions, certificate]);
  const content: u8[] = cat([fromHex(SPACES_AND_CONTEXT_HEX), transcriptHash(HASH, throughCertificate)]);
  // CertificateVerify: header (4), scheme (2), length (2), then the DER signature.
  const rs: u8[] | null = x509DerSignatureRS(bytesFrom(certificateVerify, 8));
  view.signatureVerifies = rs !== null && p256VerifySha256(leafPublic, content, rs);

  const throughVerify: u8[] = cat([throughCertificate, certificateVerify]);
  view.serverFinishedVerifies = sameBytes(
    bytesFrom(finished, 4),
    tlsFinishedVerifyData(HASH, serverHandshake, transcriptHash(HASH, throughVerify))
  );
  // §7.1: both application secrets are over the transcript through the
  // server's Finished, which the client's own Finished is over as well.
  const flightHash: u8[] = transcriptHash(HASH, cat([throughVerify, finished]));
  view.clientFinished = cat([
    [toU8(20), toU8(0), toU8(0), toU8(HASH)],
    tlsFinishedVerifyData(HASH, clientHandshake, flightHash),
  ]);
  wipe(clientHandshake);
  wipe(serverHandshake);
  const clientApplication: Secret<u8[]> = tlsDeriveSecret(HASH, master, "c ap traffic", flightHash);
  const serverApplication: Secret<u8[]> = tlsDeriveSecret(HASH, master, "s ap traffic", flightHash);
  wipe(master);
  view.clientApplication = secretCopy(clientApplication);
  view.serverApplication = secretCopy(serverApplication);
  wipe(clientApplication);
  wipe(serverApplication);
  return view;
};
