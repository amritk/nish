# WP30 — Bytes across the boundary: `u8[]` interop

**Status:** Built. B1, B2 and B3 are all done. The measurements below were taken on
Linux x64, Node 22, with `bench/worker.mjs` and the freestanding wasm profile;
read them as ratios rather than as absolutes.

B1 grew by two rows while it was being built, and the reason is worth keeping:
the package was scoped as `u8` plus `u16`, but `u32` and `u64` have exact
typed arrays too (`Uint32Array`, `BigUint64Array`) and are the same one line
each. Leaving them out would have left `u32[]` declining with the same wrong
reason this package exists to delete, so all four unsigned widths landed
together.

A host that wants to hand a Nish module a document — JSON, UTF-8 text, a frame,
anything that is a run of bytes — has no way to do it. Every other array shape
crosses: `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` each have
a row in `src/interop/abi.ts` and a generated loader entry. Bytes do not, so the
one payload shape a network or a file actually delivers is the one shape the
boundary refuses.

This note is short because the work turns out to be small, and it is worth
writing down *why* it is small: the language and the runtime both have `u8[]`
already, and only the generator does not.

## 1. The decision

**Add `u8` (and `u16`, which comes free with the same change) to the typed-view
table, so that `Uint8Array` crosses the wasm and N-API boundaries exactly as
`Int32Array` does today.** No new runtime, no new language surface, no new
ABI — one row in a table that both compilers already read, plus the loader
entry that row generates.

## 2. What already works

Each of these was checked rather than assumed.

**The language has `u8[]`.** It parses, checks, and lowers to the same array
representation as every other element type:

```ts
export function countQuotes(bytes: u8[]): i32 {
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 34) n = n + 1;
  }
  return n;
}
```

```llvm
define noundef i32 @countQuotes(%struct.nish_array* noundef nonnull align 8
                                dereferenceable(24) readonly nocapture %bytes) #0 {
```

The `readonly nocapture` is the whole-program fixpoint doing its ordinary job on
a byte array, which is the point: nothing about `u8[]` is special to the
compiler.

**The runtime has it.** `nish_alloc_array(elem_size, len)` takes the element
size as a parameter, so `nish_alloc_array(1, n)` is a byte buffer in the arena
and `runtime/runtime_wasm.c` needs no change at all. A hand-written host over
the freestanding profile calls the export today and gets the right answer;
`web/bytes-worker.mjs` is that host, and `bench/worker.mjs` runs it.

**The wasm profile links it.** `bench/scan.ts` — a `u8[]`-taking scanner —
builds to a 1,463-byte module under `--profile wasm` with
`runtime/runtime_wasm.c` and scans at roughly 346 MB/s.

## 3. What is missing, exactly

*This section describes the state B1 changed; it is kept because the reasoning
is what sized the package.*

`typedView` in `src/interop/abi.ts` had four cases and none of them was `u8`,
so `wasmSkipReason` declined the function and `--emit-dts` wrote a comment
instead of a declaration, and no loader entry:

```ts
// countQuotes(bytes: u8[]): number  -- not exported to JS: argument 1 (bytes) is
// `u8[]`, which needs the Nish runtime the freestanding wasm profile does not include
```

**That reason is wrong**, and fixing the wording is part of this package rather
than a separate tidy-up. A `u8[]` parameter needs nothing the freestanding
profile lacks — the sentence is the one `string` earns, reused for a type that
does not earn it. A reader who believes it concludes that bytes need a WASI
build, which is the opposite of true. The predicate is shared between the
declarations and the loader (`src/interop/wasm.ts`, the one-predicate rule this
package must not break), so the row and the reason move together.

`elemSize` is typed `4 | 8` and becomes `1 | 2 | 4 | 8`. That is the only
signature in the generators that widens.

**No per-element masking.** The scalar `u8` boundary needs `x & 0xff` in each
direction (`docs/wp8-interop.md`, "The unsigned widths"), and an array needs
neither: `Uint8Array.prototype.set` truncates on the way in and a `Uint8Array`
view can only yield 0–255 on the way out, so the mask the scalar path spells by
hand is the typed array's own store semantics. The narrow-width story gets
*simpler* at the array boundary, not more complicated — worth a line in the
cookbook, because it reads like an omission otherwise.

## 4. Deliverables

| | |
| --- | --- |
| B1 | **done** — the four unsigned rows in `typedView`, `elemSize` widened to `1 \| 2 \| 4 \| 8`; `src/` and `self/` both, byte-identical through `tests/self/interop_oracle.js` (17/17 programs, 85 sidecars) |
| B2 | **done** — `tests/self/interop_unsigned_arrays.ts` in the oracle corpus; `tests/cases/arr_u8` with its golden `.ll`, `llvm-as`, `opt -passes=verify` and a native round trip against `.out`; and the negative half, `boolean[]` and `string[]` still declined and named, asserted absent from the loader as well as commented in the declarations |
| B3 | **done** — the `docs/LANGUAGE.md` rule (the type table and the typed-array bullet) and the `arr_u8_elements` cookbook entry, whose IR `docs/cookbook/regen.sh --check` keeps honest |

B1 was the change; B2 and B3 are the definition of done applied to it.

