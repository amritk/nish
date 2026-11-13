# WP55: Generators whose memory stays flat: a string builder, and a region per file

**Status: proposed (2026-11-13), design only.** Nothing here is built. §10
lists the decisions this note asks the owner for. Its stages are in §9 and on
[the roadmap page](roadmap/wp55-flat-memory-generators.md). The plan that
tracks them is
[`.claude/plans/wp55-flat-memory-generators.plan.md`](../.claude/plans/wp55-flat-memory-generators.plan.md).

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

- **Build a large string in linear memory with an API made for it.** The compiler has a `StringBuilder` (`src/strings.ts:21`), a `string[]` and one `join`, but it is not exported, and `std/` has none. `std/yaml-write.ts`'s `YamlWriter` is a private `u8[]` serializer.
- **Append to a builder from a loop and keep the loop's pass scope.** Any builder written in Nish over `string[]` or `u8[]` grows an array that is older than the pass. That refuses the pass its scope, so the temporaries of every pass stay (§2). `mem_join_parts_scope` keeps the scope only for a `parts` array that the function itself declared and that nothing else touches.
- **Write a file incrementally.** `appendFileSync` opens and closes the file on every call. `writeFileSync` and `writeFileBytesSync` take the whole file at once. There is no write handle to match WP44's `fileOpen`/`fileReadAt`.
- **Find out from the documentation how to structure such a program.** [memory.md](guide/language/memory.md) explains the warnings, and [regions.md](guide/language/regions.md) explains sessions. No page shows a batch program that produces many outputs, and no test runs file I/O inside a region's `enter`.

## 2. What already works, and where it stops

Some programs can already be written with flat memory. S1 documents how, and
S0 measures it:

1. **One function per file that answers a number.** `const emit = (schema: Schema): i32 => { ...; writeFileSync(path, text); return 0; }`. This function returns no pointer and stores nothing outward, so it takes a function scope. The outer loop's pass then has nothing left behind and keeps its scope too. Within a file, `parts.push` + `join` on a local `parts` is linear. The pass temporaries are still kept until the function returns, which costs about one file's worth of garbage.
2. **`using a = arena()` around one file's work** (memory.md, "Freeing a batch yourself"). This applies when the work cannot move into a function. The block refuses stores outward (NL2418) and growth of an older array (NL2422), so the builder has to be declared inside the block.
3. **A region per target** (`nish:region`). This is for state that has to outlive one pass but not the program, such as one output that gathers fragments from several passes over the model. `enter` cannot answer a string (NL2611), so the file has to be written inside `enter`. Region memory is live until `free`, so this ought to work, but no test covers it.

Where these stop:

- **Within one file, every pass of the inner loop keeps its temporaries.** A builder held by the pass is memory older than the pass, so each `${...}` intermediate, each helper's result and each grown block of `parts` stays until the file is done. For a file of F bytes made from pieces of average size p with t bytes of temporaries per piece, the peak is about `F + F/p × t + F` (pieces, temporaries, and `join`'s copy), not `F`. For a large single file, such as one types file with every schema in it, that is the whole problem again.
- **The result is materialised twice.** `join` makes one arena string of the whole file next to its parts. Writing that file then reads it once more.
- **Nothing guides the user to these shapes.** NL9002's hint is "a `string[]` and one `join`", which is right about the quadratic cost. It says nothing about scope, or about the per-file function that makes the outer loop flat.

## 3. The decision this note proposes

**D1. A built-in string builder whose bytes live outside the arena.** It is
`StringBuilder`, imported from a `nish:` module (Q1). Its storage is one block
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
local, and needs no `using`. The runtime mechanism is in §5.

**D3. The checker treats `append` like a write to a file.** A call to any
appending method (§4) stores no allocation, grows no array, allocates nothing
in the arena, and keeps every enclosing pass and function scope. `toString()`
is an ordinary string-returning call. It allocates one arena string, and the
call-site reclaim of item 3 can apply to it. A builder never answers a pointer
into its own storage.

