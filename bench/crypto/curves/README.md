# The curves family

X25519, ECDSA over P-256 and Ed25519. The harness in
[`../README.md`](../README.md) gives the program contract, the input stream and
the `family.json` schema.

## Kernels and their inputs

| Kernel | Key | Message | Before the clock | One iteration | Output folded |
| --- | --- | --- | --- | --- | --- |
| `x25519-base` | — | 32 bytes, the scalar | — | X25519 of the tweaked scalar and the base point (9) | the 32-byte public key |
| `x25519` | 32 bytes, the scalar | 32 bytes, the first peer point `u` | — | `u` = X25519(key, `u`): each answer is the next peer point, and the message is not tweaked | the 32-byte shared secret |
| `p256-sign` | 32 bytes, the private scalar | `size` bytes | the public key | SHA-256 of the tweaked message, then ECDSA's signature of that digest | the 65-byte uncompressed public key first; then, after the clock stops, each digest and one byte saying whether its signature verifies |
| `p256-verify` | 32 bytes, the private scalar | `size` bytes | the ring (below) | SHA-256 of ring entry `i % 16`, then ECDSA's verify | the 65-byte public key first, then one byte per verify: 1 true, 0 false |
| `ed25519-sign` | 32 bytes, the seed (RFC 8032) | `size` bytes | the public key | the Ed25519 signature of the tweaked message | the 32-byte public key first, then each 64-byte signature |
| `ed25519-verify` | 32 bytes, the seed | `size` bytes | the ring (below) | the Ed25519 verify of ring entry `i % 16` | the 32-byte public key first, then one byte per verify |

The unit is op/s everywhere: a curve operation costs the same whatever the
message's length. The X25519 kernels' size is 32, the length of a point and a
scalar; the others' is the message's length, at least 4, and 64 here.

**The ring.** Before the clock starts, entry `j` of 16 is the message tweaked
with `j` and signed. Entry 1 then has its last byte flipped, so its verify must
answer false and every other one true; a twin that gets one wrong exits 1.

**Why `p256-sign` folds a verify.** ECDSA's nonce is random in Go and OpenSSL,
so no two twins' signatures agree. What every twin agrees on is the digest it
signed and that the signature verifies, so that is the fold. The verify runs
after the clock stops, and the time it takes is added back to the start, so the
reported time is the signing loop's alone. Ed25519 is deterministic, so
`ed25519-sign` folds the signatures themselves.

## The programs

| File | Twin | Calls |
| --- | --- | --- |
| `main.ts` | Nish | `x25519Base` and `x25519` from `nish/crypto/x25519`; `sha256` then `p256Sign` to sign (and `p256Verify` to check each signature after the clock stops), and `p256SignSha256` to build the ring and `p256VerifySha256` to verify it, from `nish/crypto/p256`. Each scalar goes in as a `Secret<u8[]>` and is wiped. It has no Ed25519 kernel: std/crypto has no Ed25519, so those rows read "not in std/crypto". |
| `openssl.c` | OpenSSL 3 | The `EVP_PKEY` API throughout. X25519 of the base point builds the key from the raw scalar and reads its public key, each iteration, because that is the only way in; the ladder derives against a peer key built from `u` each iteration. ECDSA hashes with `EVP_Digest` and signs or verifies the digest with `EVP_PKEY_sign` / `EVP_PKEY_verify`; Ed25519 uses `EVP_DigestSign` / `EVP_DigestVerify`. |
| `go/` | Go's standard library | `crypto/ecdh`'s `X25519` (`NewPrivateKey` computes the public key; `ECDH` against `NewPublicKey(u)`), `ecdsa.SignASN1` / `VerifyASN1` over `sha256.Sum256`, and `crypto/ed25519`. The P-256 key comes in through `x509.ParseECPrivateKey`, Go's one route from a raw scalar. No dependencies. |
| `rust/` | dalek and RustCrypto | `x25519-dalek` 3.0.0, `ed25519-dalek` 3.0.0, and `p256` 0.14.0 with `sha2` 0.11.1, pinned exactly in `cargo.toml` and locked. P-256 signs and verifies the SHA-256 digest through the prehash traits. |
| `node.mjs` | `node:crypto` | `createPrivateKey` and `createPublicKey` on the DER that wraps a raw key, `diffieHellman`, `sign` and `verify`. |

Every twin builds a key it holds fixed before the clock starts, and a key that
changes each iteration (the base-point scalar, the ladder's peer point) inside
it, so OpenSSL's and Node's key objects cost them on those two rows.

The Nish program has three performance notes (`NL` warnings) from values kept
across iterations of a timed loop: the X25519 calls store an allocation, so no
`using arena()` may wrap them.

## The portable columns

| Column | How | What it removes |
| --- | --- | --- |
| OpenSSL portable | `OPENSSL_ia32cap="~0x1000000000000000:~0x80120"` | The first word clears AVX (bit 60, leaf 1 ECX bit 28); the second, leaf 7's EBX, clears AVX2 (bit 5), BMI2 (bit 8) and ADX (bit 19). P-256's `ecp_nistz256` assembly drops to its non-MULX/ADX path, and X25519's ladder from the 64-bit-limb MULX/ADX field code to the C `fe51` code. X25519 of the base point and Ed25519 run the same C curve code with or without the mask (only Ed25519's SHA-512 changes), so those rows are in `portable.lacks`. |
| Go purego | `-tags purego` | The assembly in `crypto/internal/fips140/nistec` (P-256), the `edwards25519` field and SHA-512; what is left is generic Go. It reaches all six kernels. |
| Rust soft | `--cfg curve25519_dalek_backend="serial"` and `--cfg sha2_backend="soft"` | `curve25519-dalek`'s AVX2/AVX-512 backend, which only its variable-base multiscalar code (Ed25519 verify) uses, and `sha2`'s assembly. X25519, Ed25519 signing (a base-point table) and `p256` (pure Rust) are the same code either way, so those five rows are in `portable.lacks`. |
| Node | — | `node:crypto` is OpenSSL's libcrypto with its assembly, and Node has no switch that turns it off. |

`portableProof` is `x25519@32`, the kernel where OpenSSL's mask costs the
most, then `p256-verify@64` for a column that comes up short there. OpenSSL
3.0's curve assembly is not switched off by any mask, only its MULX/ADX paths
are, so OpenSSL portable takes about 1.1x the time of OpenSSL on every row it
reaches: on this family's reference machine (with `bmi2` and `adx`), 1.11x to
1.14x at `x25519`, 1.09x at `p256-verify` and 1.08x at `p256-sign`, against a
noise band of about ±4% (the default binary timed against itself in the same
rounds). OpenSSL's floor is therefore 1.05x, above that band, rather than the
default 1.2x. Go purego took about 1.6x the time of Go at `x25519` under Go
1.24, but Go 1.25 narrows it: 1.23x on one x86-64 machine, just over the 1.2x
floor, and 1.09x on CI's runner, under it. Its proof therefore falls through
to `p256-verify`, where purego gives up the `nistec` assembly and takes 2.5x
the time of Go. `x25519` stays first because OpenSSL's mask costs less at
`p256-verify`, and nothing at all on the machine that measured Go's 2.5x.
Rust's portable build lacks both proof kernels, so its proof reads "unproved"
and its ratio is `null`: its Ed25519 verify row shows the backend's cost,
about 1.4x.
