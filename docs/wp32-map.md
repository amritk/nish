# WP32: the global `Map` and `Set`

**Status: shipped, with one item open.** The design note and layout
prototypes (S1, [#227](https://github.com/amritk/nish/pull/227)), the global
`Map` and `Set` on `std/collections.ts` (S2,
[#229](https://github.com/amritk/nish/pull/229)), `get` typed
`V | undefined` (S3, [#232](https://github.com/amritk/nish/pull/232)),
iteration (S4, [#237](https://github.com/amritk/nish/pull/237)) and
`StringMap` on the same slot (S6,
[#228](https://github.com/amritk/nish/pull/228)) shipped in 0.11.0; fusion and
`nish/map` (S5, [#239](https://github.com/amritk/nish/pull/239)), the −0 key
([#247](https://github.com/amritk/nish/pull/247)) and the measurement (S7,
[#244](https://github.com/amritk/nish/pull/244)) in 0.12.0. Open: a `Map` read
inside a parallel body (§9.3) is still refused. The rules are normative in
[LANGUAGE.md → `Map` and `Set`](LANGUAGE.md#map-and-set); the lowering is in
[IR_COOKBOOK.md](IR_COOKBOOK.md); the timings are in
[BENCHMARKS.md](BENCHMARKS.md#map-and-set-wp32). This note keeps the decisions,
the evidence behind each, and the trigger that would reopen §10.

## 1. The decisions

| # | Question | Decision | § | Rejected |
| --- | --- | --- | --- | --- |
| 1 | Layout | Insertion-ordered. A `u32` bucket holds eight fingerprint bits above a 24-bit entry index plus one; entries sit in parallel arrays with each entry's full 32-bit hash stored. Cap 2^24 − 1 entries, one fewer than Node's. | 2 | an `i64` slot; the old `StringMap` shape; an unordered table |
| 2 | Load factor | At most 3/4 of buckets taken, dead entries counted until a rebuild. | 2.4 | 7/8 |
| 3 | `get`'s type | `V \| undefined`, narrowed by `!== undefined` / `=== undefined` or collapsed by `??`; bound only to a `const`; never crosses a call; lowered to two SSA values. | 3 | `has` + `get(k)!`; `get(k, default)` |
| 4 | Output | `std/collections.ts` writes no `.ll`; every instance and helper is emitted `internal` into each module that uses it. | 4.1 | a separate module |
| 5 | Names | `class Map<K, V>`, `class Set<T>`, mangled like any template; a module with its own `Map` gets no implicit import; one program with both is refused. | 4.2 | a reserved IR prefix |
| 6 | Keys | Strings, every integer width, `number`, `f64`, `f32`, `boolean`, enums, class instances by identity. Not interfaces, arrays, `T \| null` or `Result`. | 5 | records by value |
| 7 | Values | Anything but an `interface` (stored inline, so copied) and `void`. | 5.1 | copying records in |
| 8 | Hashing | FNV-1a for strings, `fmix32`/`fmix64` for integers, pointers and floats; floats normalised, equality SameValueZero; a hash of 0 moved to 1; unseeded. | 5.2 | a seeded hash; raw float bits |
| 9 | `delete` | A tombstone and a stored hash of 0; at the load bound, compact in place when more than half are dead, double otherwise; never shrink. | 6.1 | backward-shift deletion |
| 10 | Mutation during iteration | Exact JavaScript semantics; a live-walk counter defers compaction. | 6.2 | weaker semantics, or a refusal |
| 11 | `Set` | The same table with no values. | 6.3 | — |
| 12 | Small choices | `size` read-only `number`; `set`/`add` return `this`; constructor arguments refused; type arguments required on `new` except from an annotation. | 7 | `size()`; a `void` `set` |
| 13 | Interop | Opaque struct in `--emit-header`; unbridged, named, in `--emit-dts` and `--emit-napi`. | 8 | exposing the layout |
| 14 | Fusion | Three patterns, each one probe; nothing between probe and write may call, assign or allocate. | 9.1 | fusion through a call proven pure |
| 15 | Threads | `get`, `has` and `size` in a parallel body. **Not built.** | 9.3 | — |

**The hard requirement is the layout.** Each bucket carries a fingerprint
beside the entry index, and each entry stores its full hash, so a probe reads
the entry list only on a fingerprint match, growth and compaction re-file from
the stored hashes without hashing a key again, and `probe` answers either the
entry it found or the empty bucket it stopped at — which is what lets fusion
and `getOrInsert` write through one probe.

## 2. The layout

Four hand-written prototypes (`bench/map-proto-ordered.ts`,
`map-proto-ordered-fp.ts`, `map-proto-ordered-fp32.ts`,
`map-proto-unordered.ts`) implement `string → i32` and `i32 → i32` tables in
each candidate layout, against `bench/map-node.mjs` on Node's `Map`, over five
workloads (insert, hit, miss, word count, churn) whose checksums
`node bench/run.mjs --only maps --validate` requires to agree. They stay in the
instruction gate (`bench/instructions.json`), where they are the only
hash-table code: a regression in a probe loop moves their counts and nothing
else's.

Comparison (a), on a shared four-core VM (clang 18, Node 22.22.2,
`--profile speed`): the chosen `u32`-fingerprint layout was ahead of Node's
`Map` on every workload, 1.7x to 4.9x at 2^20 keys and 1.8x to 6.2x at 65,536,
and within 10% of the unordered layout on every workload in cache and eight of
ten out of it, ahead on insert and churn. Cells moved by up to a quarter between
sessions, so decisions rest only on differences that held in every session and
on instruction counts and peak RSS, which do not move.

Two language findings shaped `std/collections.ts`: `new Array<string>(n)` is
refused, so an unordered layout would need a different bucket type per kind of
`K` while the ordered one only ever `push`es a key; and a module constant cannot
be a `u32` or an `i64[]`, so sentinels are literals at their use.

### 2.3 What the fingerprint buys, counted

Entry-list reads per probe at 65,536 keys, over the string workloads:

| Layout | per hit | per miss |
| --- | ---: | ---: |
| ordered (old `StringMap`) | 1.49 | 1.47 |
| ordered + `i64` fp | 1.00001 | 0 |
| ordered + `u32` fp | 1.0017 | 0.0059 |
| unordered | 1.00001 | 0 |

The `u32` slot's false-match rate is the 1-in-256 its eight bits predict, and
the stored full hash, compared before the key, turns each one away, so the key
compare stays at one per hit. That is why string miss and string insert are
where fingerprints pay (1.7x and 2.1x over the `StringMap` shape at 2^20); on an
integer key a key compare costs what a fingerprint compare does, and the
fingerprints buy only growth without rehashing.

### 2.4 The decisions

- **A packed `u32` slot.** Never slower than the `i64` slot beyond the noise,
  faster on string insert and integer churn at 2^20, and half the bucket memory
  (168 MB of peak RSS at 2^20), for 7.6% more instructions in cache.
- **The cap is one entry short of Node's 2^24, deliberately.** An empty bucket
  is 0 and a tombstone is `0x01000000` (fingerprint 1, index 0), so the 24-bit
  field holds the index plus one and needs no reserved value; the 2^24-th entry
  would cost an `i64` slot. Past the cap an insert panics in Node's words,
  `Map maximum size exceeded`. While a loop walks the table nothing compacts
  (§6.2), so an insert at the cap during a walk panics however few entries are
  live.
- **The fingerprint is the hash's top eight bits; the bucket is
  `(h ^ (h >>> 16)) & mask`**, so neighbouring buckets keep independent
  fingerprints.
- **The full hash lives in the entry** (`hashes: u32[]`); a stored 0 marks a
  deleted entry, which is why a computed 0 becomes 1.
- **Load factor 3/4.** At 7/8, churn was 10–20% slower in both fingerprinted
  layouts: linear probing's expected miss length is 8.5 buckets at 3/4 against
  32.5 at 7/8, and the memory saved is only in the bucket array, under 1.5 bytes
  an entry beside at least 12 in the entry arrays.

## 3. `get`'s type

### 3.1 What `tsc` accepts

`tsc --strict` 5.9.3, with `const m = new Map<string, number>()`:

| # | Spelling | `tsc --strict` |
| --- | --- | --- |
| A | `const a = m.get(k); if (a !== undefined) { use(a); }` | accepted |
| B | `const b: number = m.get(k) ?? 0;` | accepted |
| C | `if (m.has(k)) { use(m.get(k)); }` | **TS2345** — `has` does not narrow `get` |
| D | `if (m.has(k)) { use(m.get(k)!); }` | accepted |
| E | `m.set(k, m.get(k) + 1);` | **TS2532** |
| F | `m.set(k, (m.get(k) ?? 0) + 1);` | accepted |
| G | `const g: number \| undefined = m.get(k);` | accepted |
| H | `maybe(m.get(k))` into `(x: number \| undefined)` | accepted |
| I | `let i = m.get(k); if (i !== undefined) { i = i + 1; }` | accepted |
| J | `const j: number = m.get(k);` | **TS2322** |

A program that type-checks reads a map one of three ways: narrow a binding (A),
default it (B, F), or assert after `has` (D).

### 3.2 The decision: `V | undefined`, admitted narrowly

`m.get(k)` is a *maybe*, admitted only as a `const` initialiser (unannotated or
annotated `V | undefined`), the left operand of `??`, or an operand of
`=== undefined` / `!== undefined`. A `let` (I), an argument (H), a return, a
store, a template hole and an arithmetic operand (E) are refused with a
diagnostic suggesting `??` or a `const` and a test; every refused spelling
fails under `tsc` too (E, J) or is one v1 chose not to need (H, I). `nish --fix`
now rewrites the `let`, argument and arithmetic cases to `m.get(k) ?? 0` (or
`0.0`, `""`, `false`) where `V` allows one.

- **Narrowing reuses the nullable *rules*, not the representation.** `T | null`
  exists only for pointer types, because `null` is a spare pointer value; a
  maybe covers every `V`, scalars included, so it is a found bit and a payload.
  A `const` cannot be reassigned, which is why `let` — the case that needs
  "narrowing ends at an assignment" — is refused.
- **`??` parses with TypeScript's precedence** and does not mix with `||` or
  `&&` unparenthesised (TS5076, a syntax error here too). Any other `??` keeps
  its refusal. For a nullable `V`, `??` also replaces `null`, as JavaScript's
  does.
- **It lowers to two SSA values**, the probe's found bit and the value loaded
  only when found. It never crosses a call and never reaches memory, so it
  needs no struct type: `get` is one probe, and `m.get(k) ?? d` that probe and a
  `select`.

**Why not `has` + `get(k)!`.** Under Node the `!` is erased and an absent key's
`undefined` flows on, while natively it would have to panic, so the runtimes
would disagree on exactly the wrong programs — and it is two probes. **Why not
`get(k, missing)`**: it is TS2554. **Why a maybe does not cross a call**:
`V | undefined` as a parameter type opens `undefined` in type positions and
needs a memory and ABI shape; relaxing that later turns a refusal into an
acceptance, so it can come in a minor.

## 4. Where the code lives

### 4.1 Output: instances go into the module that uses them

An imported generic's instances are normally defined by the declaring module,
which would make every program that names `Map` two modules and break
`-o x.ll`. So `std/collections.ts` is compiled and checked once but writes no
output; each instance, and every helper it reaches, is emitted into each module
that uses it with `internal` linkage. That keeps one-file goldens in
`tests/cases/` (cross-module programs are `tests/link/map_*`), and `internal` is
what gives a function this compiler's private calling convention — `linkonce_odr`
would merge copies and lose it, the wrong trade on a hot path. Two modules
passing one `Map<string, i32>` call their own copies, which agree because the
struct is laid out by name program-wide. A module that never names `Map` or
`Set` loads nothing, so every earlier program's IR is byte-identical.

### 4.2 The names, and a user's own `Map`

`%struct.Map$str$i32` and `@Map$str$i32.get` are ordinary template names, and
no reserved prefix is needed because **a user's own `Map` wins in its own
module**: a module that declares or imports a `Map` or `Set` gets no implicit
import. Class names are program-wide (NL3028), so one module declaring `Map`
while another names the global is refused, naming the declaring module — the
deviation from TypeScript every class name already has. Only the JavaScript
members of §7 resolve; `m.probe(...)` and the table's fields are refused as if
they did not exist, which under `tsc` they do not.

## 5. Keys, values and hashing

### 5.1 What may be a key, and what may be a value

| Kind | Key | Value | Why |
| --- | --- | --- | --- |
| `string` | yes | yes | compared by content; keys are immutable, so the pointer is stored |
| every integer width, `number` | yes | yes | by value |
| `f64`, `f32` | yes, SameValueZero | yes | −0 is +0 and NaN is NaN |
| `boolean`, enums | yes | yes | by value |
| a class | yes, by identity | yes | a class value is a pointer |
| an `interface` | **no** | **no** | stored inline, so `m.set(k, p); p.x = 1` would not change what `get` reads |
| `T[]` | **no** | yes | identity semantics surprise more than they help |
| `T \| null` | **no** | yes | waits for a program that wants a null key |
| `Result<T, E>` | **no** | yes | no identity, no useful equality |
| `void` | — | **no** | nothing to store |

### 5.2 Hash and equality per key type

`hashKey<K>`, `sameKey<K>` and `storedKey<K>` are intrinsics lowered per `K` in
`src/emit-map.ts` as inline IR, with no runtime call (the runtime's `.text`
budget has no room), and because `fmix64`'s constants are above 2^53, which a
Nish literal cannot spell.

| `K` | `hashKey` | `sameKey` |
| --- | --- | --- |
| `string` | FNV-1a, 32-bit, over the UTF-8 bytes | `nish_str_eq` |
| ≤ 32-bit integer, `boolean`, enum | `fmix32` of the zero-extended value | `icmp eq` |
| `i64`, `u64` | `fmix64`, halves XORed | `icmp eq` |
| `f64` | normalise, then its bits as `i64` | `fcmp oeq`, or both NaN |
| `f32` | normalise, `fpext`, then as `f64` | as `f64` |
| a class | the pointer as `i64` | pointer `icmp eq` |

Normalising makes −0 into +0 and every NaN the canonical one, so keys
SameValueZero calls equal hash equal; `storedKey` stores a −0 key as +0, as
JavaScript does (`map_key_negzero`). **Hash flooding is out of scope**: the hash
is unseeded, and since insertion order decides iteration order, it never
reaches a program's output, so a seeded hash can come later without changing
what any program prints.

## 6. Deletion, iteration and `Set`

### 6.1 `delete`, compaction and `clear`

`delete(k)` is one probe that writes the tombstone and zeroes the entry's
stored hash; a probe walks past a tombstone and an insert does not reuse it, so
taken buckets always equal entries live or dead and the load bound is one
compare. At the bound a rebuild **compacts at the same size** when more than
half the entries are dead and **doubles** otherwise, sliding live entries down
in order and re-filing from `hashes` with no key hashed or compared.
Compaction **reuses the bucket array**: with no collector, a fresh array per
compaction is unbounded garbage on churn, and reusing it took the `i64`
prototype's integer churn from 1,673 ms to 917 ms. Doubling still abandons the
old array, but those sum to less than the final one. The table never shrinks,
as an array keeps its capacity after `pop`. `clear()` truncates in place unless
a walk is live, in which case it marks every entry dead and keeps the count, so
the walk sees what is inserted afterwards, as JavaScript's does.

### 6.2 Iteration, and mutation during it

`for (const k of m.keys())` and `m.values()` walk the entries in index order,
skip dead ones, and **re-read the entry count every pass**, so the semantics
are JavaScript's exactly, because an entry never moves while a loop is walking
the table:

| During the walk | JavaScript | Here |
| --- | --- | --- |
| `set` of a new key | visited later | appended past the cursor, so it is visited |
| `set` of an existing key | the new value is seen if not yet visited | the value is written in place |
| `delete` of a key not yet visited | skipped | its entry is dead, so it is skipped |
| `delete`, then `set` of the same key | visited again, at the end | a new entry is appended |
| `clear` | nothing more, then anything added after | every entry is dead and the count is kept (§6.1) |
| growth | invisible | the buckets move and the entries do not |

**Compaction is the one operation that moves entries**, so the table counts its
live walks: incremented where a loop is entered, decremented on the
fall-through, `break` and every `return` out of an enclosing walk (`panic` and
`process.exit` need nothing). A rebuild with walks live doubles instead, and the
next one compacts. Iterators are not values, so every walk is a lexical loop and
the count is exact, nested walks and walks in a callee included, at two stores
a loop. `keys()` and `values()` are allowed only as a `for...of` iterable; there
is no `entries()` (no destructuring) and no `forEach` (a method cannot take a
function parameter, NL2338).

### 6.3 `Set`

`Set<T>` is the same table without values, sharing the probe. `add` returns
`this`; `for (const x of s)`, `s.keys()` and `s.values()` are one insertion-order
walk, as in JavaScript. §5's key rules apply to `T`.

## 7. The small choices

- **`size`** is a read-only `number` property (`m.size = 3` is TS2540).
- **`set` and `add` return `this`**, so calls chain as under `tsc`.
- **`new Map(entries)` and `new Set(array)` are refused**, naming the loop
  that replaces them: a Nish class has one constructor and no optional
  parameter, so `std/` cannot declare them.
- **Type arguments are required on `new`**, except from an annotated
  declaration (`const m: Map<string, i32> = new Map()`); unannotated, `tsc`
  makes `Map<any, any>` with no error, and Nish asks for them.
- **Visible members** are the ES2022 declarations less `entries`, `forEach` and
  `[Symbol.iterator]`.

## 8. Interop

`--emit-header` declares an instance as an opaque struct
(`typedef struct nish_gen_Map_str_i32 nish_gen_Map_str_i32;`), so a C host can
hold a map and hand it back; laying it out would make `std/collections.ts`'s
private fields an ABI. `--emit-dts` and `--emit-napi` leave the function
unbridged with the existing reason comment, the rule a class parameter already
gets. None refuses the compile.

## 9. Fusion, `nish/map`, and threads

### 9.1 The fusion patterns

`src/fusion.ts` turns three patterns into one `probe` and a write through its
packed answer — `setValueAt` where the key was found, `insertAt` with the
probe's hash where it was not:

1. **Update**: `m.set(k, E)` where `E` holds exactly one `m.get(k)` or
   `m.has(k)` — word count's `counts.set(w, (counts.get(w) ?? 0) + 1)`.
2. **Guarded write**: `if (m.has(k)) { m.set(k, E); … }`, or with `!`, the
   `set` first in the branch.
3. **Set insert-if-absent**: `if (!s.has(x)) { s.add(x); … }`.

Receiver and key must be spelled the same and be identifiers or `this.<field>`
paths (the key may be a literal). Between probe and write there may be **no
call, no allocation and no assignment** of any kind, because a call could grow,
delete from or clear `m` and make the probe's bucket wrong, and the facts do
not yet say "does not touch this map". Anything outside the patterns is not an
error; it compiles as separate calls.

### 9.2 `nish/map`

`std/map.ts` exports `reserve(m, n)` and `getOrInsert(m, k, v)`, whose bodies
are the Node meaning (`reserve` does nothing; `getOrInsert` is
`get`/`set`). Natively the compiler lowers `reserve` to the table's
`reserveSlots` and `getOrInsert` to one probe and a write through its answer.

### 9.3 A `Map` read inside a parallel body

**Planned, not built.** A `nish/threads` body may write nothing its caller can
see, and could reach a map only through its element. For `get`, `has` and
`size` to be legal there, `probe` must write nothing (it does not), the `dst`
reachability rule must see through the table's private arrays to `K` and `V`
only, and iterating stays refused (the walk counter is a store). Today a body
that reads `x.index.get("a")` is refused on both counts: it "can reach a `i32[]`
through `x.index.entryValues`", and it "writes memory its caller can see
through `Map<string, i32>.probe`" (checked with 0.15.0). `probe` writes no
memory, as `std/collections.ts` states, so the second refusal is the effect
analysis not yet crediting it, and the first is the reachability rule not yet
skipping the table's own arrays. The work is those two rules, one positive
case and a `reject_*` for a `set` in a body.

## 10. Is an unordered map ever needed? (S7)

**No, not for v1.** Measured by `bench/map-wordcount.ts` (b),
`bench/map-presize.ts` (c) and `bench/map-vs-stringmap.ts` (d), each with a
Node twin; see [bench/README.md](../bench/README.md#the-global-map-measured)
and [BENCHMARKS.md](BENCHMARKS.md#map-and-set-wp32). Wall time on the shared
VM is noisy — a cell is worth about ±25%, and an independent pass disagreed on
two cells by more than that — so claims rest on instruction counts where they
can.

- **Against Node**, the ordered `Map` is 1.47x to 4.5x ahead on all ten
  workloads at both sizes.
- **Against `StringMap`** it is level (0.91x to 1.28x) on the string workloads:
  same layout, and genericity costs nothing above the noise.
- **Against the unordered layout**, it trails only on integer lookups, 1.13x to
  1.14x on hit and 1.25x to 1.35x on count, the second dependent load (bucket,
  then entry) the layout predicted; insert, churn and integer miss are level or
  ahead. In instructions over all ten workloads it runs 1.22x the unordered
  prototype's, about a third of which is generic code over the hand-written
  twin (1.06x).
- **Fusion** runs word count in 1.82x fewer instructions than the double lookup
  (about 1.2x to 1.7x in wall time).
- **`reserve`** runs insert in 1.41x fewer instructions and 13% less peak
  memory, since a presized table abandons no bucket arrays; its wall-time gain
  is reliable in cache and inside the noise at 2^20.

JavaScript fixes iteration order, so an unordered table could never be the
global `Map`, only a second type a program chooses by hand, and fusion and
`reserve` are each worth more than its lead.

**What would reopen it**: a program whose time goes to lookups of integer keys
in a table larger than the cache — more than about 2^20 keys, read far more than
written, never iterated — where neither fusion nor `reserve` applies. Repeat
(d)'s `hit int` and `count int` rows at 2^20 (and 2^22) on a quiet machine; the
trigger is a gap above 1.3x that holds across passes, and the cheaper thing to
try first is the 1.06x of generic code. It would be an opt-in `nish/` type
beside `Map`, never a replacement.
