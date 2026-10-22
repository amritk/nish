# The AEAD family

AES-128-GCM, AES-256-GCM and ChaCha20-Poly1305, sealing and opening, at 64
bytes, 1,350 bytes (a full QUIC or TLS record on a 1,500-byte path), 16 KiB (a
full TLS record) and 1 MiB. The program contract, the input stream and the
`family.json` schema are in [`../README.md`](../README.md).

## Kernels and their inputs

| Kernel | Key | Nonce | AAD | Message | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- | --- |
| `aes128gcm-seal` | 16 bytes | 12 bytes | 13 bytes | `size` bytes | AES-128-GCM seal (SP 800-38D) | the ciphertext, then the 16-byte tag |
| `aes128gcm-open` | 16 bytes | 12 bytes | 13 bytes | `size` bytes | AES-128-GCM open of one ring entry | the recovered message |
| `aes256gcm-seal` | 32 bytes | 12 bytes | 13 bytes | `size` bytes | AES-256-GCM seal | the ciphertext, then the tag |
| `aes256gcm-open` | 32 bytes | 12 bytes | 13 bytes | `size` bytes | AES-256-GCM open of one ring entry | the recovered message |
| `chacha20poly1305-seal` | 32 bytes | 12 bytes | 13 bytes | `size` bytes | ChaCha20-Poly1305 seal (RFC 8439) | the ciphertext, then the tag |
| `chacha20poly1305-open` | 32 bytes | 12 bytes | 13 bytes | `size` bytes | ChaCha20-Poly1305 open of one ring entry | the recovered message |

The 13-byte AAD is a TLS 1.2 record header's length. As in every family,
iteration `i` XORs `i` into the first four message bytes. A sealed message is
never sealed twice under one nonce, so iteration `i` also XORs `i` into the
nonce's last four bytes (offset 8), the same way.

An open kernel opens what was sealed under its own inputs. Before the clock
starts, it seals a ring of 16 entries: entry `r` is the seal of the message and
the nonce, both tweaked with `r`. Iteration `i` opens entry `i % 16` under the
nonce tweaked with `i % 16`, and folds the plaintext. Every open checks its
tag, and a failed open exits 1. The key is expanded once, before the clock, in
every twin but Node (below).

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `aesKey` once, then `aesGcmSeal` and `aesGcmOpen` from `nish/crypto/aes`; `chacha20Poly1305Seal` and `chacha20Poly1305Open` from `nish/crypto/chacha20poly1305`, which take the raw key. |
| `openssl.c` | OpenSSL 3 | `EVP_CIPHER_fetch` once and one `EVP_CIPHER_CTX` keyed once. Per message: `EVP_EncryptInit_ex` with the nonce alone, `EVP_EncryptUpdate` for the AAD and the message, `EVP_EncryptFinal_ex`, `EVP_CTRL_AEAD_GET_TAG`. An open sets the tag with `EVP_CTRL_AEAD_SET_TAG` and fails unless `EVP_DecryptFinal_ex` answers 1. |
| `go/` | Go | `crypto/aes` with `cipher.NewGCM`, and `golang.org/x/crypto/chacha20poly1305` v0.48.0 (the newest that builds with Go 1.24), each keyed once. `Seal` and `Open` write into one reused buffer. |
| `rust/` | RustCrypto | `aes-gcm` 0.11.1 and `chacha20poly1305` 0.11.0, pinned exactly in `cargo.toml` and locked. `KeyInit::new_from_slice` once, then `Aead::encrypt` and `Aead::decrypt`, which allocate the output. |
| `node.mjs` | `node:crypto` | `createCipheriv` with `setAAD`, `update`, `final` and `getAuthTag`; `createDecipheriv` with `setAuthTag`, and `final` throwing on a bad tag. |

Node keys a cipher per message. `node:crypto` has no object that holds an
expanded key across nonces, so every Node iteration pays the key schedule and
the context setup that the other twins pay once. That cost dominates at 64
bytes and vanishes at 1 MiB; the family's footnote says so.

## The portable columns

| Column | How | What it removes |
| --- | --- | --- |
| OpenSSL portable | `OPENSSL_ia32cap="~0x1240020200000000:~0x0000060000010020"` | The first word is CPUID leaf 1, ECX in its high half. It clears PCLMULQDQ (bit 33, ECX bit 1), SSSE3 (bit 41, ECX bit 9), MOVBE (bit 54, ECX bit 22), AES-NI (bit 57, ECX bit 25) and AVX (bit 60, ECX bit 28). The second word is leaf 7, EBX in its low half and ECX in its high half. It clears AVX2 (bit 5), AVX-512F (bit 16), VAES (bit 41, ECX bit 9) and VPCLMULQDQ (bit 42, ECX bit 10). What is left is OpenSSL's scalar x86-64 assembly: table AES, 4-bit GHASH, and integer ChaCha20 and Poly1305. "Portable" here means no SIMD and no AES or carry-less multiply instructions, not no assembly at all. |
| Go purego | `-tags purego` | The amd64 assembly behind `crypto/aes` and its GCM (AES-NI and PCLMULQDQ), and `x/crypto`'s `chacha20poly1305` (SSSE3 and AVX2) and `poly1305`, whose files build under `gc && !purego`. `x/crypto`'s `chacha20` has no amd64 assembly of its own. What is left is Go's generic code. |
| Rust soft | `--cfg aes_backend="soft"`, `polyval_backend="soft"`, `chacha20_backend="soft"`, `poly1305_backend="soft"` | The AES-NI, CLMUL, AVX2 and SSE2 backends of `aes`, `polyval` (which `ghash` is built on), `chacha20` and `poly1305`, leaving their portable Rust. |
| Node | — | `node:crypto` is OpenSSL's libcrypto with its assembly, and Node has no switch that turns it off. |

`portableProof` is `aes128gcm-seal@16384`, a full TLS record under the cipher
every TLS stack negotiates first. AES-NI and PCLMULQDQ carry that kernel, and
`portableProofFlags` names both, so OpenSSL's proof is held only on a CPU that
has them. Every twin keeps the default 1.2 minimum ratio. On this family's
reference machine (AES-NI, PCLMULQDQ, AVX2, AVX-512F), at that case, OpenSSL
portable takes 7.1x the time of OpenSSL, Go purego 7.3x that of Go, and Rust
soft 6.2x that of Rust. ChaCha20-Poly1305 loses much less, since its portable
code is plain 32-bit arithmetic: at 16 KiB, OpenSSL's scalar assembly is within
1.1x of its SIMD path, Go purego takes 2.2x and Rust soft 1.9x.
