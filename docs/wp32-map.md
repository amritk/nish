# WP32: the global `Map` and `Set`

**Design note (S1 of seven; decided, nothing built).** This decides every
question the global `Map<K, V>` and `Set<T>` raise, so that stages S2 to S7
build rather than decide. [LANGUAGE.md](LANGUAGE.md) stays normative, and this
note adds no rule to it; where they disagree, LANGUAGE.md wins. §10 is S7's,
and is left as a stub that says what S7 measures.

The evidence is of three kinds, and every decision below names its own:

- **measurements** of four hand-written layout prototypes against Node's `Map`
  (`bench/map_proto_*.ts`, `bench/map_node.mjs`; §2);
- **`tsc --strict` experiments**, with TypeScript 5.9.3 and `"lib": ["ES2022"]`,
  the repository's settings (§3, §7);
- **pointers into the compiler** at `main` `468f09a`, where the
  answer is already fixed by something the compiler does.

`Map` and `Set` do not exist today: `new Map<string, i32>()` is
`` Unknown class `Map` `` ([AI.md](AI.md) lists them under "none of these
exist"). `self/map.ts`'s `StringMap` is the in-house precedent. It keeps its
entries in insertion order behind a bucket table of entry indices, compares the
full key at every occupied bucket, and hashes every key again when it grows.
[wp28-compatibility-mode.md](wp28-compatibility-mode.md) names `Map` the
library tier's first need, and [wp18-generics.md](wp18-generics.md) §16 said
it waits on generic classes. Those have landed.

---

## 1. The decisions

| # | Question | Decision | § | Rejected |
| --- | --- | --- | --- | --- |
| 1 | Layout | Insertion-ordered. A `u32[]` bucket table holds eight fingerprint bits above a 24-bit entry index plus one. The entries sit in parallel arrays (`keys`, `values`, `hashes`), and the full 32-bit hash of each is stored in `hashes`. The cap is 2^24 − 1 entries, one fewer than Node's 2^24. | 2 | an `i64` slot holding the whole hash; the StringMap shape; an unordered table |
| 2 | Load factor | At most 3/4 of the buckets taken, counting deleted entries until a rebuild. | 2.4 | 7/8 |
| 3 | `get`'s type | `V \| undefined`. It is narrowed by `!== undefined` / `=== undefined`, or collapsed by `??`. A maybe value may be bound to a `const`, annotated or not. It may not cross a call, and it is never in memory: S3 lowers it to two SSA values, a found bit and the value. That is a new lowering, analogous to WP17's in-module register shape. | 3 | `has` + `get(k)!`; `get(k, default)`; a maybe value as a parameter or return type |
| 4 | Output | The implicitly loaded `std/collections.ts` writes no `.ll` of its own. Every instance, and every helper it reaches, is emitted into each module that uses it with `internal` linkage, so `-o x.ll` keeps working for a one-file program. | 4.1 | a separate module, with its tests in `tests/link/` |
| 5 | Names, and a user's `Map` | The std templates are `class Map<K, V>` and `class Set<T>`, mangled like any template (`%struct.Map$str$i32`). A module that declares or imports its own `Map` or `Set` gets no implicit import. A program where one module does that and another names the global is refused, naming both. | 4.2 | a reserved IR prefix for the std classes |
| 6 | Keys | Strings, every integer width, `number` in either mode, `f64`, `f32`, `boolean`, enums and class instances by identity. Refused in v1: interfaces, arrays, `T \| null` and `Result`. | 5 | records by value; nullable keys in v1 |
| 7 | Values | Anything except an `interface`, which is stored inline and would be copied, and `void`. | 5.1 | copying records in |
| 8 | Hashing | FNV-1a for strings and murmur3's `fmix32` for 32-bit and narrower integers. 64-bit integers, pointers and floats use `fmix64` folded to 32 bits. A float is normalised first (−0 → +0, every NaN → one canonical NaN), and equality is SameValueZero. A hash of 0 is moved to 1. Hash flooding is out of scope. | 5.2 | a seeded hash; hashing the float's raw bits |
| 9 | `delete` | A tombstone in the bucket, and a stored hash of 0 on the entry. At the load bound a rebuild compacts in place, at the same size, when more than half of the entries are dead, and doubles otherwise. The table never shrinks. | 6.1 | backward-shift deletion (it needs the unordered layout); a fresh table per compaction |
| 10 | Mutation during iteration | Exact JavaScript semantics. The walk re-reads the entry count each pass, and a live-iteration counter on the table defers compaction until no loop is walking it. `clear` during a walk marks every entry dead instead of truncating. | 6.2 | weaker semantics, or a refusal |
| 11 | `Set` | The same table with no values. `for (const x of s)`, `s.keys()` and `s.values()` are the same walk. | 6.3 | — |
| 12 | Small choices | `size` is a read-only `number`, and `set`/`add` return `this`. `new Map(...)` / `new Set(...)` with arguments are refused in v1. Type arguments may be left off `new` only where an annotated declaration initialises from it. | 7 | `size()` as a method; a `void` `set` |
| 13 | Interop | `--emit-header` declares an instance as an opaque struct. `--emit-dts` and `--emit-napi` leave the function unbridged, naming the type, as they already do for a class. | 8 | exposing the layout; refusing the compile |
| 14 | Fusion | Three patterns, each one probe (§9.1). Nothing between the probe and the write may call, assign or allocate. | 9.1 | fusion through a call proven pure |
| 15 | Threads | `get`, `has` and `size` may appear in a wp29 parallel body. Three things are needed for that: `probe` writes nothing, the `dst` reachability rule sees through the table's private arrays, and iterating a map in a body remains a shared write. | 9.3 | — |

**The hard requirement is the layout, not a measurement outcome.** Each bucket
slot carries a fingerprint beside the entry index, and each entry stores its
full hash. So a probe reads the entry list only on a fingerprint match. Growth
and compaction re-file buckets from the stored hashes and never hash a key
again. `probe` answers either the entry it found or the empty bucket it
stopped at, so fusion and `getOrInsert` write through that one probe. §2.3
measures the first property directly.

**What each stage takes from this note:**

| Stage | Builds | From |
| --- | --- | --- |
| S2 map-core | `std/collections.ts` with the §2 layout; the implicit load and the §4 output shape; `hashKey`/`sameKey` per §5.2; the §5 key and value refusals; §7's surface; §8's sidecars | §2, §4, §5, §6.1, §7, §8 |
| S3 map-get | `V \| undefined`, the maybe `const`, `??`, narrowing, each as §3 specifies, and the new two-value lowering of a maybe (§3.2) | §3 |
| S4 map-iteration | `for...of` over `keys()`, `values()` and a `Set`, with §6.2's counter | §6 |
| S5 map-fusion-extras | §9.1's three patterns and `nish/map`'s `reserve` and `getOrInsert` | §9 |
| S6 stringmap-fingerprints | `StringMap` on the §2 slot and stored hashes, in Nish-0 | §2, §6.1 |
| S7 map-measure | comparisons (b) to (d), and §10 | §2.5, §10 |

---

## 2. The layout

### 2.1 The four prototypes

Four monomorphic programs implement a `string → i32` and an `i32 → i32` table
in each candidate layout, with no compiler change. Each is an ordinary Nish
program that compiles today with no warning:

| Program | Layout | Bucket | Probe reads the entries | Growth |
| --- | --- | --- | --- | --- |
| [`map_proto_ordered.ts`](../bench/map_proto_ordered.ts) | StringMap's: ordered, bucket = index + 1 | `i32` | at every occupied bucket, for a full key compare | hashes every key again |
| [`map_proto_ordered_fp.ts`](../bench/map_proto_ordered_fp.ts) | ordered, `hash32 << 32 \| index + 1` | `i64` | only when the bucket's hash equals the key's | re-files from `hashes` |
| [`map_proto_ordered_fp32.ts`](../bench/map_proto_ordered_fp32.ts) | ordered, `hash >>> 24 << 24 \| index + 1` | `u32` | only on a fingerprint match. The stored hash is compared before the key | re-files from `hashes` |
| [`map_proto_unordered.ts`](../bench/map_proto_unordered.ts) | unordered: hash, key and value in the bucket | three parallel bucket arrays | never: the key is in the bucket | re-files from the bucket hashes |

All four run five workloads over the same `2n` distinct keys. The keys are
`i * 2654435761` as an `i32`, and `` `k${key}` `` for the string map. A 32-bit
LCG drives the workloads, in the program, with no I/O:

| Workload | What it does | Checksum |
| --- | --- | --- |
| insert | four fresh tables of the first `n` keys, each mapped to its index | the sizes, and the last table's sum over an insertion-order walk |
| hit | `8n` lookups of random present keys | the sum of the values found |
| miss | `8n` lookups of random absent keys, answering `j & 7` | the sum of the defaults |
| count | word count: `8n` words drawn from `n / 4`, skewed towards low indices by `r1 & r2`, each counted with one probe | distinct words, and `Σ count × index` |
| churn | `8n` inserts into a sliding window of `n / 2` live keys, each paired with the delete of the key that leaves it | the live count, and the sum over a walk |

[`bench/map_node.mjs`](../bench/map_node.mjs) runs the same workloads on Node's
global `Map`, spelling every 32-bit step as the prototypes compute it
(`Math.imul`, `>>> 0`). `node bench/run.mjs --only maps --validate` requires
all five programs to print the same ten lines. `npm test` runs that at
`n = 1024` in its `bench` check. Each checksum is order-independent, so the
unordered layout can agree too. The ordered layouts' walks are in insertion
order, and that is what S4 pins against Node.

Two findings about the language came out of writing them. Both are recorded
because S2 is written in the same language:

- **An array of strings cannot be allocated at a length.** `new Array<string>(n)`
  is refused (`reject_arr_new_string`). So the unordered layout's string buckets
  are `(string | null)[]`, and its integer buckets are `i32[]`. A generic
  `Map<K, V>` with keys in its buckets would need a different storage type for
  each kind of `K`. The ordered layouts only ever `push` a key, so one generic
  class body serves every `K`.
- **A module constant cannot be a `u32` or an `i64[]`**, and a field initialiser
  must be a literal. So the packed slot's sentinels are literals at their use,
  and the tables are allocated in the constructor.

### 2.2 The measurement: comparison (a)

`node bench/run.mjs --only maps --n maps=<n> --runs <r>` runs these tables. Each
cell is a workload's minimum in ms over the timed runs, as the program measures
it with `monotonicNanos` around the workload alone. They were taken on an x86-64
Xeon at 2.10 GHz, a four-core virtual machine, with clang 18 and Node 22.22.2,
`--profile speed`, bounds checks on. The runs were 9 at the two smaller sizes
and 5 at 2^20.

**`n` = 2^20: the tables are larger than the cache.**

| workload | ordered | ordered + `i64` fp | **ordered + `u32` fp** | unordered | Node `Map` | `u32` fp / unordered | `u32` fp / Node |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| insert str | 822.9 | 446.1 | **383.8** | 447.8 | 1222.7 | 0.86 | 0.31 |
| hit str | 1496.1 | 1416.4 | **1294.2** | 1251.1 | 2726.5 | 1.03 | 0.47 |
| miss str | 2346.5 | 1395.0 | **1330.0** | 1243.8 | 4418.7 | 1.07 | 0.30 |
| count str | 605.2 | 546.5 | **535.2** | 490.4 | 1505.7 | 1.09 | 0.36 |
| churn str | 1797.6 | 1081.3 | **958.4** | 1165.7 | 2950.1 | 0.82 | 0.32 |
| insert int | 347.6 | 580.3 | **294.2** | 297.9 | 506.8 | 0.99 | 0.58 |
| hit int | 431.3 | 337.2 | **382.1** | 270.3 | 1637.8 | 1.41 | 0.23 |
| miss int | 516.4 | 409.3 | **356.0** | 358.8 | 1718.2 | 0.99 | 0.21 |
| count int | 186.0 | 196.4 | **173.2** | 133.3 | 843.8 | 1.30 | 0.21 |
| churn int | 826.6 | 984.9 | **593.5** | 850.2 | 1962.6 | 0.70 | 0.30 |

**`n` = 65536: the tables fit in the last-level cache.**

| workload | ordered | ordered + `i64` fp | **ordered + `u32` fp** | unordered | Node `Map` | `u32` fp / unordered | `u32` fp / Node |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| insert str | 24.4 | 18.5 | **15.6** | 19.7 | 30.3 | 0.79 | 0.51 |
| hit str | 33.6 | 31.0 | **29.7** | 28.4 | 68.1 | 1.05 | 0.44 |
| miss str | 46.8 | 32.5 | **30.1** | 30.1 | 80.6 | 1.00 | 0.37 |
| count str | 11.1 | 10.4 | **10.7** | 11.4 | 31.0 | 0.94 | 0.35 |
| churn str | 41.4 | 33.5 | **27.4** | 40.6 | 74.3 | 0.67 | 0.37 |
| insert int | 11.8 | 14.5 | **12.1** | 15.1 | 21.3 | 0.80 | 0.57 |
| hit int | 6.6 | 6.6 | **7.1** | 8.3 | 36.9 | 0.86 | 0.19 |
| miss int | 9.6 | 9.1 | **9.0** | 10.8 | 40.0 | 0.83 | 0.23 |
| count int | 4.0 | 4.1 | **4.3** | 4.7 | 26.5 | 0.91 | 0.16 |
| churn int | 20.6 | 19.8 | **19.0** | 26.8 | 51.8 | 0.71 | 0.37 |

At `n` = 4096 every Nish layout runs every workload in 0.2 to 2.0 ms, and no
layout is ahead by more than the resolution. Node's column there is JIT
warm-up, 1.2 to 3.5 ms, and says nothing about its table.

**How far to trust a cell.** This machine is a shared VM. The same cell moved by
up to a quarter between sessions. The `i64` layout's insert int at 2^20 read 347,
393 and 580 ms in three sessions. So the decisions below rest only on
differences that held in every session, and on two measures that do not
move at all:

- **Instructions**, counted by cachegrind at `n` = 16384. The prototypes are in
  the instruction gate (§2.6): ordered 251,794,504; `i64` fp 236,784,417;
  `u32` fp 254,837,532; unordered 219,736,662. They were counted at `6451cf2`,
  with #220's array-header TBAA, which moved them by −0.37% to +0.02%.
- **Peak RSS at 2^20**, in KB, whole process, keys included: ordered 586,936;
  `i64` fp 828,212; `u32` fp 660,280; unordered 681,400; Node 744,072.

### 2.3 What the fingerprint buys, counted

The requirement says the entry list is read only on a fingerprint match. It was
checked directly with a copy of each prototype that counts the probe's reads
outside the bucket array. The count is at `n` = 65536, over the 524,288 hits
and 524,288 misses of the string workloads:

| Layout | entry-list reads per hit | per miss |
| --- | ---: | ---: |
| ordered (StringMap) | 1.49 | 1.47 |
| ordered + `i64` fp | 1.00001 | 0 |
| ordered + `u32` fp | 1.0017 | 0.0059 |
| unordered | 1.00001 (its key is in the bucket) | 0 |

The `u32` slot's false-match rate is the 1-in-256 its eight bits predict, over
about 1.5 foreign buckets per probe. Every false match is then turned away by
the stored full hash, which sits beside the key and is compared before it, so
the key compare stays at one per hit. That is also why "string miss" and
"string insert" are where the fingerprints pay: 1.7x and 2.1x over the
StringMap shape at 2^20. On an integer key a full key compare costs what the
fingerprint compare costs, so the StringMap shape holds its own on the integer
rows and the fingerprints buy growth without rehashing. That is visible only
on insert.

### 2.4 The decisions

**The slot is a packed `u32`: 8 fingerprint bits, 24 bits of entry index plus one.**

- It is never slower than the `i64` slot by more than the noise, and it was
  faster on string insert and integer churn at 2^20 in every session. It is
  half the bucket memory: 4 bytes a bucket against 8, which is 168 MB of peak
  RSS at 2^20. It retires 18.1 million more instructions than the `i64` slot
  at `n` = 16384, 7.6%, for the stored-hash compare and the index mask. It buys
  that back in cache lines once the table leaves the cache.
- **The index cap is one entry short of Node's, deliberately.** Node's `Map`
  and `Set` hold 2^24 (16,777,216) entries and throw `RangeError: Map maximum
  size exceeded` on the 16,777,217th insert, measured on Node 22.22.2. A 24-bit
  field that holds the index plus one holds 2^24 − 1 entries, one fewer. An
  empty bucket is 0. A deleted entry's bucket is `0x01000000`, fingerprint 1
  and index field 0, which no live entry has, so the field needs no reserved
  all-ones value. Holding the 2^24-th entry would take an `i64` slot or a
  reserved encoding, and keeping the `u32` slot is the trade: half the bucket
  memory, for that one entry. S2 panics with Node's wording, `Map maximum size
  exceeded` (or `Set …`), when an insert would pass the cap after compaction.
  While a loop walks the table there is no compaction (§6.2), so an insert at
  the cap then panics at once, however few entries are live: a walk whose
  body churns about 16.7 million times panics where Node's would not. S4
  records it in [LANGUAGE.md → `Map` and `Set`](LANGUAGE.md#map-and-set).
- **The fingerprint is the hash's top eight bits, and the bucket its low bits
  folded with the high half:** `home = (h ^ (h >>> 16)) & mask`, as `StringMap`
  does. The fold brings the top bits into the bucket index only XORed with
  bits 8 to 15, so two keys in neighbouring buckets still have independent
  fingerprints. Only a table of 2^25 buckets, reachable just at the entry cap,
  uses hash bit 24 directly in its index. There the fingerprint shares that
  bit, which is why it is "7–8 bits", as the plan says.
- **The full hash lives in the entry**, in `hashes: u32[]`, parallel to `keys`
  and `values`. A stored hash of 0 marks a deleted entry, so a computed hash of
  0 is moved to 1. The `i64` slot kept the hash in the bucket as well, and the
  entry copy was then used only by compaction. The `u32` slot needs it at every
  fingerprint match, so the one copy does both jobs.

**The load factor is 3/4**, counting dead entries until a rebuild, as
`StringMap` does. A 7/8 bound was built into both fingerprinted layouts and run
at 2^20. There the two bounds end at the same table size, so the hit and miss
rows ran on identical tables. They still moved by up to 19% between the two
builds, which is this machine's noise. The churn rows are the ones where the
bound changes the work, because it decides how often a rebuild comes. At 7/8
they were slower in both layouts: +13% (string) and +20% (integer) on the
`u32` slot, and +20% and +10% on the `i64` slot. Linear probing's
expected unsuccessful probe length is ½(1 + 1/(1 − α)²). That is 8.5 buckets at
α = 3/4 against 32.5 at 7/8. With a four-byte fingerprint slot a miss at 3/4
still reads one or two cache lines, and at 7/8 it reads several. The memory 7/8
would save is only in the bucket array, 0.8 to 1.5 bytes an entry. The
entries are dense either way, and they spend at least 12 bytes each in `keys`,
`values` and `hashes`.

### 2.5 What (a) says about the unordered layout

The ordered, fingerprinted table is **within 10% of the unordered one on every
workload at 65536 and on eight of the ten at 2^20, and ahead of it on insert
and churn at both**. The
unordered layout has no entry list to append to, but it pays in its growth and
its backward-shift delete. The two exceptions are integer hit and integer
count at 2^20, 1.41x and 1.30x behind. There the table is out of cache, and the
ordered layout's second dependent load, bucket then entry, is a second miss
the unordered layout does not take. The chosen layout is ahead of Node's
`Map` on every workload at both sizes: 1.7x (integer insert) to 4.9x (integer
count) at 2^20, and 1.8x to 6.2x at 65536.

That is the whole of comparison (a). Whether the integer exception is worth an
unordered `Map` is §10's question, and S7 answers it with (b) to (d).

### 2.6 The prototypes in the instruction gate

The four prototypes are in `bench/instructions.json` (#218's gate), at `n` =
16384, where they run 219.7 to 254.8 million instructions each. They are single-threaded.
They read the clock only when timing, so an untimed run's count does not depend
on the vDSO. `--instructions --runs 3` gave a spread of 0 on all four. They are
the only hash-table code in the gate: a bounds-proof, loop or call-lowering
regression in a probe loop moves their counts and nothing else's. They do not
use `Map`, so S2 to S7 do not move them. A stage that does is a codegen change,
and the gate asks it to say so.

---

## 3. `get`'s type

### 3.1 What `tsc` accepts

`tsc --strict` 5.9.3 over one file declaring `const m = new Map<string, number>()`:

| # | Spelling | `tsc --strict` |
| --- | --- | --- |
| A | `const a = m.get(k); if (a !== undefined) { use(a); }` | accepted |
| B | `const b: number = m.get(k) ?? 0;` | accepted |
| C | `if (m.has(k)) { use(m.get(k)); }` | **TS2345**: `number \| undefined` is not assignable to `number` — `has` does not narrow `get` |
| D | `if (m.has(k)) { use(m.get(k)!); }` | accepted |
| E | `m.set(k, m.get(k) + 1);` | **TS2532**: Object is possibly `undefined` |
| F | `m.set(k, (m.get(k) ?? 0) + 1);` | accepted |
| G | `const g: number \| undefined = m.get(k);` | accepted |
| H | `maybe(m.get(k))` into `(x: number \| undefined)` | accepted |
| I | `let i = m.get(k); if (i !== undefined) { i = i + 1; }` | accepted |
| J | `const j: number = m.get(k);` | **TS2322** |

So a program that type-checks under `tsc` reads a map in one of three ways:
narrow a binding (A), default it (B, F), or assert after `has` (D). No fourth
way exists, because `get`'s declared result is `V | undefined` and `has` does
not narrow it.

### 3.2 The decision: `V | undefined`, admitted narrowly

- **`m.get(k)` has type `V | undefined`**, a *maybe* type. It may appear in
  exactly these places:
  - as the initialiser of a `const`, which is unannotated or annotated
    `V | undefined` (A, G);
  - as the left operand of `??` (B, F);
  - as an operand of `=== undefined` / `!== undefined`.

  Anywhere else it is refused with a named diagnostic that suggests `??` or a
  `const` and a test. Those places are a `let` (I), an argument (H), a return,
  a store, a template hole and an arithmetic operand (E). Every refused
  spelling either fails under `tsc` too (E, J) or is one v1 chooses not to
  need (H, I).
- **Narrowing reuses the nullable *rules*, not the nullable representation.**
  - **Reused:** the checker's type-level narrowing
    ([LANGUAGE.md → Nullable types](LANGUAGE.md#nullable-types)). The table of
    forms there applies with `undefined` in place of `null`, and so do the
    region rules. The scope narrowing and stripping in `self/expressions.ts`
    are generalised from `null` to `undefined`. A maybe `const` reads as `V`
    where a test proves it present.
  - **New:** what is narrowed. `T | null` exists only for a class, interface,
    array or string, because `null` is a spare pointer value
    ([same section](LANGUAGE.md#nullable-types)). A maybe covers every `V`,
    scalars included (every §3.1 example is `Map<string, i32>`). So it is a
    payload with a separate found bit, and the code that tests it and reads it
    is S3's to write. It is not a pointer compared with `null`.
  - A `const` cannot be reassigned, so the "narrowing ends at an assignment"
    rule never fires. That is why `let` is refused: it is the case that needs
    that rule.
- **`??` parses with TypeScript's precedence.** It is at the level of `||`,
  its operands bind as tightly as `|` does, and it does not mix with `||` or
  `&&` without parentheses. `m.get(k) ?? 1 || 2` is TS5076 under `tsc`, and it
  is a syntax error in Nish too. Its right operand has type `V`, and so does the
  whole expression. Any `??` whose left operand is not a maybe keeps NL1048,
  unchanged. When `V` is itself nullable (`Map<string, Node | null>`), `??`
  also replaces `null`, as JavaScript's does, and `!== undefined` narrows to
  `V`, keeping the `null`.
- **`undefined` stays refused everywhere else**, as a value
  (`reject_undefined_value`) and as a type (`reject_union_undefined`). The
  maybe type is spelled only as the annotation of a `const` initialised
  directly from `get`.
- **It lowers to two SSA values: the probe's found bit, and the value, loaded
  only when found.** This is a new lowering, and building it is S3's work.
  - It is *analogous to* WP17's in-module register shape
    ([LANGUAGE.md → Result and error handling](LANGUAGE.md#result-and-error-handling)),
    but it is not that shape. A `Result` between two functions of one module is
    `{ i1, i32, i32 }`: the discriminant and one slot per arm. A maybe has no
    error arm.
  - The pair never crosses a call and never reaches memory, so it needs no
    struct type at all. There is nothing in WP17 for S3 to reuse beyond the
    idea.
  - `get` is one probe, and `m.get(k) ?? d` is that probe and a `select`.

**Why not `has` + `get(k)!`.** `tsc` needs the `!` (C against D). Nish's parser
does not accept a postfix `!` at all today: `p!` is `` syntax error: expected
`;`, found `!` ``. Under Node the assertion is erased, so `get(k)!` on an absent
key is `undefined`, which flows on. Natively it would have to panic. The two
runtimes would then disagree on exactly the programs that are wrong. It is also
two probes unless fusion recognises it. `V | undefined` with `??` means the same
thing on both runtimes, and it is one probe as written.

**Why not `get(k, missing)`,** `StringMap`'s spelling. It is TS2554 under
`tsc`. A Nish program is a TypeScript program, so it would not type-check.

**Why a maybe value does not cross a call in v1.** H is legal TypeScript, but
it needs `V | undefined` as a parameter type. That opens `undefined` in type
positions generally, and the maybe then has to be laid out in memory: in a
field, in an argument slot of an exported function, in the C header. A later
stage would carry it the way WP17 carries a `Result`: a register pair for an
internal callee, and a packed word for an exported one when `V` fits in four
bytes. That would be a new ABI shape, not WP17's. Nothing in v1 needs it.
The refusal names the rewrite (`?? d`, or narrow first). Relaxing it later is a
minor, because it turns a refusal into an acceptance.

---

## 4. Where the code lives

### 4.1 Output: instances go into the module that uses them

Today a program that imports anything from `nish/` is two modules. A one-file
program importing `nish/testing` gets this from `nish t.ts -o t.ll`:

```
compile: 2 modules would be written (t.ts, std/testing.ts); pass `-o <dir>/` to write one .ll per module
```

(`planOutputs`, [`self/compile.ts`](../self/compile.ts) line 127.) An imported
generic's instances are defined by the module that declares the template and
`declare`d by every other ([LANGUAGE.md → Generic classes and interfaces](LANGUAGE.md#generic-classes-and-interfaces),
`tests/link/generic_import`). If `Map` went through that path, a program that
names `Map` would become two modules without importing anything. Its
`-o x.ll`, and every `tests/cases/` golden written that way, would stop
working.

**So the implicit collections module writes no output of its own.** S2
compiles it like any module, typed and checked once. Its instances are emitted
into each module that uses them, and so are the non-generic helpers they reach.
All of them get `internal` linkage, which is a private copy per module:

- `-o x.ll` keeps working, and S2's goldens live in `tests/cases/` as one-file
  programs. Cross-module programs go to `tests/link/map_*`.
- `internal` is what gives a function this compiler's private calling
  convention (the condition `--strict-exports` uses for WP17's by-value pair).
  `linkonce_odr` would keep one copy per program at link time and lose that
  convention, so it is the wrong trade for code on the hot path.
- Two modules that pass one `Map<string, i32>` between them each call their own
  copy of `get` on it. The struct is laid out by name, program-wide
  (`%struct.Map$str$i32`), so the copies agree on it. The duplication costs
  code size in a multi-module binary. It is one probe loop per instance and
  method used, and LLVM deletes an `internal` function that nothing calls.
- Under `-g`, S2 gives each copy a `DIFile` for `std/collections.ts`, the file
  its source is in.

The load is conditional. A module that never names `Map` or `Set` loads
nothing, so every program that compiles today compiles to byte-identical IR.
S2's `tests/nish-cmp.js` run must show no moved program.

### 4.2 The names, and a user's own `Map`

- **`std/collections.ts` declares `class Map<K, V>` and `class Set<T>`**,
  mangled as every template is: `%struct.Map$str$i32`, `@Map$str$i32.get`. A
  diagnostic names them as written (`` `Map<string, i32>` ``). No reserved
  prefix is needed, because of the next rule.
- **A user's own `Map` wins in its own module.** A class named `Map` compiles
  today (`class Map { size: i32 = 0 }`, checked at `468f09a`). In a module
  file it also shadows the lib declaration under `tsc`. So a module that
  declares a class, interface, enum or alias named `Map` or `Set`, or imports
  one, gets no implicit import, and its `Map` is its own.
- **One name, two classes, one program: refused.** Class names are
  program-wide ([LANGUAGE.md → Generic classes and interfaces](LANGUAGE.md#generic-classes-and-interfaces), NL3028).
  So if one module declares `Map` and another names the global, the program is
  refused with S2's clashing-`Map` code. The message names the declaring
  module and says the global is the standard one. That is a deviation from
  TypeScript, where each module's `Map` is its own. It is the deviation every
  class name already has.
- **Internal members are not visible.** Only the JavaScript members of §7
  resolve. `m.slots`, `m.probe(...)` and the rest are refused with S2's
  internal-member code, as if they did not exist, which under `tsc` they do not.

---

## 5. Keys, values and hashing

### 5.1 What may be a key, and what may be a value

| Kind | Key in v1 | Value | Why |
| --- | --- | --- | --- |
| `string` | yes | yes | compared by content (`nish_str_eq`); keys are immutable, so the table stores the pointer |
| `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `number` (either mode) | yes | yes | by value |
| `f64`, `f32` | yes, SameValueZero | yes | JavaScript's key equality: −0 is +0 and NaN is NaN |
| `boolean`, enums | yes | yes | by value, at the enum's width |
| a class | yes, by identity | yes | a class value is a pointer and has identity ([LANGUAGE.md → Arrays of records are contiguous](LANGUAGE.md#arrays-of-records-are-contiguous)) |
| an `interface` | **no** | **no** | stored inline: `values.push(p)` copies the record ([same section](LANGUAGE.md#arrays-of-records-are-contiguous)), so `m.set(k, p); p.x = 1` would not change what `m.get(k)` reads, which JavaScript's `Map` would. As a key it would have no identity at all |
| `T[]` | **no** | yes | an array as a key has identity semantics in JavaScript, which surprises more often than it helps, and nothing in v1 needs it |
| `T \| null` | **no** | yes | a null key is legal JavaScript. It needs a null test in `hashKey` and `sameKey`, and it waits for a program that wants one |
| `Result<T, E>` | **no** | yes | no identity and no equality worth hashing |
| `void` | — | **no** | there is nothing to store |

Each refusal is one S2 code per position (key, value), naming the type and the
reason above.

### 5.2 Hash and equality per key type

`hashKey<K>` and `sameKey<K>` are intrinsics that S2 lowers per `K` in
`self/emit_map.ts`, as inline IR. They make no runtime call, because the
runtime's `.text` budget has no room:

| `K` | `hashKey` | `sameKey` |
| --- | --- | --- |
| `string` | FNV-1a, 32-bit, over the UTF-8 bytes, as `hashString` in `self/map.ts` | `nish_str_eq` |
| ≤ 32-bit integer, `boolean`, enum | `fmix32` (murmur3's finaliser) of the value, zero-extended | `icmp eq` |
| `i64`, `u64` | `fmix64`, then the two halves XORed | `icmp eq` |
| `f64` | normalise, then `f64ToBits`, then as `i64` | SameValueZero: `a == b` (`fcmp oeq`, so −0 equals +0), or both are NaN (`fcmp uno` on each) |
| `f32` | normalise, then `fpext` to `f64`, then as `f64` | as `f64` |
| a class | the pointer (`ptrtoint`) as `i64` | `icmp eq` on the pointers |

Normalising a float means −0 becomes +0 (`fadd x, 0.0` does it), and every NaN
becomes the one canonical `0x7FF8000000000000`. Keys that SameValueZero calls
equal then hash equal. A hash of 0 is moved to 1 (§2.4). `fmix64`'s constants
are above 2^53, which a Nish literal cannot spell. That is why this is IR the
compiler writes, and not Nish in `std/`.

**Hash flooding is out of scope for v1**, and the hash is unseeded. Insertion
order decides iteration order, so the hash never reaches a program's output.
Only its speed depends on it. A seeded hash can come later without changing
what any program prints.

---

## 6. Deletion, iteration and `Set`

### 6.1 `delete`, compaction and `clear`

- **`delete(k)` is one probe.** It writes the tombstone `0x01000000` into the
  bucket the probe found, sets the entry's stored hash to 0 and drops `size`.
  The key and value stay in the entry until a rebuild. A probe walks past a
  tombstone, and an insert does not reuse one. So the number of taken buckets
  is always the number of entries, live or dead, and the load bound can be one
  compare.
- **A rebuild happens at the load bound**, when entries (live + dead) pass 3/4 of
  the buckets. It **compacts at the same size** when more than half of the
  entries are dead, and **doubles** otherwise. Either way the live entries
  slide down in order, and the buckets are re-filed from `hashes`. No key is
  hashed again, and no key is compared.
- **Compaction reuses the bucket array.** There is no collector, so a new array
  leaves the old one in the arena until the enclosing scope ends. On the churn
  workload that is one abandoned table per compaction, with no bound. The first
  version of the prototypes allocated a new array for every rebuild. Clearing
  the array in place instead took the `i64` layout at 2^20 from 1,673 ms to
  917 ms on integer churn, and its peak RSS from 1,057,848 KB to 828,212 KB.
  Doubling still abandons the old array, but the abandoned sizes sum to less
  than the final one, so growth's garbage is bounded by the table's own size.
- **The table never shrinks.** V8's does, but a smaller table here is a new
  allocation with the old one abandoned. A map keeps the memory of its largest
  size, as an array keeps its capacity after `pop`.
- **`clear()`** sets `size` to 0 and marks the table empty in place. When no
  loop is walking it (§6.2), that means zeroing the buckets and truncating the
  entries. When one is, every entry is marked dead and the entry count is kept,
  so the walk sees what is inserted after the `clear`, as JavaScript's does.

### 6.2 Iteration, and mutation during it

`for (const k of m.keys())` and `for (const v of m.values())` walk the entries
in index order. They skip dead ones, and **re-read the entry count every pass**.
S4 lowers them in `emitForOf` ([`self/emit_arrays.ts`](../self/emit_arrays.ts)
line 1127). **The semantics are JavaScript's exactly**, because an entry never
moves while a loop is walking the table:

| During the walk | JavaScript | Here |
| --- | --- | --- |
| `set` of a new key | visited later | appended past the cursor, so it is visited |
| `set` of an existing key | the new value is seen if not yet visited | the value is written in place |
| `delete` of a key not yet visited | skipped | its entry is dead, so it is skipped |
| `delete`, then `set` of the same key | visited again, at the end | a new entry is appended |
| `clear` | nothing more, then anything added after | every entry is dead and the count is kept (§6.1) |
| growth | invisible | the buckets move and the entries do not |

**Compaction is the one operation that moves entries**, so it is deferred while
any loop is walking the table. The table carries a count of live walks. S4
increments it where the loop is entered and decrements it on every edge that
leaves: the fall-through, `break`, and each `return` out of an enclosing
walk. `panic` and `process.exit` end the process, so they need nothing. A
rebuild with the count above zero doubles instead of compacting, and the next
rebuild after the walk compacts. The one cost is the cap (§2.4): an insert
at 2^24 − 1 entries during a walk cannot compact dead entries away first, so
it panics. Iterators are not values ("iterators as
values" is out of the plan's scope), so every walk is a lexical loop and the
counter is exact, nested walks and a walk in a callee included. It costs two
stores a loop, not one per element.

`keys()` and `values()` are allowed only as a `for...of` iterable in v1. S4's
named refusal covers anything else. There is no `entries()` and no `forEach`:
there is no destructuring, and a method cannot take a function parameter
(NL2338).

### 6.3 `Set`

`Set<T>` is the same table without `values`, and the same class body shape, so
S2 writes one probe for both. `add` returns `this`. `has` and `delete` are
`Map`'s. `for (const x of s)`, `s.keys()` and `s.values()` are one walk in
insertion order. JavaScript's `Set.prototype.keys` *is* `values`, and
`for...of` over a `Set` is `values()`. The key rules of §5 apply to `T`.

---

## 7. The small choices

| Choice | Decision | Evidence |
| --- | --- | --- |
| `size` | a read-only property of type `number`: `i32` in `--number-mode i32`, the `i32` count converted in `f64` | `tsc`: `const n: number = m.size` is accepted, and `m.size = 3` is TS2540. Nish's `.length` is `number` the same way ([LANGUAGE.md → Member access](LANGUAGE.md#member-access)) |
| `set` / `add` result | the receiver, `this`, so `m.set(a, 1).set(b, 2)` chains | `tsc` accepts the chain. In statement position the result is dropped. S2 must check that a `const m = new Map…()` used only through `set` still gets the stack-or-arena decision it would get with a `void` result. If the facts cannot say "returns its receiver", that decision is an arena bump of the table header, which is recorded, not a refusal |
| `new Map(entries)`, `new Set(array)` | refused in v1, naming the loop that replaces them | `tsc` accepts both, but a Nish class has one constructor and no optional parameter, so `std/` cannot declare them. Accepting them needs compiler special-casing, and S2 keeps the surface to what the class can say |
| type arguments on `new` | required, except that `const m: Map<string, i32> = new Map()` (and a `let`) takes them from the annotation | `tsc` infers from the annotation, and `bad.set(1, 1)` on such a map is TS2345. Unannotated, `const loose = new Map()` is `Map<any, any>` under `tsc --strict` with no error at all. Nish refuses it and asks for the type arguments |
| `delete` as a name | allowed as a member name | `class Box { delete(): i32 … }` compiles today. The validator's `delete` refusal is the operator (`reject_delete`) |
| visible members | `size`, `get`, `set`, `has`, `delete`, `clear`, `keys`, `values` (Map); `size`, `add`, `has`, `delete`, `clear`, `keys`, `values` (Set) | the ES2022 declarations, less `entries`, `forEach` and `[Symbol.iterator]`, which §6.2 defers |

---

## 8. Interop

| Sidecar | A function whose signature has a `Map` or `Set` | Why |
| --- | --- | --- |
| `--emit-header` | declared, with the instance as an opaque struct: `typedef struct nish_gen_Map_str_i32 nish_gen_Map_str_i32;` and no body. A pointer to it crosses as a class pointer does | a C host can hold a map it was given and hand it back. Laying the struct out would make `std/collections.ts`'s private fields an ABI, which the §2 layout must stay free to change |
| `--emit-dts` | not exported to JS, with the existing reason comment naming the type | a wasm host cannot follow an arena pointer. This is the rule a class parameter already gets ([wp8-interop.md → `--emit-dts`](wp8-interop.md#--emit-dts-filedts-typings-and-a-loader-for-the-wasm-build)) |
| `--emit-napi` | not bridged, with the existing comment naming the position and the type | the same rule ([wp8-interop.md → Functions the shim cannot bridge say so](wp8-interop.md#functions-the-shim-cannot-bridge-say-so)). Converting to and from a JavaScript `Map` is a later item |

None of the three refuses the compile. A program that uses `Map` internally and
exports only scalars is unaffected.

---

## 9. Fusion, `nish/map`, and threads

### 9.1 The fusion patterns

S5 recognises three patterns in a new `self/fusion.ts`. Each becomes one
`probe` and a write through its packed result. That write is `setValueAt(i,
v)` when the key was found, and `insertAt(bucket, k, h, v)` when it was not,
reusing the probe's hash.

1. **Update:** `m.set(k, E)`, where `E` contains exactly one `m.get(k)` or
   `m.has(k)` on the same receiver and key. For example
   `counts.set(w, (counts.get(w) ?? 0) + 1)` is word count.
2. **Guarded write:** `if (m.has(k)) { m.set(k, E); … }` or
   `if (!m.has(k)) { m.set(k, E); … }`, where the `set` is the branch's first
   statement.
3. **Set insert-if-absent:** `if (!s.has(x)) { s.add(x); … }`, where the `add`
   is the branch's first statement. The rest of the branch runs only if the
   element was inserted, as it did before.

**The same receiver and key** means both are spelled the same way, and each is
a local or parameter identifier, or a `this.<field>` path; the key may also be a
literal. The receiver is not a call and not an element access.

**"Nothing in between"** means that between the probe and the write — within
`E`, and between the `has` and the branch's first statement — there is:

- no call of any kind (a user function, a method, a builtin, `console.log`);
- no `new`, array or object literal, template literal or string `+`, which
  are allocations;
- no assignment, `++`/`--` or compound assignment, to anything;
- no `?.`-style control flow, since there is none. `&&`, `||`, `??` and the
  ternary are allowed, because they only choose among values `E` already has.

A call could insert into `m` and grow it, delete, or `clear`. Any of those
makes the probe's bucket wrong, and the whole-program facts do not yet say
"does not touch this map". Relaxing the rule to a callee the facts prove pure
is a later minor. A pattern that falls outside these rules is not an error. It
compiles as the separate calls it is, with one probe each. S5's IR check pins
one `probe` call, and no second `hashKey`, per word-count iteration.

`const v = m.get(k); if (v !== undefined) { … }` needs no fusion. It is one
probe as written (§3).

### 9.2 `nish/map`

`std/map.ts` exports `reserve(m, n)` and `getOrInsert(m, k, v)`. Their bodies
are Node-faithful: `reserve` does nothing, and `getOrInsert` is
`has`/`get`/`set`. They run as written under Node. Natively the compiler routes
them to the table's `reserveSlots` and to one `probe` with a write through its
result.

### 9.3 A `Map` read inside a parallel body

A wp29 body may not write memory its caller can see, and may allocate only
temporaries it drops (`self/parallel.ts`'s header). A body can only reach a
map through its element, since there are no closures and a module constant
cannot be a class. For `m.get(k)`, `m.has(k)` and `m.size` in such a body to
be legal, S2 must make sure of three things:

1. **`probe` writes nothing.** It answers the found entry or the empty bucket
   in its packed result. The prototypes' `found` field, which `delete` reads,
   is exactly what S2 must not copy, because it would make every `get` a
   shared write (`FunctionFacts.sharedWrite`, [`self/attributes.ts`](../self/attributes.ts)
   line 276). Hashing a string allocates nothing, so a `get` is no NL9012
   either.
2. **The `dst` reachability rule sees through the table's private arrays.** The
   rule judges by type (`reachingPath`, [`self/parallel.ts`](../self/parallel.ts)
   line 286). A `Row { index: Map<string, i32> }` element would "reach an
   `i32[]` through `r.index.values`", and a `dst: i32[]` would be refused.
   Those arrays are never handed out, so no `dst` can be one of them. The rule
   must follow `K` and `V`, which a `get` does return, and skip the table's own
   arrays.
3. **Iterating a map in a body stays refused**, and needs no new rule. The walk
   counter of §6.2 is a store into the table, so the existing shared-write
   message reports it at the loop. So does any `set`, `delete`, `add` or
   `clear` in a body.

S2 adds one positive case, a map read from a `parallelReduce` body, to pin all
three. It adds a `reject_*` case for a `set` in a body, which the existing rule
must already name.

---

## 10. Is an unordered map ever needed? (S7)

*Stub: S7 writes this section.*

S7 measures three comparisons, each natively and under Node, and each against
the unordered prototype of §2:

- **(b)** fused against double lookup on word count;
- **(c)** a map presized with `reserve` against one that grows;
- **(d)** the new `Map` against `StringMap`.

It regenerates `docs/BENCHMARKS.md` on a quiet machine and then decides here
whether an unordered map is ever needed, and on what numbers. Comparison (a),
§2.5, leaves the question open on one shape only: integer keys in a table
larger than the cache, where the ordered layout's second dependent load costs
1.3x to 1.4x.
