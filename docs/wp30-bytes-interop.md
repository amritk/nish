# WP30 — Bytes across the boundary: `u8[]` interop

**Status:** Proposed. Nothing in `src/` or `self/` has changed. The measurements
below were taken on Linux x64, Node 22, with `bench/worker.mjs` and the
freestanding wasm profile; read them as ratios rather than as absolutes.

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

`typedView` in `src/interop/abi.ts` has four cases and none of them is `u8`, so
`wasmSkipReason` declines the function and `--emit-dts` writes a comment
instead of a declaration and no loader entry:

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
| B1 | the `u8` and `u16` rows in `typedView`, `elemSize` widened, the skip reason corrected; `src/` and `self/` both, byte-identical through `tests/self/interop_oracle.js` |
| B2 | a `u8[]` case in the interop corpus — `tests/self/interop_payloads.ts` is where the widths already live — plus the golden `.ll`, an `llvm-as` pass, a native round trip, and a negative test for a `u8[]` the generator must still decline |
| B3 | the `docs/LANGUAGE.md` rule and the `docs/IR_COOKBOOK.md` entry, including the no-masking note above |

B1 is the change; B2 and B3 are the definition of done applied to it.

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
| `web/bytes-worker.mjs` | the hand-rolled host, with the `TODO(WP30)` marking what becomes generated |
| `bench/worker.mjs` | the boundary measurements quoted above |
