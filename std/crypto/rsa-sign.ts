/**
 * `nish/crypto/rsa-sign` — RSASSA-PSS signing with SHA-256 and a fresh
 * 32-byte salt (RFC 8017 §8.1.1, the TLS 1.3 scheme `rsa_pss_rsae_sha256`)
 * under a key from `nish/crypto/rsa-key`.
 *
 *     import { Secret, wipe } from "nish:secret";
 *     import { x509ParseRsaPrivateKey } from "nish/crypto/x509";
 *     import { rsaSignPssSha256 } from "nish/crypto/rsa-sign";
 *
 *     const signOnce = (pem: string, message: u8[]): u8[] | null => {
 *       const key: Secret<u8[]> | null = x509ParseRsaPrivateKey(pem);
 *       if (key === null) {
 *         return null;
 *       }
 *       const signature: u8[] | null = rsaSignPssSha256(key, message);
 *       wipe(key);
 *       return signature;
 *     };
 *
 * **Native only.** Both signers draw their salt from `crypto.getRandomValues`,
 * so a program that imports this module does not compile for wasm32. That is
 * why it is a module of its own: the key, the arithmetic and the salted
 * signers live in `nish/crypto/rsa-key`, which reaches no randomness. The
 * constant-time and wiping properties are that module's (docs/security/crypto-rsa.md).
 */
import { Secret } from "nish:secret"
import {
  RSA_PSS_SHA256_SALT_SIZE,
  RsaSignScratch,
  rsaSignPssSha256Salted,
  rsaSignPssSha256SaltedInto,
} from "nish/crypto/rsa-key"

/**
 * RSASSA-PSS-SIGN (RFC 8017 §8.1.1) with SHA-256, MGF1-SHA-256 and a fresh
 * `RSA_PSS_SHA256_SALT_SIZE`-byte salt from `crypto.getRandomValues`: TLS
 * 1.3's `rsa_pss_rsae_sha256`. `null` for a `Secret` that is not a key from
 * `rsaParsePrivateKey` and a signature that fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param msg The message, hashed here.
 * @returns The `k`-byte signature, or `null`.
 */
export const rsaSignPssSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null => {
  const salt: u8[] = new Array<u8>(RSA_PSS_SHA256_SALT_SIZE)
  crypto.getRandomValues(salt)
  return rsaSignPssSha256Salted(priv, msg, salt)
}

/**
 * `rsaSignPssSha256` over `msg[off .. off + len)`, writing the `k`-byte
 * signature at `out[at]` and releasing every allocation of its own before it
 * returns: `rsaSignPssSha256SaltedInto` with a fresh salt. Panics when either
 * window is outside its array; answers `false`, leaving `out` as it was, for
 * a `Secret` that is not a key and a signature that fails the check against
 * `e`.
 *
 * @param sc The hashers, made once by the caller.
 * @param priv The key, borrowed.
 * @param msg The array holding the message.
 * @param off The message's first index.
 * @param len The message's length.
 * @param out The array the signature is written into.
 * @param at The index of the signature's first byte.
 * @returns Whether a signature was written.
 */
export const rsaSignPssSha256Into = (
  sc: RsaSignScratch,
  priv: Secret<u8[]>,
  msg: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32
): boolean => {
  using _scope = arena()
  const salt: u8[] = new Array<u8>(RSA_PSS_SHA256_SALT_SIZE)
  crypto.getRandomValues(salt)
  return rsaSignPssSha256SaltedInto(sc, priv, msg, off, len, salt, out, at)
}
