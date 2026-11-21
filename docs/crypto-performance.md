# Where Nish's crypto is behind portable code

[#475](https://github.com/amritk/nish/issues/475) asks for an analysis of every cell of
[the crypto benchmark](BENCHMARKS.md#crypto-against-other-languages) where Nish
portable runs more than 1.5x behind the fastest portable twin. This page is that
analysis, read against the table recorded with it (Intel Xeon @ 2.30GHz, 4 CPUs,
Nish 0.42.0, OpenSSL 3.0.13, Go 1.26.0, rustc 1.97.0). Its figures are that
table's; a figure computed from it is marked *derived*. A cause named here is
what the code does, read from `std/crypto/`; none of the fixes suggested was
built or timed.

**Which twin is portable.** The verdict column divides by the fastest of
OpenSSL portable, Go purego and Rust soft. The OpenSSL column masks the vector
extensions with `OPENSSL_ia32cap`, but what is left is still OpenSSL's x86-64
assembly over the general registers. ChaCha20, SHA-512 and P-256 (whose
assembly the table's notes say no mask moves) all have such a path, so in those
rows the verdict is against hand-written assembly. Each section below also
gives the quotient against the best *compiled* portable twin (Go purego or Rust
soft), which is the comparison between compilers.

## The cells

| Family | Kernel | Sizes | Nish / best portable | Against compiled twins (*derived*) |
| --- | --- | --- | --- | --- |
| aead | aes128gcm, aes256gcm seal and open | 64 B | 1.586x to 1.734x (go-purego) | the same |
| aead | chacha20poly1305 seal and open | 1350 B to 1 MiB | 2.262x to 2.468x (openssl-portable) | 1.35x to 1.40x (go-purego) |
| curves | x25519-base | 32 B | 2.000x (go-purego) | the same |
| curves | x25519 | 32 B | 2.334x (openssl-portable) | 2.006x (go-purego) |
| curves | p256-sign | 64 B | 3.243x (openssl-portable) | 0.977x, level (go-purego) |
| curves | p256-verify | 64 B | 6.110x (openssl-portable) | 2.326x (go-purego) |
| curves | ed25519-sign | 64 B | 10.753x (go-purego) | the same |
| curves | ed25519-verify | 64 B | 6.065x (rust-soft) | the same |
| handshake | tls13 | 32 B | 1.645x (go-purego) | the same |
| hash | sha256 | 64 B | 1.598x (rust-soft) | the same |
| hash | sha512 | 64 B, 1 KiB, 1 MiB | 2.612x, 1.876x, 1.721x | 2.618x, 1.605x, 1.391x (rust-soft) |
| hash | hmac-sha256 | 64 B | 1.609x (rust-soft) | the same |
| hash | hkdf-sha256 | 32 B | 2.176x (rust-soft) | the same |
| x509 | x509-parse | 338 B | 2.506x (openssl-portable) | 2.416x (go-purego) |

Every other cell is within 1.5x, and two are ahead: x509-mint (0.694x) and QUIC
(0.924x, inside its ±10.8% band).

## AES-GCM at 64 bytes

The same kernels are 1.355x to 1.490x behind at 1350 B and above, so what the
64 B rows add is a cost paid once per message. *Derived* from aes128gcm-seal:
Nish portable takes 1.19 µs a 64 B message, and 64 B at its 16 KiB rate is
0.66 µs, so about 0.53 µs is fixed; Go purego's fixed part, worked the same way,
is about 0.26 µs.

The code says where a pass goes. `std/crypto/aes.ts` is bitsliced: one pass of
the cipher encrypts four blocks (`AES_BATCH`, 64 bytes). A 64 B message is four
counter blocks, one pass, and then `aesGcmTag` encrypts J0 to mask the tag
through `aesEncryptOne`, which runs a whole pass for one block. A 64 B message
therefore pays two passes of the cipher for four blocks of data. A seal also
allocates its J0 block, the output, the tag words and the mask block.

At 64 B the second pass cannot be shared: the four counter blocks fill the
first pass. *Not built:* encrypt J0 in a pass the counter blocks leave room in,
which saves the extra pass for every message whose length in blocks is not a
multiple of four (1350 B is 85 blocks: 22 passes in place of 23), and keep the
per-message arrays in a scratch the key owns.

## ChaCha20-Poly1305 from 1350 bytes

Against Go purego, the gap is 1.35x to 1.40x; the 2.3x to 2.5x of the verdict
column is against OpenSSL's scalar assembly. Two things in
`std/crypto/chacha20poly1305.ts` cost more than they need to:

- `chacha20XorInto` makes one 64-byte block per call of `chacha20Core`, into a
  fresh `u32[16]`, and XORs it in byte by byte. There is no interleave of
  blocks in the Nish code; that is what the AVX2 and NEON kernel
  (`runtime/runtime-chacha20.c`) adds, and the Nish column shows it: 395 to
  462 MB/s against 242 to 266.
- Poly1305 is five 26-bit limbs in `u64`, twenty-five products a block. A
  130-bit accumulator in 64-bit limbs needs a 64 × 64 → 128-bit product, which
  Nish has had since the `mulHigh` builtin (WP41) but this module does not use
  yet. Poly1305 stays in Nish under the kernel too
  ([wp38-simd.md](https://github.com/amritk/nish/blob/main/docs/wp38-simd.md) §3.1 timed a C copy and found it within the
  noise), so it is a floor under both columns.

*Not built:* key the keystream into a buffer kept by the caller, XOR it a
`u32` at a time, and process two blocks per iteration of the Nish loop.

## X25519

`std/crypto/x25519.ts` keeps a field element as ten signed limbs of 26 and 25
bits in `i64`: a multiply is a hundred `i64` products, "no wide arithmetic". A
five-limb, 51-bit representation (OpenSSL's fe51, named in the table's notes)
needs twenty-five products, but each is 64 × 64 → 128: the `mulHigh` builtin
(WP41) gives the high half, and this module does not use it yet. `f25519Mul` also allocates a ten-limb `doubled` array on
every call, and a ladder makes about fourteen temporaries. `x25519Base` is the
same 255-step ladder from u = 9, with no precomputed table, which is why it
runs at the same rate as `x25519` (12,486 and 12,506 op/s) while Rust's table
base multiply runs at 84,357.

*Not built:* take the per-call allocations out of the field code, and move it
to five 51-bit limbs on `mulHigh`, the larger lever; the builtin exists, and
the port is not written.

## Ed25519

Ed25519 is the furthest behind, and the cause is in the shape of the
algorithms in `std/crypto/ed25519.ts`, not only in the field code it shares
with X25519:

- **Sign** multiplies the base point with `ed25519BaseMult`, which is
  `ed25519ScalarMult` of `ed25519Base()`: a fixed 4-bit signed window that
  builds its eight-entry table of multiples on every call, then makes 252
  doublings and 64 additions. There is no precomputed base table, as P-256 has
  (`p256BaseTable`, a 22 KiB comb). P-256 sign, with its table, is level with
  Go purego; Ed25519 sign, without one, is 10.753x behind it.
- **Verify** computes [S]B and [k]A as two separate fixed-window
  multiplications, each with its own table and its own 252 doublings, then adds
  them. There is no joint (Straus) multiplication with shared doublings, which
  P-256's verify has (`p256DoubleMultPublic`, width-5 wNAF).

*Not built:* a comb for B, generated like `p256BaseTable`, for signing and
public keys; and a joint multiplication for verify, which may be variable time
because its inputs are public.

## P-256

Against Go purego, sign is level (0.977x) and verify is 2.326x behind; the
3.2x and 6.1x of the verdict column are against OpenSSL's P-256 assembly,
which the table's notes say no `OPENSSL_ia32cap` mask moves. Sign is mostly
table reads and mixed additions from the 22 KiB comb; verify is mostly
doublings and additions on a variable point. The operation both lean on is the
field multiply, ported from fiat-crypto on four 64-bit limbs, whose high halves
are the `mulHigh` builtin (WP41), one multiply on x86-64 and AArch64; before it
they were four 32 × 32 products each. Both inversions are already safegcd (#780, #1469).

## TLS 1.3 handshake and x509-parse

Both rows are sums of the rows above:

- **x509-parse** times a DER parse and the certificate's self-signature check
  (`x509VerifySignature`, a SHA-256 and a P-256 verify; see
  `bench/crypto/x509/README.md`). Its 2.416x against Go purego is p256-verify's
  2.326x.
- **tls13** (1.645x) is a server handshake: an X25519, a P-256 signature, the
  key schedule's HKDF and HMAC calls, and AES-GCM records. X25519 is the
  largest module of a handshake ([wp34](https://github.com/amritk/nish/blob/main/docs/wp34-network-stack.md) K5), and HKDF's
  one-shot calls are 2.2x behind (below).

## SHA-512, and the small inputs of SHA-256, HMAC and HKDF

`std/crypto/sha512.ts` has no runtime kernel and no `NISH_` switch, so its two
Nish columns are the same code. At 1 MiB it is 1.391x behind Rust soft; the
gap widens as the input shrinks (2.618x at 64 B), so most of it is per call.
A one-shot `sha512` builds a `Sha512` (whose engine keeps an 80-word schedule),
zero-fills the rest of the last block a byte at a time and allocates its
output.

The 64 B rows of SHA-256 and HMAC, and HKDF, are per-call cost too:

- `sha256` allocates the hasher's state, block and 64-word schedule, then the
  digest: four arrays for one compression.
- One-shot `hmacSha256` allocates two hashers and a pad block and absorbs both
  pads on every call. The `HmacKey` midstates and `HmacSha256Scratch` exist to
  avoid this, and the benchmark does not use them.
- `hkdfExpandSha256` makes a new `HmacSha256` from the PRK for each output
  block, so it absorbs the key's pads again each time, and allocates a counter
  byte and a digest per block. Its header says so, and `HkdfScratch` with the
  `*Into` functions is the allocation-free route.

*Not built:* run the one-shot functions over a scratch the call owns, so the
default entry points stop paying for what `HkdfScratch` already avoids; and
fill SHA-512's padding a word at a time.
