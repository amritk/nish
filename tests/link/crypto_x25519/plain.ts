// The plain-bytes view of `nish/crypto/x25519` the test programs are written
// against: a scalar and an answer as `u8[]`, so a vector reads as the RFC
// prints it. Each call goes through the module's real surface — the key
// wrapped in a `Secret`, the shared secret read back through `expose` — and
// wipes both before it returns, so the adapter is itself held to every rule
// `nish:secret` makes (docs/LANGUAGE.md, "Secrets").
import { Secret, expose, secret, wipe } from "nish:secret";
import { x25519 as x25519Secret, x25519Base as x25519BaseSecret } from "nish/crypto/x25519";

/** A fresh copy of `bytes`: what a `Secret` is made from, and how one is read back. */
export const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length);
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i];
  }
  return out;
};

/** `x25519` on a plain scalar, answering the shared secret's bytes. */
export const x25519Plain = (scalar: u8[], u: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(scalar));
  const shared: Secret<u8[]> | null = x25519Secret(key, u);
  wipe(key);
  if (shared === null) {
    return null;
  }
  const out: u8[] = expose(shared, copyOf);
  wipe(shared);
  return out;
};

/** `x25519Base` on a plain scalar. */
export const x25519BasePlain = (scalar: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(scalar));
  const pub: u8[] | null = x25519BaseSecret(key);
  wipe(key);
  return pub;
};
