// `nish/crypto/pki` without `nish/crypto/pki-roots`, for wasm32: path
// validation reads no file, so it compiles where the operating system's roots
// cannot be loaded. tests/run.js builds this with `--target wasm32`; it is not
// a test program of its own.
import { PKI_ERR_MALFORMED, pkiTrustStore, pkiVerifyServer } from "nish/crypto/pki"
import { X509Certificate } from "nish/crypto/x509"

export const main = (): i32 => {
  const roots: X509Certificate[] = []
  const chain: u8[][] = []
  return pkiVerifyServer(chain, "example.com", 0, pkiTrustStore(roots)).code === PKI_ERR_MALFORMED ? 0 : 1
}
