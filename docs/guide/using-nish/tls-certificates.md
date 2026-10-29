# Verifying TLS certificates

When a program dials a TLS server, the server sends a chain of certificates:
its own first, then the ones that signed it. `nish/crypto/pki` decides whether
that chain is one to trust: that it leads to a root the program trusts, that
every certificate on the way is valid now and allowed to do what it does, and
that the server's certificate names the host the program meant to reach.
Without that check, TLS encrypts the connection to whoever answered. The
module is part of the [standard library](standard-library.md) and is imported
like any other ([`export` and `import`](../../LANGUAGE.md#export-and-import)).

## Verifying a chain

`pkiTrustStore(roots)` builds the store of roots to trust, once.
`pkiVerifyServer(chain, hostname, nowMs, store)` checks one chain: `chain` is
each certificate's DER as the server sent it, its own certificate first and
the rest in any order; `hostname` is the name the program dialled; `nowMs` is
the time to check validity at, in milliseconds since the epoch. It answers a
`PkiResult`: `code` is `PKI_OK` or the reason it was refused, and `path` is
the chain it accepted, the server's certificate first and the root last.

```ts nish:ok
import { PkiRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots";
import { PKI_OK, PkiResult, PkiTrustStore, pkiReason, pkiTrustStore, pkiVerifyServer } from "nish/crypto/pki";

const check = (chain: u8[][], host: string, store: PkiTrustStore): boolean => {
  const r: PkiResult = pkiVerifyServer(chain, host, toI64(Date.now()), store);
  if (r.code !== PKI_OK) {
    console.log(`refused ${host}: ${pkiReason(r.code)}`);
    return false;
  }
  console.log(`trusted ${host} through ${r.path.length} certificates`);
  return true;
};

export const main = (): i32 => {
  const roots: PkiRoots = pkiLoadSystemRoots();
  const store: PkiTrustStore = pkiTrustStore(roots.roots);
  // A chain from nowhere is refused: it has no certificates.
  const chain: u8[][] = [];
  return check(chain, "example.com", store) ? 0 : 1;
};
```

A refusal means the connection must not be used. There is no setting that
skips a check, and none should be added in a program: a chain that fails is
exactly what an attacker in the middle sends.

## Loading roots

`nish/crypto/pki-roots` reads the roots where OpenSSL and Go look:
the file `SSL_CERT_FILE` names and every directory in `SSL_CERT_DIR`, when
either is set, and otherwise the system's bundle. It is native only. A
`wasm32` program has no files to read, so it brings its own roots: parse each
PEM with `pemToDer` and `x509ParseCertificate` from `nish/crypto/x509` and
pass the certificates to `pkiTrustStore`. `nish/crypto/pki` itself compiles
for `wasm32`.

On macOS the roots come from `/etc/ssl/cert.pem`. A root added only to the
Keychain, or a trust setting changed there, is not seen; export it to a PEM
file and name that file in `SSL_CERT_FILE`.

## Reason codes

Each refusal has a code of its own, and `pkiReason(code)` gives its sentence.
When several paths were tried, the reason is the one from the attempt that got
nearest a root.

| Code | Meaning |
| --- | --- |
| `PKI_OK` | the chain is trusted and names the host |
| `PKI_ERR_MALFORMED` | the chain is empty, or a certificate does not parse |
| `PKI_ERR_EXPIRED` | a certificate's validity ended before `nowMs` |
| `PKI_ERR_NOT_YET_VALID` | a certificate's validity starts after `nowMs` |
| `PKI_ERR_UNTRUSTED` | no path leads to a root of the store |
| `PKI_ERR_BAD_SIGNATURE` | a signature does not verify under its issuer's key, or an RSA key is under 1024 or over 8192 bits |
| `PKI_ERR_NOT_CA` | an issuer is not a CA certificate, or the server's is one |
| `PKI_ERR_PATH_LENGTH` | an issuer's limit on the CAs below it is exceeded |
| `PKI_ERR_KEY_USAGE` | a key is used for something its key usage does not allow |
| `PKI_ERR_EXT_KEY_USAGE` | a certificate is not for TLS servers |
| `PKI_ERR_UNKNOWN_CRITICAL` | a certificate has a critical extension this module does not know |
| `PKI_ERR_NAME_CONSTRAINTS` | a name is outside what an issuer may certify, an issuer excludes a directory name, or it constrains a name form this module does not check |
| `PKI_ERR_HOSTNAME` | the server's certificate does not name the host |
| `PKI_ERR_WEAK_KEY` | a key is too small (an RSA key of 1024 to 2047 bits) |
| `PKI_ERR_UNSUPPORTED_ALGORITHM` | a signature or key algorithm is not supported, SHA-1 among them |
| `PKI_ERR_CHAIN_TOO_LONG` | the chain or a path is longer than its bound |
| `PKI_ERR_BUDGET` | checking would take more work than its bound allows |

The bounds are constants: `PKI_MAX_CHAIN_CERTS` (128) certificates and
`PKI_MAX_CHAIN_BYTES` (1 MiB) in a chain, `PKI_MAX_PATH` (8) certificates in a
path, `PKI_MAX_SIGNATURES` (64) signatures and `PKI_MAX_NAME_CHECKS` name
comparisons in one call, and `PKI_MAX_NAMES` and `PKI_MAX_SUBTREES` in one
certificate.

## Hostnames

The host is matched against the server certificate's DNS names and IP
addresses, never its common name. Letters match without case, and a wildcard
is only a whole leftmost label: `*.example.com` names `www.example.com` but
not `example.com` or `a.b.example.com`. An IP address, `192.0.2.1` or `::1`,
matches only an IP address in the certificate. A DNS host must be ASCII:
pass an internationalized name in its A-label form (`xn--…`), or the result
is `PKI_ERR_HOSTNAME`. `pkiMatchHostname(leaf, host)`
is that match alone, and `pkiVerifySignature(cert, issuer)` is whether one
certificate's signature verifies under another's key.

## What is not checked

- **Revocation.** Neither CRLs nor OCSP are read, so a certificate revoked
  before it expires is still accepted.
- **A root's own constraints.** A root is a name and a key: its validity,
  extensions and name constraints are not read.
- **Certificate policies** are not processed.
- **The common name** is never read as a hostname.

The security record,
[crypto-pki.md](../../security/crypto-pki.md#path-validation-nishcryptopki),
lists what was checked and what is open.
