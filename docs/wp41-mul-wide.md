# WP41: a 64×64→128 multiply, measured on Poly1305 before it is built

**Status: measured; the bar is missed, and nothing ships but this record.**
This note is the record of stage s8 of the FFI-reach run (#678). It states the
bar first, as it was committed before any kernel was timed, then the figures
and the decision. The radix-2^64 kernel is 14–21% faster natively on x86-64
and 19–27% slower on wasm32 over the three runs of §4, and the bar counts a wasm32 loss outside the noise
band as a miss. It adds no
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

## 4. The figures

The measured tree is commit `8cceabe` on this record's pull request. It holds
everything the bar needed, and the commit after it takes all of it out again:

- the `nish:arith` builtins. `mulHigh(a, b)` lowers to a `zext`, `mul i128`,
  `lshr 64` and `trunc`. IR compiled for the host carries the 32-bit-halves
  sequence as well, picked by the pointer width, so `opt` folds it to the
  `i128` arm on x86-64 and to the halves on wasm32. `mulLow` is `mul i64`.
- the radix-2^64 Poly1305 kernel.
- `bench/mul-wide.ts`, `bench/mul-wide-kernels.ts` and `bench/mul-wide.mjs`.

On x86-64 a `mulHigh` and `mulLow` pair on the same operands fused into one
`mulq`, so the block function made four `mulq` where radix 2^26 makes 25
`imul`. The wasm module, linked with `scripts/build.sh --profile wasm`, has no
`__multi3` and no imports.

The kernel was correct. `tests/link/crypto_chacha20poly1305`, with the RFC 8439
vectors and the Wycheproof AEAD set, printed its expected output byte for byte.
Both kernels gave the same checksum. The bench at `8cceabe` pins only its
`--check` run, a short native run at scale 64 that prints `checksum 3090113157`.

**The workload.** It is the bar's: 2^12 MACs, each over a 64 KiB message with
one byte changed from the last, under one key. Every tag is folded into an
FNV-1a checksum, which is printed. Every column printed `checksum 2156522685`
on every run, but nothing in `8cceabe` pins that value.

**The columns.** There are three:

- `base`, the radix-2^26 kernel frozen from `main`
- `std`, the radix-2^64 kernel
- `base (copy)`, a byte-identical copy of `base` that measures the noise band

Natively the copy is a copied binary. Under wasm it is a second instance of a
copied module. The columns ran in 30 interleaved rounds of three after a
warm-up, with the first column rotating. Only `macRun` is timed, not process
start.

`node bench/mul-wide.mjs --runs 30` at `8cceabe`, on an Intel Xeon at 2.10 GHz
(x64), Node v22.22.0:

| | column | min ms | median ms | min against base | median against base |
|---|---|---:|---:|---:|---:|
| native | base | 201.8 | 236.4 | | |
| native | **std (radix 2^64)** | 173.2 | 191.3 | **−14.2%** | **−19.1%** |
| native | base (copy): the band | 204.1 | 235.4 | +1.1% | −0.4% |
| wasm32 | base | 301.4 | 325.2 | | |
| wasm32 | **std (radix 2^64)** | 358.2 | 398.7 | **+18.8%** | **+22.6%** |
| wasm32 | base (copy): the band | 299.1 | 319.8 | −0.8% | −1.7% |

The two earlier runs at the same tree agree:

| run | native std, min / median | native band | wasm32 std, min / median | wasm32 band |
|---|---|---|---|---|
| 15 rounds | −18.2% / −14.7% | +0.2% / +1.4% | +22.2% / +27.3% | +2.7% / +4.0% |
| 30 rounds | −18.4% / −21.1% | −0.5% / −2.8% | +24.2% / +19.3% | +0.3% / −0.9% |

**Radix 2^44.** The bar also allowed radix 2^44, and it was measured over 15
rounds. That kernel was a local variant of the bench and was never committed, so
these figures cannot be rebuilt from `8cceabe`. It is a three-limb kernel that takes each product's bits above 2^44 as
`(lo >>> 44) | (mulHigh << 20)`, so no 128-bit carry is ever tested. Its nine
full products made it no faster natively: +0.1% / −4.0% against base, inside a
band of −1.2% / −2.4%. On wasm32 it was +95.5% / +93.5% slower.

## 5. Why wasm32 loses

wasm has no 64×64→128 multiply, so each `mulHigh` on wasm32 is the
schoolbook product of the 32-bit halves. That is 16 operations: four masks and
shifts to split the operands, four `i64.mul`, and eight shifts, masks and adds
to combine them. The radix-2^64 block needs four 128-bit products, so it does
up to 64 operations on wasm32 where x86-64 needs four instructions. The figure
is before LLVM reuses any split that two products share.

The cost of those operations was measured directly, with a local variant that
was never committed. The halves were replaced with a single, wrong
`(a >>> 32) * (b >>> 32)`, and that kernel ran in about
300–310 ms on wasm32, level with `base`. The halves are the whole of the loss.
The carry detection the radix-2^64 kernel needs, `((a & b) | ((a | b) & ~s))
>>> 63` at seven points per block, is not where the time goes.

No cheaper sequence exists for a general `mulHigh`. A Poly1305-specific one
does exist: the clamp keeps each 32-bit half of `r` below 2^29, so the middle
sum cannot overflow and the masks could go. But that sequence would have to be
written in the kernel itself. Nothing in the language picks a sequence by
target, and that kernel would then lose the single `mulq` natively.

## 6. The decision

The bar is missed. The native win is real and outside the band: −14.2% /
−19.1% against a band of +1.1% / −0.4%. The wasm32 loss is also outside its
band: +18.8% / +22.6% against −0.8% / −1.7%. The bar says a wasm32 loss
outside the band is a miss.

By §3, the builtin and the kernel are dropped. `std/` keeps the radix-2^26
kernel, nothing in `src/` changes, and this record is all that lands. The bench
went with the kernel, since it measured that kernel against `main`'s.
`8cceabe` holds the builtin, the radix-2^64 kernel and the three-column bench,
so the table above can be rebuilt from it. The radix-2^44 figures and the
single-multiply experiment cannot.

**What would reopen this.** Either of two things:

- A way for `std/` to choose a kernel by target, which would let wasm32 keep
  radix 2^26 while x86-64 and aarch64 take radix 2^64.
- A bar that judges native and wasm32 separately.

Either one makes this stage's code, at `8cceabe`, the place to start.
