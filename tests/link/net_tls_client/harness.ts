// What every `nish/net/tls-client` test shares: a client with the injected
// randomness, the pinned-leaf authenticator a test supplies in place of a
// certificate path check, and a driver that runs a `TlsClient` against a
// `TlsServer` in process, handing each side's handshake bytes to the other at
// the level they were written at.
import { p256VerifySha256 } from "nish/crypto/p256";
import { x509DerSignatureRS } from "nish/crypto/x509";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TLS_LEVEL_HANDSHAKE, TLS_LEVEL_INITIAL, TLS_STATE_WAIT_SIGNATURE, TlsServer } from "nish/net/tls";
import {
  TLS_CLIENT_STATE_WAIT_AUTHENTICATION,
  TlsClient,
  TlsClientConfig,
  tlsClientAuthenticate,
} from "nish/net/tls-client";
import { clientPrivate, clientRandom } from "../net_tls_common/client";
import { sameBytes } from "../crypto_x509/hex";
import { leafCertificate, leafPublic, signWithLeaf } from "../net_tls_common/server";

/** The ALPN alert a refused chain answers in these tests: `unknown_ca`. */
export const UNKNOWN_CA: i32 = 48;

/** A client configuration for "localhost" offering `suites` and `alpn`, with the share unless `deferShare`. */
export const clientConfig = (suites: i32[], alpn: string[], deferShare: boolean): TlsClientConfig => ({
  serverName: "localhost",
  alpn: alpn,
  suites: suites,
  deferShare: deferShare,
});

/** A client under `config` with the test random and RFC 7748's Alice as its ephemeral key. */
export const newClient = (config: TlsClientConfig): TlsClient => new TlsClient(config, clientRandom(), clientPrivate());

/**
 * The authenticator a test supplies: the chain must be exactly the one
 * minted leaf, for "localhost", and CertificateVerify must be an ECDSA P-256
 * signature by its key. No path validation is linked.
 */
export class PinnedLeaf {
  certificate: u8[];
  publicKey: u8[];
  /** How many times each verifier was asked, so a test sees the signature is not checked for a refused chain. */
  chainCalls: i32 = 0;
  signatureCalls: i32 = 0;

  constructor() {
    this.certificate = leafCertificate();
    this.publicKey = leafPublic();
  }
}

/** The chain check: 0 for the pinned leaf alone, named "localhost"; `unknown_ca` otherwise. */
export const pinnedChain = (auth: PinnedLeaf, chain: u8[][], serverName: string): i32 => {
  auth.chainCalls = auth.chainCalls + 1;
  if (toI32(chain.length) !== 1 || !sameBytes(chain[0], auth.certificate) || serverName !== "localhost") {
    return UNKNOWN_CA;
  }
  return 0;
};

/** The signature check: ECDSA P-256 with SHA-256 under the pinned key, DER decoded. */
export const pinnedSignature = (
  auth: PinnedLeaf,
  chain: u8[][],
  scheme: i32,
  content: u8[],
  signature: u8[]
): boolean => {
  auth.signatureCalls = auth.signatureCalls + 1;
  if (scheme !== TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 || toI32(chain.length) < 1) {
    return false;
  }
  const rs: u8[] | null = x509DerSignatureRS(signature);
  return rs !== null && p256VerifySha256(auth.publicKey, content, rs);
};

/** Answers `client`'s authentication with the pinned leaf; the alert. */
export const authenticatePinned = (client: TlsClient, auth: PinnedLeaf): i32 =>
  tlsClientAuthenticate(client, auth, pinnedChain, pinnedSignature);

/** What a handshake in process came to: each side's last answer. */
export class Outcome {
  clientAlert: i32 = 0;
  serverAlert: i32 = 0;
  /** The server's two flights as it wrote them, for the refusal tests to replay. */
  serverInitial: u8[];
  serverHandshake: u8[];

  constructor() {
    this.serverInitial = [];
    this.serverHandshake = [];
  }
}

/**
 * Runs `client` against `server` until both are connected or one refuses:
 * hello (and a retry) at the Initial level, the signing hand-off on the
 * server, the server's flight to the client, the pinned authentication, and
 * the client's Finished back.
 */
export const runHandshake = (client: TlsClient, server: TlsServer, auth: PinnedLeaf): Outcome => {
  const outcome = new Outcome();
  outcome.clientAlert = client.start();
  if (outcome.clientAlert !== 0) {
    return outcome;
  }
  // Two rounds at the Initial level at most: a HelloRetryRequest, then the
  // ServerHello.
  for (let round: i32 = 0; round < 2; round++) {
    const hello: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
    if (toI32(hello.length) === 0) {
      break;
    }
    outcome.serverAlert = server.receive(TLS_LEVEL_INITIAL, hello, toI32(0), toI32(hello.length));
    if (outcome.serverAlert !== 0) {
      return outcome;
    }
    if (server.state === TLS_STATE_WAIT_SIGNATURE) {
      outcome.serverAlert = signWithLeaf(server);
      if (outcome.serverAlert !== 0) {
        return outcome;
      }
    }
    const answer: u8[] = server.takeOutput(TLS_LEVEL_INITIAL);
    for (const b of answer) {
      outcome.serverInitial.push(b);
    }
    outcome.clientAlert = client.receive(TLS_LEVEL_INITIAL, answer, toI32(0), toI32(answer.length));
    if (outcome.clientAlert !== 0) {
      return outcome;
    }
  }
  const flight: u8[] = server.takeOutput(TLS_LEVEL_HANDSHAKE);
  for (const b of flight) {
    outcome.serverHandshake.push(b);
  }
  outcome.clientAlert = client.receive(TLS_LEVEL_HANDSHAKE, flight, toI32(0), toI32(flight.length));
  if (outcome.clientAlert !== 0) {
    return outcome;
  }
  if (client.state === TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
    outcome.clientAlert = authenticatePinned(client, auth);
    if (outcome.clientAlert !== 0) {
      return outcome;
    }
  }
  const finished: u8[] = client.takeOutput(TLS_LEVEL_HANDSHAKE);
  outcome.serverAlert = server.receive(TLS_LEVEL_HANDSHAKE, finished, toI32(0), toI32(finished.length));
  return outcome;
};
