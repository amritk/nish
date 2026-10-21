# The x509 family

A self-signed X.509 certificate for a P-256 key, minted and parsed. The harness
in [`../README.md`](../README.md) gives the program contract, the input stream
and the `family.json` schema.

## The certificate

Every twin mints the same certificate, the one `nish/crypto/x509`'s
`x509MintSelfSigned` writes:

- a v3 certificate, signed with ecdsa-with-SHA256 by its own key;
- subject and issuer `CN=bench.nish.dev`, one RDN, as a UTF8String;
- valid from 2026-01-01T00:00:00Z (1767225600 s) for 14 days, as UTCTime;
- two critical extensions: basicConstraints with `CA:FALSE` (an empty
  SEQUENCE) and keyUsage `digitalSignature`, and nothing else.

## Kernels and their inputs

| Kernel | Key | Message | Before the clock | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- |
| `x509-mint` | 32 bytes, the private scalar | `size` bytes, the serial | the key | the certificate above, with the tweaked message as its serial | after the clock stops, each certificate parsed back: its serial's INTEGER contents, then what `x509-parse` folds |
| `x509-parse` | — | — | the fixed certificate (below) | parse the certificate and verify its self-signature | for each: the common name's bytes, notBefore and notAfter as 8-byte big-endian seconds since 1970, the 65-byte uncompressed public key, and one byte saying whether the signature verifies |

The unit is op/s: what a certificate costs is its signature, not its length.
`x509-mint`'s size is the serial's length, 4 to 20 bytes, and 16 here. Before
the serial is used, its first byte is set to `(b & 0x3f) | 0x40`, so it is a
positive INTEGER with a nonzero first octet that every encoder writes as it is.
`x509-parse`'s size is 338, the fixed certificate's length; any other size is
a usage error.

**Why `x509-mint` folds a parse.** ECDSA's nonce is random in Go and OpenSSL,
so no two twins' certificates agree byte for byte. What every twin agrees on is
what the certificate says and that its signature verifies, so that is the fold,
as in the curves family's `p256-sign`. The parse runs after the clock stops,
and the time it takes is added back to the start, so the reported time is the
minting loop's alone.

**The fixed certificate.** `x509-parse` reads the 338 bytes `x509-mint` wrote
for its first iteration in the Nish program (whose ECDSA is deterministic),
signature and all, embedded as hex in every twin. Parsing the same bytes is
what makes the twins' folds comparable.

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `x509MintSelfSigned`, `x509ParseCertificate` and `x509VerifySignature` from `nish/crypto/x509`. The private key goes in as a `Secret<u8[]>` and is wiped. |
| `openssl.c` | OpenSSL 3 | `X509_new` and its setters, `X509V3_EXT_conf_nid` for the two extensions, `X509_sign` with SHA-256 and `i2d_X509` to mint; `d2i_X509`, `X509_get_subject_name`, `ASN1_TIME_diff` and `X509_verify` to parse. The key comes in as a SEC1 ECPrivateKey. |
| `go/` | Go's standard library | `x509.CreateCertificate` to mint and `x509.ParseCertificate` then `CheckSignature` to parse. The subject is passed as `RawSubject`, so it is a UTF8String as in every twin. `CreateCertificate` verifies the signature it has just made before it returns, so Go's mint pays for a verify the other twins do not. No dependencies. |
| `rust/` | RustCrypto | `rcgen` 0.14.10 (no default features, so no `ring`) with `p256` 0.14.0 as its signer to mint, and `x509-parser` 0.18.1 with `p256`'s verify to parse, pinned exactly in `cargo.toml` and locked. basicConstraints goes in as a custom extension, because `rcgen`'s own `CA:FALSE` adds a subject key identifier. |
| `node.mjs` | `node:crypto` | `X509Certificate` and `verify`. Node cannot write a certificate, so it `lacks` `x509-mint`. |

Every twin but Nish builds its key once, before the clock starts.
`x509MintSelfSigned` takes the private key alone, so the Nish program computes
the public key, one more P-256 base-point multiply, on every certificate it
mints; its `x509-mint` row pays for that.

The Nish program has three performance notes (`NL` warnings) from values kept
across iterations of a timed loop: the certificates and serials it holds for
the fold, so no `using arena()` may wrap those loops.

## The portable columns

| Column | How | What it removes |
| --- | --- | --- |
| OpenSSL portable | `OPENSSL_ia32cap="~0x1000000000000000:~0x80120"` | The same mask as the curves family: P-256's `ecp_nistz256` assembly drops to its non-MULX/ADX path. |
| Go purego | `-tags purego` | The P-256 assembly in `crypto/internal/fips140/nistec` and SHA-256's. |
| Rust | — | `p256`, `rcgen` and `x509-parser` are pure Rust, so there is no curve assembly to switch off. |
| Node | — | `node:crypto` is OpenSSL's libcrypto with its assembly, and Node has no switch that turns it off. |

The family sets no `portableProof`. The OpenSSL mask moves P-256 by about 1.1x
alone (the curves family's `p256-sign` and `p256-verify`), and the
certificate's encoding and parsing dilute that to within the noise: on this
family's reference machine, 1.015x to 1.05x at `x509-parse` and 1.0x to 1.07x
at `x509-mint`, against a noise band of about ±4%, so no floor above the noise
holds. The runner refuses a null floor for OpenSSL, since its portable column
is the same binary. The curves family proves the same mask and the same
`purego` tag; Go purego takes about 2.5x the time of Go at `x509-parse`.
