# The hash family

SHA-256, SHA-512, HMAC-SHA256 and HKDF-SHA256. This family proves the harness
in [`../README.md`](../README.md), which gives the program contract, the input
stream and the `family.json` schema.

## Kernels and their inputs

| Kernel | Key | Nonce | AAD | Message | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- | --- |
| `sha256` | — | — | — | `size` bytes | SHA-256 of the message | the 32-byte digest |
| `sha512` | — | — | — | `size` bytes | SHA-512 of the message | the 64-byte digest |
| `hmac-sha256` | 32 bytes | — | — | `size` bytes | HMAC-SHA256 of the message under the key | the 32-byte tag |
| `hkdf-sha256` | 32 bytes, the salt | — | 10 bytes, the info | `size` bytes, the IKM | HKDF-Extract, then HKDF-Expand to 42 bytes (RFC 5869) | the 42-byte OKM |

As in every family, iteration `i` XORs `i` into the first four message bytes.
For HKDF, those are the first four bytes of the IKM. The unit is MB/s of
message for the first three kernels. HKDF's is op/s: its cost is two to four
HMACs, whatever the IKM's length.

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `sha256` and `sha512` from `nish/crypto/sha256` and `nish/crypto/sha512`, `hmacSha256` from `nish/crypto/hmac`, and `hkdfExtractSha256` then `hkdfExpandSha256` from `nish/crypto/hkdf`. |
| `openssl.c` | OpenSSL 3 | `EVP_Digest` with the digest fetched once; an `EVP_MAC` context re-initialised per message; `EVP_KDF_derive`, with the KDF fetched once. The one-shot `HMAC()` and the `EVP_PKEY` HKDF route would fetch the algorithm on every call, timing OpenSSL's lookup rather than its hash. |
| `go/` | Go's standard library | `sha256.Sum256`, `sha512.Sum512`, `hmac.New` per message, and `hkdf.Key` (Go 1.24's `crypto/hkdf`). It has no dependencies. |
| `rust/` | RustCrypto | `sha2` 0.11.1, `hmac` 0.13.0 and `hkdf` 0.13.0, pinned exactly in `cargo.toml` and locked. `Hmac::new_from_slice` per message. |
| `node.mjs` | `node:crypto` | `createHash`, `createHmac` and `hkdfSync`. |

Every twin keys its HMAC once per message, as Nish's one-shot `hmacSha256`,
Node's `createHmac` and OpenSSL's re-initialised `EVP_MAC` do: reusing a keyed
state would skip two of the five compressions a 64-byte HMAC costs.

## The portable columns

| Column | How | What it removes |
| --- | --- | --- |
| OpenSSL portable | `OPENSSL_ia32cap="~0x1000020000000000:~0x20000120"` | The first word is CPUID leaf 1, ECX in its high half: it clears SSSE3 (bit 41, ECX bit 9) and AVX (bit 60, ECX bit 28). The second word is leaf 7's EBX: it clears AVX2 (bit 5), BMI2 (bit 8) and the SHA extensions (bit 29). What is left is OpenSSL's scalar x86-64 assembly, so "portable" here means no SIMD and no SHA instructions, not no assembly at all. |
| Go purego | `-tags purego` | Every assembly file in `crypto/sha256` and `crypto/sha512`; what is left is the generic Go block function. |
| Rust soft | `--cfg sha2_backend="soft"` | `sha2`'s SHA-NI (SHA-256) and AVX2 (SHA-512) backends; what is left is its portable Rust compress function. |
| Node | — | `node:crypto` is OpenSSL's libcrypto with its assembly, and Node has no switch that turns it off. |

`portableProof` is `["sha256@1048576", "sha512@1048576"]`: SHA-256 first,
SHA-512 if SHA-256 falls short. On a CPU with SHA-NI, OpenSSL's SHA-256 runs
on the SHA instructions the mask clears, and the masked run takes about 4x the
time. SHA-512 has no SHA-NI path, so there the mask only takes OpenSSL from
its AVX2 assembly to its scalar one: about 1.4x on this family's reference
machine (no `sha_ni`), but 1.17x to 1.19x on GitHub's runners, under the 1.2
minimum, which failed CI on pull requests that did not touch the family. On a
CPU without SHA-NI, SHA-512 is the fallback. Go purego takes about 2.6x the time of Go at SHA-512 and about 6.8x at
SHA-256 on a SHA-NI machine. RustCrypto's AVX2 SHA-512 is only about 10%
faster than its soft path, too close to the noise to gate on. Rust's ratio is
therefore `null`: its proof is that the soft binary's bytes differ from the
default one's, and the ratio is printed.
