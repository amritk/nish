# WP56: Generators whose memory stays flat: a string builder, and a scope per file

**Status: accepted (owner, 2026-11-13), design only.** Nothing here is
built. §10 records the owner's decisions: the builder is `builder()` from
`nish:string`, the other five questions take this note's
recommendations, and Q7 adds S5, object graphs in an arena block. Its stages are in §9 and on
[the roadmap page](roadmap/wp56-flat-memory-generators.md). The plan that
tracks them is
[`.claude/plans/wp56-flat-memory-generators.plan.md`](../.claude/plans/wp56-flat-memory-generators.plan.md).

Every claim about today's compiler is anchored at commit `e0a1661e`, on
`main`. Measurements quoted here come from the documents they cite. This note
takes no new ones: stage S0 takes them.

## 1. The problem

Nish has no garbage collector. Memory comes from a bump arena. The compiler
rewinds that arena around a function or a loop pass when it can prove nothing
the scope allocated is still reachable afterwards
([LANGUAGE.md, Memory model](LANGUAGE.md#memory-model), items 2 and 3).
Everything else is released when `main` returns.

Take a code generator, for example one that turns an OpenAPI document into a
client. It reads a 25 MB spec, builds a model of it, and writes thousands of
files, each built up from strings. Written the way TypeScript would write it,
that program keeps every byte it ever built until it exits:

```ts
const spec = readFileSync("openapi.json");          // 25 MB, kept on purpose
const model = parseModel(spec);                      // kept on purpose
for (const schema of model.schemas) {                // thousands of passes
  let out = "";
  for (const field of schema.fields) {
    out = out + `  ${field.name}: ${tsType(field)};\n`;   // NL9002
  }
  writeFileSync(`out/${schema.name}.ts`, out);
}
```

Four mechanisms combine to keep that memory:

| Mechanism | What it keeps | Where it is today |
| --- | --- | --- |
| `out = out + t` in a loop | every intermediate string, about N²/2 × the piece size per file | `nish_str_concat` copies both inputs into a fresh arena string (`runtime/runtime-text.c:113`). There is no append in place. `s += t` on a string does not compile ([LANGUAGE.md](LANGUAGE.md), `reject_cf_compound_string`). NL9002 warns |
| a pass that stores into memory older than the pass | every temporary the pass made, such as each template literal's N−1 intermediates and `tsType`'s results | the pass-scope conditions ([Memory model](LANGUAGE.md#memory-model), item 2): "no allocation of the pass is stored into memory", and "`push` grows only an array the pass itself declared" |
| `parts.push(...)` onto an outer `string[]` | the parts, and each block the array outgrew | `nish_array_grow` copies into a new arena block and abandons the old one (`runtime/runtime.c:573`) |
| the outer per-file loop | all of the above, for every file | the outer pass is refused its scope because of the inner pass, or because a callee leaves memory behind (NL9011) |

The compiler has measured the same shape on itself. Building 88 KB of IR with
`+` cost 180 MB of resident memory, and fixing the lexer's string scan took it
from 408 MB to 2.4 MB ([wp14-selfhost.md](wp14-selfhost.md), and
[`src/strings.ts`](../src/strings.ts)). NL9016's own example is 10,000,000
passes of ``last = `item ${i}` ``, which peak at 392 MB where the rewrite
peaks at 11 MB (`tests/cases/perf_arena_pass_drop`).

### What a user cannot do today

- **Build a large string in linear memory with an API made for it.** The compiler has a `StringBuilder` (`src/strings.ts:21`), a `string[]` and one `join`, but it is the compiler's own, and `std/` has none. `std/yaml-write.ts`'s `YamlWriter` is a private `u8[]` serializer.
- **Append to a builder from a loop and keep the loop's pass scope.** Any builder written in Nish over `string[]` or `u8[]` grows an array that is older than the pass. That refuses the pass its scope, so the temporaries of every pass stay (§2). `mem_join_parts_scope` keeps the scope only for a `parts` array that the function itself declared and that nothing else touches.
- **Write a file incrementally.** `appendFileSync` opens and closes the file on every call. `writeFileSync` and `writeFileBytesSync` take the whole file at once. There is no write handle to match WP44's `fileOpen`/`fileReadAt`.
- **Build an object graph inside a `using a = arena()` block.** A call inside the block to a function that stores an allocation into memory is refused, always (NL2424, `reject_using_arena_callee_stores`). So a constructor that does `this.parts = []` cannot run inside the block, and neither can a method that pushes onto a field. A generator that wants one formatter or model per file keeps it outside the block and clears it between files with hand-written `reset` methods. One user reports that this holds about 28 MB per worker.
- **Find out from the documentation how to structure such a program.** [memory.md](guide/language/memory.md) explains the warnings, and [regions.md](guide/language/regions.md) explains sessions. No page shows a batch program that produces many outputs, and no test runs file I/O inside a region's `enter`.

## 2. What already works, and where it stops

Some programs can already be written with flat memory. S1 documents how, and
S0 measures it:

1. **One function per file that answers a number.** `const emit = (schema: Schema): i32 => { ...; writeFileSync(path, text); return 0; }`. This function returns no pointer and stores nothing outward, so it takes a function scope. The outer loop's pass then has nothing left behind and keeps its scope too. Within a file, `parts.push` + `join` on a local `parts` is linear. The pass temporaries are still kept until the function returns, which costs about one file's worth of garbage.
2. **`using a = arena()` around one file's work** (memory.md, "Freeing a batch yourself"). This applies when the work cannot move into a function. The block refuses stores outward (NL2418 to NL2421) and growth of an older array (NL2422), so the builder has to be declared inside the block. It also refuses any call to a function that stores an allocation (NL2424), so the block cannot hold a class whose constructor or methods store into its fields. D7 lifts that.
3. **A region per target** (`nish:region`). This is for state that has to outlive one pass but not the program, such as one output that gathers fragments from several passes over the model. `enter` cannot answer a string (NL2611), so the file has to be written inside `enter`. Region memory is live until `free`, so this ought to work, but no test covers it.

Where these stop:

- **Within one file, every pass of the inner loop keeps its temporaries.** A builder held by the pass is memory older than the pass, so each `${...}` intermediate, each helper's result and each grown block of `parts` stays until the file is done. For a file of F bytes made from pieces of average size p with t bytes of temporaries per piece, the peak is about `F + F/p × t + F` (pieces, temporaries, and `join`'s copy), not `F`. For a large single file, such as one types file with every schema in it, that is the whole problem again.
- **The result is materialised twice.** `join` makes one arena string of the whole file next to its parts. Writing that file then reads it once more.
- **Nothing guides the user to these shapes.** NL9002's hint is "a `string[]` and one `join`", which is right about the quadratic cost. It says nothing about scope, or about the per-file function that makes the outer loop flat.

## 3. The decision this note proposes

**D1. A built-in string builder whose bytes live outside the arena.** It is
`builder()`, imported from `nish:string`, which answers a `Builder` (Q1). Its
storage is one block
the runtime grows by doubling with `realloc`, never in the bump arena. Only the
builder's small header is an ordinary arena object. Appending copies bytes
from the argument into that block. It allocates nothing in the arena and
stores no pointer.

This is why it has to be built in. The pass-scope rule cannot be satisfied by
any builder written in Nish, because growing it allocates, and what it
allocates must outlive the pass. Storage that the arena does not own is the
only kind a rewind cannot invalidate. It is also the only kind that leaves the
caller's pass free to rewind its own temporaries.

**D2. The arena position that made the builder owns its storage.** When the
scope that allocated the header is released, the storage is freed with it.
That scope can be a function scope, a pass scope, a `using a = arena()` block,
a region's `free`, or `main` returning. This adds no new lifetime rule. The
header is an ordinary allocation, so the existing escape analysis already
proves it is unreachable when its scope releases. The storage only has to die
at the same moment. A builder can then sit in a region's root, a field or a
local, and needs no `using`. The mechanism is in §5: the compiler emits a
release of the scope's builders at every exit of a scope that may make one,
beside the arena rewind it already emits there. It cannot be left to the
arena, because most rewinds never call the runtime.

**D3. The checker treats `append` like a write to a file.** A call to any
appending method (§4) stores no allocation, grows no array, allocates nothing
in the arena, and keeps every enclosing pass and function scope. `toString()`
is an ordinary string-returning call. It allocates one arena string, and the
call-site reclaim of item 3 can apply to it. A builder never answers a pointer
into its own storage.

**D4. Files are written from the builder without a whole-file string.**
`writeFileSync` and `appendFileSync` gain a `Builder` overload, and
`nish:fs` gains a write handle: `fileCreate`, `fileWrite` and `fileClose`,
mirroring WP44's read side. A generator can then flush its builder to a file
every few kilobytes and `clear()` it. That keeps one file's peak at the flush
size, not the file size.

**D5. The patterns are documented and measured.** A guide page shows the
patterns (§7), and cookbook entries back it. A benchmark holds the claim. Its
gate is that peak resident memory does not grow with the number of files
(§8).

**D6. The diagnostics point at the builder.** The hints for NL9002, NL9016
and (once it lands) NL9018 name `builder()` where the dropped or rebuilt
value is a string. `docs/AI.md` gets the rule: "build output with a
`builder()` from `nish:string`, never `s = s + t` in a loop".

**D7. An object graph made inside a `using a = arena()` block belongs to the
block.** A call that stores an allocation is admitted inside the block when
the memory it stores into was itself allocated inside the block, through any
chain of fields. The stored value and its holder are then released together.
The call is still refused when any member of that graph reaches memory older
than the block: a field or element of an outer object, a `push` onto an outer
array, a capture, or a `return` past the block. Each refusal names its route,
as NL2418 to NL2423 do today. This gives a generator a per-file object graph
without `reset` methods, and it needs no builder.

Parallel bodies already go part of the way. With nish 0.34.1, a body that
makes an object whose constructor stores an array, and calls a method that
pushes onto that array or sets a `Map` field, is accepted. A method that
writes through a field into a second object, such as
`this.root.kids.push(n)`, is refused as "writes memory its caller can see".
The `using arena()` rule is stricter than both: it refuses the constructor
alone. D7 uses one analysis, a graph confined to the block, and S5 builds
it for the arena block. Applying the same analysis to parallel bodies and
`scope()` tasks is deferred (§9).

## 4. The API

```ts
import { Builder, builder } from "nish:string";

const sb: Builder = builder();      // empty; no storage until the first append

// The methods of a Builder:
sb.reserve(bytes: i32): void;                  // grow capacity up front
sb.append(text: string): void;
sb.appendChar(code: i32): void;                // one byte, as String.fromCharCode
sb.appendInt(n: i64): void;                    // decimal, no temporary string
sb.appendF64(x: f64): void;                    // as `${x}` formats it
sb.appendBytes(bytes: readonly u8[], start: i32, end: i32): void;
sb.appendBuilder(other: Builder): void;
sb.length;                                     // i32, bytes so far, read-only
sb.toString(): string;                         // one arena copy; the builder stays usable
sb.clear(): void;                              // length 0, capacity kept
```

`builder()` is the only way to make one, as `region()` is for a `Region`:
`Builder` is a type to annotate with, and `new Builder()` is refused with the
next free `NL2xxx` code, as NL2618 refuses `new Region<T>()`. A factory rather
than a constructor keeps the call that allocates visible at one name, and
needs no constructor overload for a capacity, which `reserve` gives instead.

The `nish:fs` additions (S3), each with `@param`/`@returns` in
`runtime/nish.d.ts`:

```ts
writeFileSync(path: string, text: Builder): void;
appendFileSync(path: string, text: Builder): void;
fileCreate(path: string, mode: i32): i32;            // fd, or negative errno; truncates
fileWrite(fd: i32, text: Builder): i32;        // bytes written or negative errno; all of it
fileWriteBytes(fd: i32, bytes: readonly u8[], start: i32, end: i32): i32;
// fileClose (WP44) closes either kind; it is fs.read today, and S3 lets a
// program granted only fs.write close the handles fileCreate gave it
```

The limits are the same as for a string. Storage past 2^31 − 1 bytes fails
the way an allocation does (`nish: out of memory`, exit 1), checked before
anything is copied, as RT-2 does for `nish_str_concat`. A program that writes
more than that to one file flushes through the write handle.

Under Node, both for `--emit-ts` and when the program runs as TypeScript, the
module lowers to a small class over `string[]` and one `join`. `appendInt` is
`String(n)` and `appendF64` is the same formatting a template uses. The
differential tests hold the two sides byte-identical. Unlike `nish:region`,
`--emit-ts` does not refuse this module (NL4015).

## 5. The runtime

- **Layout.** The header is `{ char *data; uint32_t len; uint32_t cap; uint32_t slot; }`. It is an ordinary object: an arena object, or a stack slot where escape analysis allows one. The layout is two-sided, `src/runtime.ts` and `runtime/nish.h` together, and the layout test pins it (orientation rule 4).
- **Growth.** If `len + n` exceeds `cap`, the new capacity is `max(2 × cap, len + n, 64)`, capped at 2^31 − 1. The block is grown with `realloc`, and the size computation is overflow-checked before the call. `malloc`, `realloc` and `free` are already reserved in `src/c-symbols.ts`. `node tests/run.js c-symbols` confirms nothing new is needed.
- **Ownership (D2): a stack of live blocks, outside the arena.** Each thread has a `malloc`'d, growable stack of entries, one per live builder, each holding its block's pointer. A region has a stack of its own, swapped in and out with its arena by `nish_region_swap`. That struct is separate from `struct nish_arena`, whose 32-byte layout the static asserts pin, so the arena's layout does not change. `builder()` pushes an entry, and the header records its index in `slot`. A `realloc` that moves the block updates the entry through `slot`. Two runtime calls do the rest:
  - `nish_builders_depth()` answers the stack's height.
  - `nish_builders_release(depth)` frees every block above `depth` and pops its entry.

  Nothing lives in arena memory, so the arena is free to rewind, reuse or move whatever it likes. That covers the inline `store` of a pass rewind (`src/emit.ts`, `releasePass`), `nish_arena_keep`'s `memmove`, and `nish_rewind`'s reuse of a chunk.
- **What the compiler emits.** A function *makes builders* when it calls `builder()`, or calls a function that makes builders, through the whole-program fixpoint, joined over a [WP51](wp51-function-references.md) reference's set as every other fact is. Every scope the compiler already brackets with a mark and a release also brackets the builder stack when its body makes builders: a function scope, a loop pass, a `using a = arena()` block, and the call-site reclaim of item 3. It reads `nish_builders_depth()` beside the mark, and calls `nish_builders_release(depth)` on every exit edge, *before* the arena rewind or the `nish_arena_keep`. Scopes nest the way their marks do, so the entries above `depth` are exactly the builders made inside the scope. The escape analysis has already proved those builders unreachable, or the scope would not have been given a mark. A scope whose body makes no builders emits nothing new, so **no existing program's IR moves**, and nish-cmp needs no `DECLARED` entry for S2.
- **Whole-arena releases.** `nish_region_free` frees the region's whole stack. `nish_free_arena`, at the exit of a thread or an async task, frees that thread's stack. So does `nish_reset_arena`, whether a C host calls it or a worker job does. When `main` returns, the process exit reclaims the rest.
- **What S2 refuses rather than supports.** A body run by `parallelMap` and its siblings, a `spawn`ed or `scope()` task, or an `awaitAll` lane may not make builders (§6). These bodies rewind with `nish_rewind` and `nish_reset_arena`, or hand their memory to another arena with `nish_region_adopt`. Splicing the stacks there is possible later, but no stage of this package needs it.
- **Where it lives.** The builder is new C code. It goes either in `runtime/runtime-text.c`, which has to raise `RUNTIME_TEXT_UNIT_BUDGET` in `tests/runtime-budgets.js`, or in a new `runtime/runtime-builder.c`. A new file needs a row in the scope table of [security/runtime.md](security/runtime.md), because `node scripts/security-scope.mjs` refuses an unscoped file. Its findings take the RT-n numbering, and the growth limit gets a test on both sides of it in `tests/runtime-test.c`, as RT-2 has. The stack swap in `runtime-region.c` and the frees in `runtime.c`, `runtime-parallel.c` and `runtime-async.c` move their records and their text budgets (`RUNTIME_TEXT_BUDGET`, `RUNTIME_THREADS_TEXT_BUDGET`, `RUNTIME_REGION_TEXT_BUDGET`) with them.
- **wasm32: refused in S2 (Q5).** `runtime-wasm.c` has no allocator but its bump arena. Builder storage there would be arena storage, which a scoped pass rewinds while the builder still holds it, so the miscompile D3 must never allow. S2 refuses `nish:string` on the wasm profile with a code. A later stage can lift that once `runtime-wasm.c` has a free-list allocator.

## 6. The checker

- **Facts for each method (D3).** In the builtin effect table that the escape analysis and `src/attributes.ts` read, the append methods and `clear` *write through* their receiver but store no pointer and allocate nothing in the arena. `toString` allocates one string and stores nothing. `length` is a pure read. These facts are what let `tests/cases/mem_builder_pass_scope` hold `Arena.mark()` unmoved over 1,000,000 appends of a template from a loop whose builder is older than the loop.
- **Construction is an allocation** and follows every rule an object does: a pass that stores a fresh builder outward has no scope, NL2418 to NL2421 apply inside `using a = arena()`, and NL2609 or NL2610 apply at a region's edge. A builder made inside a region may live in its root, and its storage dies at `free`.
- **Threads (Q3).** A builder stays on the thread that made it. Passing it to `spawn`, a `scope()` task, a channel, a parallel body or across `nish/sync` is refused with the next free code in the checker's `NL2xxx` band. The reason is that two threads appending through one header could race the `realloc`. A body that one of these runs, or an `awaitAll` lane, also may not *make* builders, directly or through a callee (§5).
- **The new fact.** *Makes builders* is a per-function fact in the fixpoint (§5). It is what the emitter reads to bracket a scope's builder stack. The `--emit-arena` report prints it beside each scope, so a test can pin which scopes take the bracket.
- **Interop.** A `Builder` in an exported signature (C header, wasm `.d.ts`, N-API) is refused by the checker, with the next free `NL2xxx` code, and by the sidecar generator (`NL4xxx`) for a module it is asked to wrap. A host gets a string from `toString()`.
- **The capability report (WP35).** The builder needs no capability. The `nish:fs` additions are `fs.write`, as `writeFileSync` is, and are refused where `writeFileSync` is.
- **Object graphs in an arena block (D7).** NL2424 is decided per call today, from the callee's summary "stores an allocation into memory" (`src/escape.ts`, the NL2424 path). S5 splits that summary into *stores into memory the caller passed in* and *stores into memory reachable only from what the call allocated*. The block then follows each fresh object it makes, and each object stored into a fresh object's field, as members of the block's graph. A call is admitted when every store it makes lands in a graph member. Every route by which a member could leave (NL2418 to NL2423, NL2427) is checked against the whole graph, not only the value named at the call. Calls on `this` inside a method are followed through the method's summary, so `f.add(x)` behaves like the stores it makes. Where the analysis cannot place a store, NL2424 stays, with its current wording.
- **Codes.** Each refusal takes the next free number in its band in `src/codes.ts`, one code for each reason, and gets a negative test. Numbers are assigned when S2 is built, not here.

## 7. The patterns (the guide page)

The page is `docs/guide/using-nish/generating-files.md`, "Generating many
files", with a route in `scalar.config.json` and links from memory.md and
regions.md. It uses one running example, a generator over a JSON spec, and
introduces three shapes in this order:

1. **A function per file that answers a number.** This is the default. The page shows `--explain-memory` reporting the outer loop as clean, and the inner loop appending to a `builder()` with its pass scope intact.
2. **`using a = arena()` per file**, for a file built inline in a loop body. The builder is declared inside the block. The block refuses the outward stores of NL2418 to NL2421. After S5 the per-file model or formatter is also made inside the block, so no `reset` method is needed.
3. **A region per target**, for an output that gathers fragments across several passes over the model, such as a barrel file or one module per tag. `regionWith(target, open)` makes a root that holds a `Builder`, `enterWith` appends on each pass, one last `enter` writes the file, and `free` releases it all. The builder's storage goes with it (D2).

The page also covers flushing a large file through `fileCreate`/`fileWrite`
every 64 KiB. It explains why `s = s + t` and pushing onto an outer array keep
memory, with numbers from S0's table. It shows how to watch `Arena.mark()`
across files to check a program, rather than `Arena.used()`, which wobbles
with each chunk (wp46 §1). Each shape has a cookbook program:
`docs/cookbook/mem-file-per-function.ts` and `mem-region-per-target.ts` come in
S1. Shape 2 already has `mem-using-arena.ts`. S2 adds `mem-builder.ts`, and S3
adds `mem-builder-flush.ts`.

## 8. The proof

`bench/wp56-generator/` contains:

- `make-spec.mjs`, a deterministic synthetic OpenAPI-shaped JSON document. Its size and schema count are parameters, and the default is 25 MB with 8,000 schemas.
- Four generators that write one `.ts` file per schema plus one index file:
  - `naive.ts`: `s = s + t`, with no structure.
  - `today.ts`: the best shape possible today, that is §2's function per file with a local `parts` and `join`.
  - `builder.ts`: S2's builder.
  - `flush.ts`: S3's write handle.
- `run.sh`. For each generator it reports peak RSS (`/usr/bin/time -v`, maximum resident set), the bytes written and the wall time, at 1,000, 2,000, 4,000 and 8,000 schemas. Runs are interleaved and repeated to give a noise band (`.claude/testing.md`, "A `Measured:` trailer").

The gates are written for `builder.ts`, and the table goes to
`docs/BENCHMARKS.md`:

- **G1, flat in the number of files.** Peak RSS at 8,000 schemas is within the noise band of peak RSS at 1,000, after subtracting the spec and model (that is, the same run with generation skipped).
- **G2, linear in one file.** One 10 MB output file peaks at no more than the spec and model plus 2.5 × 10 MB. With `flush.ts` it peaks at the spec and model plus 1 MB.
- **G3, the scope is kept.** `tests/link/gen_flat_memory` is a small version, with 2,000 files built in the test. It holds `Arena.mark()` unmoved past the first file and anonymous resident memory within 512 KiB, as `region_sessions_soak` does. A variant built with today's shape is recorded as the baseline and fails the same check, so the test can tell the two apart.

S0 measures `naive.ts` and `today.ts` before any compiler change. If
`today.ts` already meets G1, then S1's documentation alone fixes the reported
problem for many files, and S2 becomes the fix for large single files and
for the inner loop's temporaries. Its priority is then set by the G2 numbers.
In either case the order of the stages is the same.

## 9. Stages

Each stage is one pull request. S5 depends on nothing after S0 and can land
before or after S2 to S4.

| Stage | Lands | Done when |
| --- | --- | --- |
| **S0** Baseline | `bench/wp56-generator/` (spec maker, `naive.ts`, `today.ts`, `run.sh`); the table in `docs/BENCHMARKS.md` | the table has both generators at four sizes, with a noise band |
| **S1** The patterns with today's tools | `tests/cases`/`tests/link` for file I/O inside `enter` (read and write), and `region_per_target`; the guide page with shapes 1 to 3 written over `parts` + `join`; `mem-file-per-function.ts` and `mem-region-per-target.ts` in the cookbook; memory.md and regions.md link to it | `node tests/run.js region` and `node tests/run.js cookbook` pass; the page's examples run under `nish:ok` |
| **S2** `builder()` from `nish:string` | runtime (§5) with its security record rows; the *makes builders* fact, the builder-stack brackets and the refusals (§6), the wasm32 refusal among them; the `nish:string` module and its `nish.d.ts` declarations; the emit-ts lowering; LANGUAGE.md section; golden `.ll`, `llvm-as`, native round trip, negative tests; the cookbook entry; the guide page switched to the builder; `docs/reference/` regenerated; `builder.ts` in the bench | `mem_builder_pass_scope` holds; G1 and G2 for `builder.ts`; `--emit-arena` pins which scopes take the bracket; the `wasi` and `performance` sections pass with no new NL9007; nish-cmp reports no difference, because no existing program makes a builder (§5) |
| **S3** Files from a builder | `writeFileSync`/`appendFileSync` overloads; `fileCreate`, `fileWrite`, `fileWriteBytes`; capability rows; guide flush section; `flush.ts` | G2's flush bound; `tests/link` covers a short write and `EINTR` as WP44's tests do on the read side |
| **S5** Object graphs in an arena block (D7) | the confined-graph analysis in `src/escape.ts` and the split callee summary (§6); `mem_using_arena_graph` (a constructor storing an array, a method pushing onto a nested object's array, a `Map` field, the file written inside the block); one negative test per route a graph member can leave by; the NL2424 row of LANGUAGE.md's `using arena()` table rewritten; memory.md's "Freeing a batch yourself" and the guide page's shape 2 using a graph; `docs/reference/` regenerated | `mem_using_arena_graph` holds `Arena.mark()` unmoved over 2,000 iterations; every existing `reject_using_arena_*` case still refuses; nish-cmp reports no difference; the `wasi` and `performance` sections pass with no new NL9007 |
| **S4** Diagnostics and the gate | NL9002, NL9016 and NL9018 hints naming the builder, with their wordings and goldens; `docs/AI.md`; `gen_flat_memory` (G3) | G1 to G3 green in CI, and the roadmap page ticked |

**Deferred.** These are wanted, but no stage is scheduled for them:

- Lowering `sb.append(\`a${x}b\`)` to three appends, with no intermediate strings.
- Moving `src/` onto the builtin. The rolling freeze forbids this until the release after S2. `src/strings.ts`'s builder stays until then.
- Reusing the blocks that `push` outgrows.
- D7's analysis applied to parallel bodies and `scope()` tasks, so a body can own a graph more than one field deep (§3). This runs on S5's analysis, but it changes the thread rules (LANGUAGE.md, WP29). It gets its own design note once S5 lands.

## 10. Decisions

The owner decided these on 2026-11-13. S2 builds what they say.

- **Q1. The name and module: `builder()` from `nish:string`.** It answers a `Builder`, as `region()` answers a `Region`. The note had proposed `StringBuilder` from `nish:builder`. `nish:string` names what the module is about and leaves room for other string builtins later. It is a different specifier from `std`'s `nish/text`, so the two do not collide.
- **Q2. Lifetime: D2.** The scope that made the builder owns its storage. No `using` is required, so a builder can be held in a field or a region's root, and §7's third shape works. Review of the first draft showed that hanging the storage off the arena could not work. Pass rewinds are an inline store, and `nish_arena_keep` moves memory. So the stack of §5 is kept outside the arena, and the compiler releases it, but only in scopes that make builders. The decision itself is unchanged.
- **Q3. Threads: confined.** A builder stays on the thread that made it (§6). Moving one to another thread by transfer can be designed later, if a program needs it.
- **Q4. Number appends: in S2.** `appendInt` and `appendF64` ship with the builder, each held byte-identical to a template's formatting under Node by the differential tests.
- **Q5. wasm32: refused in S2.** The decision was to support it, or to refuse it with a code where support does not fit. `runtime-wasm.c` has no allocator other than the arena, so S2 refuses it (§5). Supporting it waits for a free-list allocator there.
- **Q6. `s += t` on strings: stays refused.** Its message gains the hint to use `builder()` from `nish:string` (S4).
- **Q7. Object graphs in an arena block: in this work package, as S5 (D7).** This was a user request. Per-file arenas are the generator problem this note is about, so the work goes here instead of a work package of its own. The parallel-body half is deferred (§9).

## 11. Alternatives considered

- **A builder in `std/`, written in Nish over `string[]`**, as `src/strings.ts` is. It fixes the quadratic cost and nothing else. Every append grows an array older than the pass, so every pass that appends keeps its temporaries. NL9018 would warn on exactly the loops it is meant for.
- **A builder in `std/` over a growable `u8[]`.** This has the same scope problem, and it also abandons each outgrown block in the arena (`nish_array_grow`).
- **Appending in place to the arena's last allocation** in `nish_str_concat`, so that `s = s + t` reuses the space when `s` is the newest allocation. This helps only when nothing has been allocated since `s`, and a template's intermediates always have been. It also makes `s`'s old value alias the new one, which breaks immutable strings.
- **A rope type for `string`.** This changes every string operation's cost and layout, and the interop ABI with them. That is out of proportion to the problem.
- **A tracing collector for the arena.** Nish has no GC by design ([memory.md](guide/language/memory.md)), so this is out of scope.
