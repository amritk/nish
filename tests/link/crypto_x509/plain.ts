// The plain-bytes view of `nish/crypto/x509`'s private-key surface the test
// programs are written against: a key as `u8[]`, so it compares as the hex
// the fixtures hold. Each call goes through the module's real surface — the
// parsed key read back through `expose`, a minting key wrapped in a `Secret`
// — and wipes what it made before it returns, so the adapter is itself held
// to every rule `nish:secret` makes (docs/LANGUAGE.md, "Secrets").
import { Secret, expose, secret, wipe } from "nish:secret"
import { p256PublicKey as p256PublicKeySecret } from "nish/crypto/p256"
import {
  x509MintSelfSigned as x509MintSelfSignedSecret,
  x509ParseP256PrivateKey as x509ParseP256PrivateKeySecret,
} from "nish/crypto/x509"

/** A fresh copy of `bytes`: what a `Secret` is made from, and how one is read back. */
const x509KeyCopy = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length)
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i]
  }
  return out
}

/** `x509ParseP256PrivateKey`, answering the scalar's bytes. */
export const x509ParseP256PrivateKeyPlain = (pem: string): u8[] | null => {
  const key: Secret<u8[]> | null = x509ParseP256PrivateKeySecret(pem)
  if (key === null) {
    return null
  }
  const out: u8[] = expose(key, x509KeyCopy)
  wipe(key)
  return out
}

/** `x509MintSelfSigned` on a plain private key. */
export const x509MintSelfSignedPlain = (
  priv: u8[],
  commonName: string,
  notBeforeMs: i64,
  days: i32,
  serial: u8[]
): u8[] | null => {
  const key: Secret<u8[]> = secret(x509KeyCopy(priv))
  const der: u8[] | null = x509MintSelfSignedSecret(key, commonName, notBeforeMs, days, serial)
  wipe(key)
  return der
}

/** `p256PublicKey` on a plain private key. */
export const x509PublicKeyPlain = (priv: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(x509KeyCopy(priv))
  const pub: u8[] | null = p256PublicKeySecret(key)
  wipe(key)
  return pub
}