**D4. Files are written from the builder without a whole-file string.**
`writeFileSync` and `appendFileSync` gain a `StringBuilder` overload, and
`nish:fs` gains a write handle: `fileCreate`, `fileWrite` and `fileClose`,
mirroring WP44's read side. A generator can then flush its builder to a file
every few kilobytes and `clear()` it. That keeps one file's peak at the flush
size, not the file size.

**D5. The patterns are documented and measured.** A guide page shows the
patterns (§7), and cookbook entries back it. A benchmark holds the claim. Its
gate is that peak resident memory does not grow with the number of files
(§8).

**D6. The diagnostics point at the builder.** The hints for NL9002, NL9016
and (once it lands) NL9018 name `StringBuilder` where the dropped or rebuilt
value is a string. `docs/AI.md` gets the rule: "build output with a
`StringBuilder`, never `s = s + t` in a loop".

## 4. The API

```ts
import { StringBuilder } from "nish:builder";   // Q1: the name of the module

class StringBuilder {
  constructor();                  // empty, no storage until the first append
  constructor(capacity: i32);     // reserve bytes up front

  append(text: string): void;
  appendChar(code: i32): void;            // one byte, as String.fromCharCode
  appendInt(n: i64): void;                // decimal, no temporary string (Q4)
  appendF64(x: f64): void;                // as `${x}` formats it (Q4)
  appendBytes(bytes: readonly u8[], start: i32, end: i32): void;
  appendBuilder(other: StringBuilder): void;

  readonly length: i32;                   // bytes so far
  toString(): string;                     // one arena copy; the builder stays usable
  clear(): void;                          // length 0, capacity kept
}
```

The `nish:fs` additions (S3), each with `@param`/`@returns` in
`runtime/nish.d.ts`:

