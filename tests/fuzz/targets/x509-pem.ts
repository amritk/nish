// The PEM and X.509 readers (`nish/crypto/x509`) over a file's text, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is `null`, so a panic here is a finding (docs/security/crypto-x509.md).
//
// The input is the file, bytes as they are on disk, made into one string with
// `String.fromBytes` as a program that reads a PEM file does. That text goes to
// `pemToDer` under the three labels this module reads, to `x509ParseChain`,
// and to `x509ParseP256PrivateKey`. A chain that parses is used as a server
// would: each certificate is checked against the next (the last against
// itself) when both are P-256. A key that parses gives its public key and is
// wiped, as its `Secret` must be.
import { Secret, wipe } from "nish:secret"
import { p256PublicKey } from "nish/crypto/p256"
import {
  X509Certificate,
  pemToDer,
  x509ParseChain,
  x509ParseP256PrivateKey,
  x509VerifySignature,
} from "nish/crypto/x509"

/** Each certificate's signature checked against the one after it, the last against itself. */
const useChain = (chain: X509Certificate[]): void => {
  for (let k: i32 = 0; k + 1 < chain.length; k++) {
    x509VerifySignature(chain[k], chain[k + 1])
  }
  const n: i32 = toI32(chain.length)
  if (n > 0) {
    const last: X509Certificate = chain[n - 1]
    x509VerifySignature(last, last)
  }
}

export const fuzzOne = (data: u8[]): void => {
  const text: string = String.fromBytes(data, 0, toI32(data.length))
  pemToDer(text, "CERTIFICATE")
  pemToDer(text, "EC PRIVATE KEY")
  pemToDer(text, "PRIVATE KEY")
  const chain: X509Certificate[] | null = x509ParseChain(text)
  if (chain !== null) {
    useChain(chain)
  }
  const key: Secret<u8[]> | null = x509ParseP256PrivateKey(text)
  if (key !== null) {
    p256PublicKey(key)
    wipe(key)
  }
}
