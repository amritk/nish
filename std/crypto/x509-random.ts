/**
 * `nish/crypto/x509-random` — the private key and the serial number
 * `nish/crypto/x509`'s `x509MintSelfSigned` needs, drawn from the operating
 * system's CSPRNG, and the mint that draws its own serial.
 *
 *     import { wipe } from "nish:secret";
 *     import { x509DrawP256Key, x509MintSelfSignedDrawn } from "nish/crypto/x509-random";
 *
 *     const priv: Secret<u8[]> = x509DrawP256Key();
 *     const der: u8[] | null = x509MintSelfSignedDrawn(priv, "localhost", toI64(Date.now()), 14);
 *     // ... present `der` and sign the handshake with `priv` ...
 *     wipe(priv);
 *
 * **Native only.** Every function here reaches `crypto.getRandomValues`, so a
 * program that imports this module does not compile for wasm32, which has no
 * entropy to reach. That is why it is a module of its own: `nish/crypto/x509`
 * takes the key and the serial as arguments and imports nothing from here, so
 * a wasm32 program can still parse, verify and mint with bytes it was handed
 * (X509-6, docs/security/crypto-x509.md).
 *
 * Private names carry the `x509Random` prefix because a `std/` module's
 * private functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { Secret, secret, wipe } from "nish:secret"
import { P256_SCALAR_SIZE, p256PublicKey } from "nish/crypto/p256"
import { X509_MAX_SERIAL, x509MintSelfSigned } from "nish/crypto/x509"

/**
 * A fresh P-256 private key: `P256_SCALAR_SIZE` bytes from
 * `crypto.getRandomValues`, drawn again until they hold a scalar in [1, n),
 * which `p256PublicKey` is the test of. Rejection rather than reduction mod n,
 * so every key is equally likely; a draw is refused with odds below 2^-32. A
 * refused draw is wiped before the next, and the caller wipes the one
 * returned.
 */
export const x509DrawP256Key = (): Secret<u8[]> => {
  while (true) {
    const drawn: u8[] = new Array<u8>(P256_SCALAR_SIZE)
    crypto.getRandomValues(drawn)
    const key: Secret<u8[]> = secret(drawn)
    if (p256PublicKey(key) !== null) {
      return key
    }
    wipe(key)
  }
}

/**
 * A fresh serial number for `x509MintSelfSigned`: `X509_MAX_SERIAL` (20) bytes
 * from `crypto.getRandomValues` with the first one's top two bits set to `01`,
 * so the INTEGER is positive, never zero, and always twenty octets long — 158
 * random bits, past the 64 the CA/Browser Forum asks of a serial. A serial is
 * public, written into the certificate, so it is a plain array.
 */
export const x509DrawSerial = (): u8[] => {
  const serial: u8[] = new Array<u8>(X509_MAX_SERIAL)
  crypto.getRandomValues(serial)
  serial[0] = (serial[0] & toU8(0x3f)) | toU8(0x40)
  return serial
}

/**
 * `x509MintSelfSigned(priv, commonName, notBeforeMs, days, x509DrawSerial())`:
 * the self-signed certificate with a serial drawn here, `null` for everything
 * the mint answers `null` for. The key stays the caller's, since the server
 * that presents the certificate signs its handshakes with it; draw one with
 * `x509DrawP256Key`.
 */
export const x509MintSelfSignedDrawn = (
  priv: Secret<u8[]>,
  commonName: string,
  notBeforeMs: i64,
  days: i32
): u8[] | null => x509MintSelfSigned(priv, commonName, notBeforeMs, days, x509DrawSerial())