```ts
writeFileSync(path: string, text: StringBuilder): void;
appendFileSync(path: string, text: StringBuilder): void;
fileCreate(path: string, mode: i32): i32;            // fd, or negative errno; truncates
fileWrite(fd: i32, text: StringBuilder): i32;        // bytes written or negative errno; all of it
fileWriteBytes(fd: i32, bytes: readonly u8[], start: i32, end: i32): i32;
// fileClose (WP44) closes either kind
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

- **Layout.** The header is `{ char *data; uint32_t len; uint32_t cap; struct nish_ext *rec; }`. It is an arena object that is never placed on the stack, because D2 hangs the storage's lifetime off the header's arena position. A stack header in a function without a scope would still be correct, but it would be harder to reason about. The layout is two-sided, `src/runtime.ts` and `runtime/nish.h` together, and the layout test pins it (orientation rule 4).
- **Growth.** If `len + n` exceeds `cap`, the new capacity is `max(2 × cap, len + n, 64)`, capped at 2^31 − 1. The block is grown with `realloc`, and the size computation is overflow-checked before the call. `malloc`, `realloc` and `free` are already reserved in `src/c-symbols.ts`. `node tests/run.js c-symbols` confirms nothing new is needed.
- **Ownership (D2).** Each arena has a newest-first list of *external blocks*: the main arena, each thread's arena, and each region's arena. Constructing a builder bump-allocates a small record `{ prev, header }` in the current arena and pushes it onto the list. `nish_arena_release(mark)` already finds the chunks newer than `mark`. It also pops from the head every record that lies in a chunk being freed, or at or above `mark` in the chunk it keeps, and frees that record's block. Records are bump-allocated in order, so the ones to free are always a prefix of the list. When no builder exists, the extra cost of a release is one load and one compare against null. `nish_region_free` frees its arena's whole list. `nish_reset_arena`, for a C host, frees the main list. When `main` returns, the process exit reclaims the rest.
- **`nish_arena_keep`** moves a returned string down onto a mark. It never moves a builder, because a builder is not a string. A function that answers a `StringBuilder` answers a pointer, so it takes no function scope, and its caller's position owns the builder. That is already the rule for any object.
- **Where it lives.** The builder is new C code, so it either goes in `runtime/runtime-text.c` under `RUNTIME_TEXT_UNIT_BUDGET` (`tests/runtime-budgets.js`, which it would have to raise), or in a new `runtime/runtime-builder.c`. A new file needs a row in [security/runtime.md](security/runtime.md)'s scope table, because `node scripts/security-scope.mjs` refuses an unscoped file. Its findings take the RT-n numbering, and the growth limit gets a test on both sides in `tests/runtime-test.c`, as RT-2 has. The release hook changes `runtime.c` and `runtime-region.c`, so their records move with it.
- **wasm32.** `runtime-wasm.c` has its own allocator and no `realloc`. The builder there takes its storage from the same allocator, which grows by copying, and the ownership list is the same code. If S2 cannot do that within the wasm size budget, the builtin is refused on that target with a code (Q5). It must not be miscompiled silently.

## 6. The checker

- **Facts for each method (D3).** In the builtin effect table that the escape analysis and `src/attributes.ts` read, the append methods and `clear` *write through* their receiver but store no pointer and allocate nothing in the arena. `toString` allocates one string and stores nothing. `length` is a pure read. These facts are what let `tests/cases/mem_builder_pass_scope` hold `Arena.mark()` unmoved over 1,000,000 appends of a template from a loop whose builder is older than the loop.
- **Construction is an allocation** and follows every rule an object does: a pass that stores a fresh builder outward has no scope, NL2418 applies inside `using a = arena()`, and NL2609 or NL2610 apply at a region's edge. A builder made inside a region may live in its root, and its storage dies at `free`.
- **Threads (Q3).** A builder stays on the thread that made it. Passing it to `spawn`, a `scope()` task, a channel, a parallel body or across `nish/sync` is refused with the next free code in the checker's `NL2xxx` band. The reason is that two threads appending through one header could race the `realloc`.
- **Interop.** A `StringBuilder` in an exported signature (C header, wasm `.d.ts`, N-API) is refused by the checker, with the next free `NL2xxx` code, and by the sidecar generator (`NL4xxx`) for a module it is asked to wrap. A host gets a string from `toString()`.
- **The capability report (WP35).** The builder needs no capability. The `nish:fs` additions are `fs.write`, as `writeFileSync` is, and are refused where `writeFileSync` is.
- **Codes.** Each refusal takes the next free number in its band in `src/codes.ts`, one code for each reason, and gets a negative test. Numbers are assigned when S2 is built, not here.

## 7. The patterns (the guide page)

The page is `docs/guide/using-nish/generating-files.md`, "Generating many
files", with a route in `scalar.config.json` and links from memory.md and
regions.md. It uses one running example, a generator over a JSON spec, and
introduces three shapes in this order:

1. **A function per file that answers a number.** This is the default. The page shows `--explain-memory` reporting the outer loop as clean, and the inner loop appending to a `StringBuilder` with its pass scope intact.
2. **`using a = arena()` per file**, for a file built inline in a loop body. The builder is declared inside the block.
3. **A region per target**, for an output that gathers fragments across several passes over the model, such as a barrel file or one module per tag. `regionWith(target, open)` makes a root that holds a `StringBuilder`, `enterWith` appends on each pass, one last `enter` writes the file, and `free` releases it all. The builder's storage goes with it (D2).

The page also covers flushing a large file through `fileCreate`/`fileWrite`
every 64 KiB. It explains why `s = s + t` and pushing onto an outer array keep
memory, with numbers from S0's table. It shows how to watch `Arena.mark()`
across files to check a program, rather than `Arena.used()`, which wobbles
with each chunk (wp46 §7). Each shape gets a cookbook program:
`docs/cookbook/mem-builder.ts`, `mem-builder-flush.ts` and
`mem-region-per-target.ts`.

## 8. The proof

`bench/wp55-generator/` contains:

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

Each stage is one pull request.

| Stage | Lands | Done when |
| --- | --- | --- |
| **S0** Baseline | `bench/wp55-generator/` (spec maker, `naive.ts`, `today.ts`, `run.sh`); the table in `docs/BENCHMARKS.md` | the table has both generators at four sizes, with a noise band |
| **S1** The patterns with today's tools | `tests/cases`/`tests/link` for file I/O inside `enter` (read and write), and `region_per_target`; the guide page with shapes 1 to 3 written over `parts` + `join`; cookbook entries; memory.md and regions.md link to it | `node tests/run.js region` and `node tests/run.js cookbook` pass; the page's examples run under `nish:ok` |
| **S2** `StringBuilder` | runtime (§5) with its security record rows; the checker facts and refusals (§6); the `nish:` module and its `nish.d.ts` declarations; the emit-ts lowering; LANGUAGE.md section; golden `.ll`, `llvm-as`, native round trip, negative tests; the cookbook entry; the guide page switched to the builder; `docs/reference/` regenerated; `builder.ts` in the bench | `mem_builder_pass_scope` holds; G1 and G2 for `builder.ts`; the `wasi` and `performance` sections pass with no new NL9007; nish-cmp `DECLARED` entries if any corpus IR moves |
| **S3** Files from a builder | `writeFileSync`/`appendFileSync` overloads; `fileCreate`, `fileWrite`, `fileWriteBytes`; capability rows; guide flush section; `flush.ts` | G2's flush bound; `tests/link` covers a short write and `EINTR` as WP44's tests do on the read side |
| **S4** Diagnostics and the gate | NL9002, NL9016 and NL9018 hints naming the builder, with their wordings and goldens; `docs/AI.md`; `gen_flat_memory` (G3) | G1 to G3 green in CI, and the roadmap page ticked |

**Deferred.** These are wanted, but no stage is scheduled for them:

- Lowering `sb.append(\`a${x}b\`)` to three appends, with no intermediate strings.
- Moving `src/` onto the builtin. The rolling freeze forbids this until the release after S2. `src/strings.ts`'s builder stays until then.
- Reusing the blocks that `push` outgrows.

## 10. Open questions for the owner

- **Q1. The name and module.** The recommendation is `StringBuilder` from `nish:builder`. The alternatives are `nish:text`, which is close to `nish/text` in `std` and invites confusion, or a global builtin like `Map`. A global would not exist when the program runs as plain TypeScript without the shim.
- **Q2. Lifetime.** The recommendation is D2, where the arena position owns the storage. The alternative is to require `using sb = new StringBuilder()` (a WP53-style handle class) and refuse any other binding. That is simpler in the runtime, but it rules out a builder in a region root or a field, and so rules out §7's third shape.
- **Q3. Threads.** The recommendation is to confine a builder to the thread that made it. A builder that moves to another thread by transfer is possible later.
- **Q4. Number appends.** Should `appendInt` and `appendF64` be in S2? They save one temporary string for each number, which matters for generators that write numbers, but they add formatting code paths whose bytes must match the template formatting under Node.
- **Q5. wasm32.** Should S2 support the builder on the wasm profile, or refuse it with a code until WP50's allocator grows a `realloc`?
- **Q6. `s += t` on strings.** The recommendation is that it stays refused. Its message would gain the builder hint, so that `+=` never looks cheaper than it is.

## 11. Alternatives considered

- **A builder in `std/`, written in Nish over `string[]`**, as `src/strings.ts` is. It fixes the quadratic cost and nothing else. Every append grows an array older than the pass, so every pass that appends keeps its temporaries. NL9018 would warn on exactly the loops it is meant for.
- **A builder in `std/` over a growable `u8[]`.** This has the same scope problem, and it also abandons each outgrown block in the arena (`nish_array_grow`).
- **Appending in place to the arena's last allocation** in `nish_str_concat`, so that `s = s + t` reuses the space when `s` is the newest allocation. This helps only when nothing has been allocated since `s`, and a template's intermediates always have been. It also makes `s`'s old value alias the new one, which breaks immutable strings.
- **A rope type for `string`.** This changes every string operation's cost and layout, and the interop ABI with them. That is out of proportion to the problem.
- **A tracing collector for the arena.** Nish has no GC by design ([memory.md](guide/language/memory.md)), so this is out of scope.
