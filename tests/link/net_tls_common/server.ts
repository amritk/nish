// The server side of the `nish/net/tls` tests: a P-256 key and the
// self-signed certificate `nish/crypto/x509` once minted for it, the injected
// randomness, and the configuration every case starts from.
import { Secret, secret, wipe } from "nish:secret";
import { p256PublicKeyPlain } from "../crypto_p256/plain";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { TlsServer, TlsServerConfig, tlsSignEcdsaP256 } from "nish/net/tls";
import { fromHex } from "../crypto_x509/hex";

/** The server's P-256 private key: RFC 6979 A.2.5's. */
export const leafPrivate = (): u8[] => fromHex("c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721");

/** Its public key, 65 bytes uncompressed. */
export const leafPublic = (): u8[] => {
  const pub: u8[] | null = p256PublicKeyPlain(leafPrivate());
  if (pub === null) {
    return [];
  }
  return pub;
};

/**
 * A self-signed certificate for the key, valid for a day from 2026-01-01, as a
 * constant: the DER `x509MintSelfSigned` wrote for this key, "localhost",
 * 2026-01-01T00:00:00Z, one day and serial 1, the last mint before X509-9
 * gave the mint its two extensions (docs/security/crypto-x509.md). It is frozen
 * because the aioquic recordings of `net_quic_conn_replay` and
 * `net_quic_lifecycle_replay` carry it in their TLS transcripts, so a minted
 * certificate that moves would move every recorded byte after it. The mint
 * itself is checked in a handshake in `crypto_x509` (`handshake.ts`).
 */
export const leafCertificate = (): u8[] =>
  fromHex(
    "308201133081bba003020102020101300a06082a8648ce3d04030230143112301006035504030c096c6f63616c686f7374301e170d3236303130313030303030305a170d3236303130323030303030305a30143112301006035504030c096c6f63616c686f73743059301306072a8648ce3d020106082a8648ce3d0301070342000460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299300a06082a8648ce3d040302034700304402200c0b8258087e44f6428624ddfd22cc752379dd41ca39ecfb138a13c8a47193e102200d00e6e9e36e4d0b5caa1cc1c6feea59eb10c1b010c9edff71a38b182cb8631d"
  );

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

/** A configuration signing with the P-256 leaf, offering `alpn`, over QUIC with `params` or over TCP. */
const configWith = (alpn: string[], params: u8[], quic: boolean): TlsServerConfig => {
  const chain: u8[][] = [leafCertificate()];
  const none: u8[] = [];
  return {
    certificateChain: chain,
    alpn: alpn,
    quicTransportParameters: params,
    extraExtensions: none,
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    quic: quic,
  };
};

/** A configuration over TCP with `alpn`, signing with the P-256 leaf. */
export const tcpConfig = (alpn: string[]): TlsServerConfig => {
  const none: u8[] = [];
  return configWith(alpn, none, false);
};

/** A configuration over QUIC with `alpn`, sending `params` as the server's transport parameters. */
export const quicConfig = (alpn: string[], params: u8[]): TlsServerConfig => configWith(alpn, params, true);

/** A server under `config` with the injected randomness. */
export const newServer = (config: TlsServerConfig): TlsServer => new TlsServer(config, serverRandom(), serverPrivate());

/** Signs what the server is waiting on with the leaf key and hands it over; answers the alert. */
export const signWithLeaf = (server: TlsServer): i32 => {
  const input: u8[] | null = server.signatureInput();
  const none: u8[] = [];
  const key: Secret<u8[]> = secret(leafPrivate());
  const signature: u8[] | null = input === null ? null : tlsSignEcdsaP256(key, input);
  wipe(key);
  return server.sign(signature === null ? none : signature);
};
