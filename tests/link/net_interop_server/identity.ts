// The interop server's identity: the quic-interop-runner's `/certs`
// (`cert.pem`, the chain leaf first, and `priv.key`, a P-256 key), or, when
// none is given, a P-256 key from the system's CSPRNG and a certificate
// `nish/crypto/x509` mints for it — self-signed, valid from an hour ago for
// ten days, the shape WebTransport's `serverCertificateHashes` accepts (an
// ECDSA P-256 key, at most fourteen days). The SHA-256 of the leaf is what a
// browser pins.
import { Secret, secret, wipe } from "nish:secret";
import { pemToDer, x509CertificateHash, x509MintSelfSigned, x509ParseP256PrivateKey } from "nish/crypto/x509";
import { toHex } from "../crypto_x509/hex";

/** How long a minted certificate is valid: under WebTransport's fourteen days. */
const MINTED_DAYS: i32 = 10;

/** How far before now it starts, so a clock a little behind still accepts it. */
const MINTED_SKEW: i64 = 3600000;

/** The chain `certs/cert.pem` holds, leaf first, or `null` when it holds none or cannot be read. */
export const loadChain = (certs: string): u8[][] | null => {
  const pem: string | null = readFileSyncOrNull(`${certs}/cert.pem`);
  return pem === null ? null : pemToDer(pem, "CERTIFICATE");
};

/** The P-256 key `certs/priv.key` holds, or `null`. */
export const loadKey = (certs: string): Secret<u8[]> | null => {
  const pem: string | null = readFileSyncOrNull(`${certs}/priv.key`);
  return pem === null ? null : x509ParseP256PrivateKey(pem);
};

/** A fresh P-256 private key: 32 bytes from the CSPRNG, drawn again in the rare case they are not a scalar below n. */
export const mintKey = (): Secret<u8[]> => {
  const serial: u8[] = [toU8(1)];
  while (true) {
    const bytes: u8[] = new Array<u8>(32);
    crypto.getRandomValues(bytes);
    const key: Secret<u8[]> = secret(bytes);
    if (x509MintSelfSigned(key, "localhost", toI64(0), MINTED_DAYS, serial) !== null) {
      return key;
    }
    wipe(key);
  }
};

/** A certificate for `key`, self-signed for `localhost` from `nowMs` less an hour for `MINTED_DAYS`, with a random serial; empty if minting failed. */
export const mintCertificate = (key: Secret<u8[]>, nowMs: i64): u8[] => {
  const serial: u8[] = new Array<u8>(16);
  crypto.getRandomValues(serial);
  serial[0] = toU8((toI32(serial[0]) & 0x7f) | 1);
  const der: u8[] | null = x509MintSelfSigned(key, "localhost", nowMs - MINTED_SKEW, MINTED_DAYS, serial);
  return der === null ? [] : der;
};

/** The SHA-256 of a certificate's DER, in lowercase hex: what `serverCertificateHashes` pins. */
export const certificateHash = (der: u8[]): string => toHex(x509CertificateHash(der));
