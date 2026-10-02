// The server side of the `nish/net/tls` tests: a P-256 key and the
// self-signed certificate `nish/crypto/x509` mints for it, the injected
// randomness, and the configuration every case starts from.
import { p256PublicKey } from "nish/crypto/p256";
import { x509MintSelfSigned } from "nish/crypto/x509";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TlsServer, TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import { fromHex } from "./hex";

/** The server's P-256 private key: RFC 6979 A.2.5's. */
export const leafPrivate = (): u8[] => fromHex("c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721");

/** Its public key, 65 bytes uncompressed. */
export const leafPublic = (): u8[] => {
  const pub: u8[] | null = p256PublicKey(leafPrivate());
  if (pub === null) {
    return [];
  }
  return pub;
};

/** A self-signed certificate for the key, valid for a day from 2026-01-01. */
export const leafCertificate = (): u8[] => {
  const notBefore: i64 = 1767225600000;
  const days: i32 = 1;
  const serial: u8[] = [toU8(1)];
  const der: u8[] | null = x509MintSelfSigned(leafPrivate(), "localhost", notBefore, days, serial);
  if (der === null) {
    return [];
  }
  return der;
};

/** The server random every test server is handed: 0xa0, 0xa1, … 0xbf. */
export const serverRandom = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(0xa0 + k));
  }
  return out;
};

/** The server's ephemeral x25519 private key: RFC 7748 §6.1's Bob. */
export const serverPrivate = (): u8[] => fromHex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");

/** A configuration over TCP with `alpn`, signing with the P-256 leaf. */
export const tcpConfig = (alpn: string[]): TlsServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  const none: u8[] = [];
  return {
    certificateChain: chain,
    alpn: alpn,
    quicTransportParameters: none,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: false,
  };
};

/** A configuration over QUIC with `alpn`, sending `params` as the server's transport parameters. */
export const quicConfig = (alpn: string[], params: u8[]): TlsServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  const none: u8[] = [];
  return {
    certificateChain: chain,
    alpn: alpn,
    quicTransportParameters: params,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: true,
  };
};

/** A server under `config` with the injected randomness. */
export const newServer = (config: TlsServerConfig): TlsServer => new TlsServer(config, serverRandom(), serverPrivate());

/** Signs what the server is waiting on with the leaf key and hands it over; answers the alert. */
export const signWithLeaf = (server: TlsServer): i32 => {
  const input: u8[] | null = server.signatureInput();
  const none: u8[] = [];
  const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(leafPrivate(), input);
  return server.sign(signature === null ? none : signature);
};
