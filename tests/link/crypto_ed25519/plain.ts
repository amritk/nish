// The plain-bytes view of `nish/crypto/ed25519` the test programs are written
// against: a seed as `u8[]`, so a vector reads as RFC 8032 prints it. Each
// call goes through the module's real surface — the seed wrapped in a
// `Secret` — and wipes it before it returns, so the adapter is itself held to
// every rule `nish:secret` makes (docs/LANGUAGE.md, "Secrets").
import { Secret, secret, wipe } from "nish:secret";
import { ed25519PublicKey, ed25519Sign } from "nish/crypto/ed25519";

/** A fresh copy of `bytes`, which a `Secret` is made from. */
export const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length);
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i];
  }
  return out;
};

/** `ed25519PublicKey` on a plain seed. */
export const publicKeyPlain = (seed: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(seed));
  const pub: u8[] | null = ed25519PublicKey(key);
  wipe(key);
  return pub;
};

/** `ed25519Sign` on a plain seed. */
export const signPlain = (seed: u8[], msg: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(seed));
  const sig: u8[] | null = ed25519Sign(key, msg);
  wipe(key);
  return sig;
};
