// The plain-bytes view of `nish/crypto/p256`'s signing side the suite is
// written against: a private key as `u8[]`, so a vector reads as RFC 6979
// prints it. Each call wraps a fresh copy of the key in a `Secret`, calls the
// module's real surface and wipes the key before it returns, so the adapter is
// itself held to every rule `nish:secret` makes (docs/LANGUAGE.md, "Secrets").
import { Secret, secret, wipe } from "nish:secret";
import {
  p256PublicKey as p256PublicKeySecret,
  p256Sign as p256SignSecret,
  p256SignSha256 as p256SignSha256Secret,
} from "nish/crypto/p256";

/** A fresh copy of `bytes`: what a `Secret` is made from. */
const keyCopyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length);
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i];
  }
  return out;
};

/** `p256PublicKey` on a plain private key. */
export const p256PublicKeyPlain = (priv: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(keyCopyOf(priv));
  const pub: u8[] | null = p256PublicKeySecret(key);
  wipe(key);
  return pub;
};

/** `p256Sign` on a plain private key. */
export const p256SignPlain = (priv: u8[], digest: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(keyCopyOf(priv));
  const sig: u8[] | null = p256SignSecret(key, digest);
  wipe(key);
  return sig;
};

/** `p256SignSha256` on a plain private key. */
export const p256SignSha256Plain = (priv: u8[], msg: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(keyCopyOf(priv));
  const sig: u8[] | null = p256SignSha256Secret(key, msg);
  wipe(key);
  return sig;
};
