// The plain view of `nish/net/tls/schedule`'s `Secret`s the TLS tests compare
// against the RFC's hex: each reads a secret's bytes only through `expose`,
// and leaves the `Secret` to its caller, who wipes it (docs/LANGUAGE.md,
// "Secrets").
import { Secret, expose, secret, wipe } from "nish:secret";
import { tlsNextTrafficSecret } from "nish/net/tls/record";
import { copyOf } from "../crypto_x25519/plain";
import { toHex } from "../crypto_x509/hex";

/** `toHex` on a plain array, for `expose` to run. */
const hexOf = (bytes: u8[]): string => toHex(bytes);

/** The hex of the bytes `s` holds; the caller still owns `s` and wipes it. */
export const secretHex = (s: Secret<u8[]>): string => expose(s, hexOf);

/** A plain copy of the bytes `s` holds, for a test that keeps one in a field; the caller wipes `s`. */
export const secretCopy = (s: Secret<u8[]>): u8[] => expose(s, copyOf);

/**
 * `tlsNextTrafficSecret` over a plain secret, answered plain: the tests that
 * keep traffic secrets in fields step them through this, and the two
 * `Secret`s it holds are wiped before it returns.
 */
export const nextTrafficCopy = (hashLength: i32, traffic: u8[]): u8[] => {
  const current: Secret<u8[]> = secret(copyOf(traffic));
  const next: Secret<u8[]> = tlsNextTrafficSecret(hashLength, current);
  wipe(current);
  const plain: u8[] = secretCopy(next);
  wipe(next);
  return plain;
};
