# WP30 — Bytes across the boundary: `u8[]` interop

**Status: complete.** B1 to B3 shipped in 0.6.0
([#138](https://github.com/amritk/nish/pull/138)): `u8[]`, `u16[]`, `u32[]` and
`u64[]` cross the wasm and N-API boundaries as `Uint8Array`, `Uint16Array`,
`Uint32Array` and `BigUint64Array`, exactly as `Int32Array` already did. The
rule is in [LANGUAGE.md](LANGUAGE.md) (the type table and the typed-array
bullet) and the lowering in [IR_COOKBOOK.md](IR_COOKBOOK.md)'s
`arr-u8-elements` entry. Measurements were taken on Linux x64, Node 22, with
`bench/worker.mjs` and the freestanding wasm profile; read them as ratios.

## What shipped, and why it was small

A host that wanted to hand a Nish module a document — JSON, UTF-8 text, a
frame — had no way to: every other array shape had a row in the interop
generator's typed-view table, and bytes, the one payload a network or a file
actually delivers, did not. The work was small because only the generator was
missing anything: the language already had `u8[]` (it lowers to the ordinary
array and gets `readonly nocapture` from the fixpoint like any other), and the
runtime's `nish_alloc_array(elem_size, len)` already took the element size, so
`runtime/runtime-wasm.c` needed no change.

So the change was four rows in `typedView` in `src/interop-abi.ts` and the
loader entries they generate (`src/interop-wasm.ts`), with `elemSize` widened
from `4 | 8` to `1 | 2 | 4 | 8`. The package was scoped as `u8` and `u16`; `u32`
and `u64` have exact typed arrays too and are one line each, and leaving them
out would have left them declined for the wrong reason, so all four unsigned
widths landed together. The old skip reason had blamed "the Nish runtime the
freestanding wasm profile does not include" — the sentence `string` earns,
wrongly reused for a type that does not — and with the rows in place it is no
longer reached for these types. Whether its remaining uses (`boolean[]`,
`string[]`, nested arrays, classes) are each accurate was left open.

**No per-element masking.** The scalar `u8` boundary masks with `& 0xff` in
each direction ([wp8-interop.md](wp8-interop.md), "The unsigned widths"); an
array needs neither, because `Uint8Array.prototype.set` truncates on the way in
and a `Uint8Array` view can only yield 0–255 on the way out. `fillU8(xs: u8[],
v: u8)` puts both rules in one generated call — the array handed over
untouched, the scalar as `v & 0xff` — and `tests/run.js` asserts both
spellings, so a generator that copied either rule onto the other is a red check
rather than a wrong number at a host.

**The indefinite article.** The loader's `TypeError` and `withArticle` tested
`/^[AEIOU]/`, which held by accident while `Int32Array` was the only
vowel-initial constructor: a host read `must be an Uint8Array`. The article
follows the vowel *sound*, so `U` left the set.

Evidence: `tests/self/interop-unsigned-arrays.ts` (every unsigned width as an
array, and the positions where a mask would be wrong), `tests/cases/arr_u8`
(golden `.ll` and a native round trip that wraps at 255), the negative half
(`boolean[]` and `string[]` still declined, and absent from the loader), and
`docs/cookbook/arr-u8-elements.ts`.

## Why it was the blocking item

A bytes-in validator is the motivating case (`bench/scan.ts` is its hot loop;
1,463 bytes of wasm, about 346 MB/s):

| | |
| --- | --- |
| `JSON.parse` of a 164-byte document | 1,643 ns |
| the same document copied into the arena and scanned, batched | 512 ns |
| the copy and call alone, without the scan | ~68 ns |

The work is 3x cheaper than `JSON.parse` and the boundary is 4% of it; without
the row the only way in was to inflate each byte to an `i32`.

## Deferred: two findings next door

Both were measured while scoping this, and neither has been taken up.

- **`arrayOut` allocates, and at size the allocation is the cost.** The loader
  ends an array-returning call with `new Ctor(memory.buffer, data, len).slice()`.
  At 25 MB that is 44.8 ms against 1.8 ms for `.set()` into a caller-owned
  buffer — 25x, the allocation rather than the copy. `.slice()` is the right
  default (the next `memory.grow` detaches a view, and the arena release lets
  the module overwrite it), but a caller-owned destination changes a generated
  signature, so it is its own package.
- **`nish_alloc_array` costs a `BigInt` per call from JavaScript**, because
  both parameters are `u64`: 31 ns against 23 ns for the allocation. A host can
  allocate once per batch and rewrite the header's `len` as two `i32` stores,
  which is what `web/bytes-worker.mjs` does (947 ns to 512 ns per document).
  Whether the generator should batch, or the runtime should export a `u32`
  companion, is open.