The pin worth knowing about is in B2's loader check, because it is the one that
would catch this package being over-applied. `fillU8(xs: u8[], v: u8)` puts both
rules in one generated call:

```js
fillU8: (xs, v) => scoped(() => {
  const xs$ = arrayIn(xs, Uint8Array, 1, "fillU8: argument 1 (xs)");
  raw.fillU8(xs$, v & 0xff);
  copyBack(xs$, xs);
}),
```

The `u8[]` crosses in memory and is handed over untouched; the scalar `u8`
crosses in an i32 value type and is masked. A generator that copied the scalar
rule onto the array would mask the view, and a generator that copied the array
rule onto the scalar would drop `& 0xff` — `tests/run.js` asserts both spellings
so either mistake is a red check rather than a wrong number at a host.

B3 also corrected a stale sentence rather than only adding to it.
`docs/LANGUAGE.md` said there was "no `Uint8Array` / `Float32Array`", which was
wrong about `Float32Array` — it has been in the alias table for some time — and
became misleading about `Uint8Array` the moment `u8[]` started crossing. The
bullet now says what is true: the alias names are exactly four, an unsigned
array has none, and that asymmetry is a spelling rather than a capability.

Two things B1 turned up that were not in the plan.

**The skip reason needed no correction after all.** Adding the rows made `u8[]`
cross, so the sentence that blamed a missing runtime is no longer reached for
it. What remains behind that sentence — `boolean[]`, `string[]`, nested arrays,
classes — is a separate question about whether each one's reason is accurate,
and it is left open rather than quietly folded in here.

**The indefinite article was wrong, and only the new rows could show it.**
`withArticle` and the generated loader's `TypeError` both tested `/^[AEIOU]/`,
which is right for `Int32Array` and wrong for `Uint8Array`: a host read
`must be an Uint8Array`. The rule had held by accident while `Int32Array` was
the only vowel-initial constructor in the table. `u` is now out of the set in
all four places (both compilers, both generators) on the grounds that the
article follows the vowel *sound* — "a user", "a Uint8Array" — and every
`u`-initial noun these reach is a `Uint*Array`.

## 5. Two findings next door

Both were measured while scoping this and neither belongs in it. They are
recorded here so that the next person does not have to rediscover them.

**`arrayOut` allocates, and at size the allocation is the cost.** The generated
loader ends an array-returning call with
`new Float64Array(memory.buffer, data, len).slice()`. At 25 MB:

| | |
| --- | --- |
| `.slice()`, a fresh typed array per call | 44.8 ms |
| `.set()` into a buffer the caller owns | 1.8 ms |

25x, and it is the allocation rather than the copy — the copy runs at about
15 GB/s in both. The `.slice()` is the right *default* and `docs/wp8-interop.md`
already says why (the next `memory.grow` detaches the view, and `scoped`'s arena
release lets the module overwrite it), but a caller-owned destination should be
reachable. It changes a generated signature, so it is its own package.

**`nish_alloc_array` costs a `BigInt` per call from JavaScript.** Both
parameters are `u64`, so a JS caller allocates a `BigInt` to make the call —
31 ns, against 23 ns for the allocation itself. A host can dodge it by
allocating once per batch and rewriting the header's `len` field as two `i32`
stores, which is what `web/bytes-worker.mjs` does and what took its per-document
cost from 947 ns to 512 ns. Whether the generator should do that batching, or
the runtime should export a `u32` companion, is a question for whoever owns the
loader next.

## 6. Why this is the blocking item

A bytes-in validator is the motivating case (`bench/scan.ts` is its hot loop in
miniature), and the numbers say the boundary is not what stands in its way:

| | |
| --- | --- |
| `JSON.parse` of a 164-byte document | 1,643 ns |
| the same document copied into the arena and scanned, batched | 512 ns |
| the copy and call alone, without the scan | ~68 ns |

The work is already 3x cheaper than `JSON.parse` and the boundary is 4% of it.
Without the `u8[]` row, none of that is reachable from a generated loader: the
only way to pass bytes today is to inflate each one into an `i32` and ship four
times the payload, which changes what is being measured.

## 7. Files

| File | Role |
| --- | --- |
| `src/interop/abi.ts` | `typedView`, `elemSize`, the rows this package adds |
| `src/interop/wasm.ts` | `wasmSkipReason` and the loader it generates from the same predicate |
| `self/interop_abi.ts`, `self/interop_wasm.ts` | the same two in Nish; the oracle compares the output byte for byte |
| `bench/scan.ts` | a `u8[]`-taking scanner: the shape this package unblocks |
| `tests/self/interop_unsigned_arrays.ts` | the oracle corpus case: every unsigned width as an array, and the positions where a mask would be wrong |
| `tests/cases/arr_u8` | the native round trip: a byte array allocated, written, read back, and wrapped at 255 |
| `docs/cookbook/arr_u8_elements.ts` | the lowering at width 1, regenerated by `docs/cookbook/regen.sh` |
| `web/bytes-worker.mjs` | the hand-rolled host, with the `TODO(WP30)` marking what becomes generated |
| `bench/worker.mjs` | the boundary measurements quoted above |
