# WP41: a 64×64→128 multiply, measured on Poly1305 before it is built

**Status: bar committed; not yet measured.** This note is the record of stage
s8 of the FFI-reach run (#678). It states the bar first, before any kernel is
timed, and the figures and the decision follow it once they exist. It adds no
rule to [LANGUAGE.md](LANGUAGE.md); where they disagree, LANGUAGE.md wins.

## 1. The question

Nothing in the language gives the high half of a 64-bit product. `std/`'s
field arithmetic works around it with narrow limbs: Poly1305 in
[`std/crypto/chacha20poly1305.ts`](../std/crypto/chacha20poly1305.ts) keeps
its accumulator in five 26-bit limbs with 64-bit products, x25519 in ten limbs
of radix 2^25.5, P-256 in u32 limbs. A widening multiply, `mulHigh(a, b)` and
`mulLow(a, b)` on `u64`, lets a field element live in fewer, wider limbs. It is
built only if it pays for itself on Poly1305, by the bar below.

## 2. The bar

Committed before any kernel is timed, verbatim from the plan:

> Poly1305 over a 64 KiB message, 2^12 MACs, each over a message one byte
> different from the last, folded into a printed checksum. The radix-2^26
> kernel on `main` against a wide-limb kernel (radix 2^44 or 2^64) on
> `mulHigh`/`mulLow`, plus a byte-identical copy of `main`'s for the noise
> band, in at least 15 interleaved rounds. **Met** if the new kernel's min and
> median are both faster than `main`'s by more than the noise band, natively
> on x86-64. A win on wasm32 is reported, not required. A loss there outside
> the band is a miss.

## 3. The decision rule

- **Bar met.** The builtin, the Poly1305 kernel on it, their tests and docs
  ship, with the figures of §4 in the commit's `Measured:` trailer.
- **Bar missed.** The builtin and the kernel are dropped, and this record
  ships alone with the figures, as WP38 recorded S3a.
