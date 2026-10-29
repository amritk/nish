# The rsa family

RSA signature verification: PKCS #1 v1.5 and RSA-PSS, both over SHA-256. The
harness in [`../README.md`](../README.md) gives the program contract, the input
stream and the `family.json` schema.

## Kernels and their inputs

| Kernel | Key | Message | Before the clock | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- |
| `rsa2048-pkcs1-verify` | a 2048-bit public key, `e` = 65537, embedded | 32 bytes | the key parsed from its DER, and the ring (below) | SHA-256 of ring entry `i % 4`, then the PKCS #1 v1.5 verify | the key's 270-byte DER first, then one byte per verify: 1 true, 0 false |
| `rsa4096-pss-verify` | a 4096-bit public key, `e` = 65537, embedded | 32 bytes | the same | SHA-256 of ring entry `i % 4`, then the RSA-PSS verify (MGF1 with SHA-256, a 32-byte salt) | the key's 526-byte DER first, then one byte per verify |

The unit is op/s: a verify costs one modular exponentiation whatever the
message's length, so the size is fixed at 32, the length the signatures were
made over. Any other size exits 2.

**The ring.** Entry `j` of 4 is the message the stream draws for
`<kernel>:32`, tweaked with `j`. Each entry was signed once, when the twins
were written, and the four signatures are embedded in every program beside the
public key, as hex. Before the clock starts entry 1 has its last byte flipped,
so its verify must answer false and every other one true; a twin that gets one
wrong exits 1.

**Why the signatures are embedded.** `nish/crypto/rsa` verifies and cannot
sign (signing is a separate stage), and a key generated in each run would make
the twins disagree. So every twin reads the same key, as the PKCS #1
`RSAPublicKey` DER, and the same signatures. PSS signatures are randomised by
their salt; these four are fixed, so every twin folds the same bytes.

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `rsaPublicKeyFromDer`, then `rsaVerifyPkcs1(key, RSA_SHA256, msg, sig)` or `rsaVerifyPss(key, RSA_SHA256, 32, msg, sig)` from `nish/crypto/rsa`, which hash the message themselves. Only public data, so no `Secret`. |
| `openssl.c` | OpenSSL 3 | `d2i_PublicKey(EVP_PKEY_RSA, …)` on the DER; one `EVP_PKEY_CTX` set up with `EVP_PKEY_verify_init`, `EVP_PKEY_CTX_set_signature_md` and, for PSS, the padding, salt length and MGF1 digest; each iteration `EVP_Digest` then `EVP_PKEY_verify`. |
| `go/` | Go's standard library | `x509.ParsePKCS1PublicKey`, `sha256.Sum256`, then `rsa.VerifyPKCS1v15` or `rsa.VerifyPSS` with `SaltLength: 32`. No dependencies. |
| `rust/` | RustCrypto | `rsa` 0.9.10 with `sha2` 0.10.9, pinned exactly in `cargo.toml` and locked: `RsaPublicKey::from_pkcs1_der`, `Sha256::digest`, then `verify` with `Pkcs1v15Sign::new::<Sha256>()` or `Pss::new_with_salt::<Sha256>(32)`. |
| `node.mjs` | `node:crypto` | `createPublicKey` on the DER (`type: "pkcs1"`), then `verify("sha256", …)`, with `RSA_PKCS1_PSS_PADDING` and `saltLength: 32` for PSS. |

## The portable columns

| Column | How | What it removes |
| --- | --- | --- |
| OpenSSL portable | `OPENSSL_ia32cap="~0x1000000000000000:~0x80120"` | AVX, AVX2, BMI2 and ADX: the Montgomery multiply drops from its MULX/ADX `rsaz` code to the generic `x86_64-mont` assembly, and SHA-256 loses its AVX path. |
| Go purego | `-tags purego` | The assembly in `crypto/internal/fips140/bigmod` and SHA-256; what is left is generic Go. |
| Rust | — | RustCrypto's `rsa` and its bignum are pure Rust, so there is no assembly to switch off. |
| Node | — | `node:crypto` is OpenSSL's libcrypto with its assembly, and Node has no switch that turns it off. |
