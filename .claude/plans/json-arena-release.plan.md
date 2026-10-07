---
name: Free per-pass memory behind jsonField and the parts + join pattern
overview: A loop that calls jsonField keeps about 62 bytes per call because jsonUnescape pushes substrings into a local parts array, and escape analysis treats that push as a store that disables the loop's per-pass arena release. Stage 1 stops jsonField copying every key it compares; stage 2 teaches src/escape.ts that a string pushed into a local array that is only joined does not escape.
stages:
  - id: json-key-compare
    title: std/json — compare keys in place
    goal: jsonField decides whether a key matches by comparing bytes of the object against name in place, without allocating the unescaped key
    verification: npm run check && npm test (zero skips) && the std_json link test passes with new escaped-key cases
    todos:
      - id: json-key-match
        content: Add a non-allocating jsonKeyEquals(object, at, end, name) to std/json.ts that decodes escapes on the fly and replace the jsonUnescape call on keys in jsonField — see std/json — compare keys in place
        status: pending
      - id: json-key-tests
        content: Extend tests/link/std_json with escaped keys, a key that is a prefix of name, and a name that is a prefix of the key — see std/json — compare keys in place
        status: pending
      - id: json-key-measure
        content: Measure jsonField time before and after on a timed loop with a printed checksum and put the figures in the commit's Measured trailer — see std/json — compare keys in place
        status: pending
  - id: escape-join-parts
    title: escape analysis — a pushed string that is only joined does not escape
    goal: A loop calling a function that builds its result with local parts.push(...) then parts.join(...) keeps its per-pass arena release, while any read-back of parts still counts as an escape
    verification: npm run check && npm test (zero skips) && compiler fixed point reached && the new golden prints the same Arena.used() before and after 1000 calls
    todos:
      - id: escape-join-rule
        content: Narrow the push rule in src/escape.ts so an argument pushed into a local array whose only uses are push, join and length is not noted as escaping — see Escape analysis — the join-only rule
        status: pending
      - id: escape-join-golden
        content: Add a positive golden tests/cases/mem_join_parts_scope with .ll and .out showing Arena.used() unchanged across 1000 calls — see Tests
        status: pending
      - id: escape-join-negative
        content: Add negative goldens where parts[0], a for-of over parts, or passing parts to a callee keeps the release off — see Tests
        status: pending
      - id: escape-join-docs
        content: State the rule in docs/LANGUAGE.md Memory model and its cookbook entry, regenerate tests/self/goldens with goldens.js --update — see Escape analysis — the join-only rule
        status: pending
---

## Context

[`std/json.ts`](std/json.ts) `jsonUnescape` builds a decoded literal with a local `parts: string[]`, `parts.push(...)` and `parts.join("")`. [`src/escape.ts`](src/escape.ts) (the `for (const push of this.pushes)` block, ~line 838) notes the pushed value as escaping, so any loop calling `jsonField` gets `LOOP_CALLEE_STORES` and loses its per-pass arena release. Measured in scratch builds: 62 KB kept over 1,000 calls, against 16 bytes with escape decoding rewritten without the array. Separately, `jsonField` unescapes every key it walks past (line 376) just to compare it with `name`.

## std/json — compare keys in place

- New private `jsonKeyEquals(object, at, end, name): boolean` walks `object[at..end)` and `name` together, decoding `\n \t \r \b \f \uXXXX \" \\ \/` and the lenient default exactly as `jsonUnescape` does, and returns false on the first mismatch. A `\uXXXX` compares against the UTF-8 bytes `jsonUtf8` would produce, without building them.
- `jsonField` calls it instead of `jsonUnescape` for keys. Value decoding is unchanged.
- Owns: `std/json.ts`, `tests/link/std_json/**`.
- Commit: `perf(std): compare JSON keys in place in jsonField`, with `Measured:` figures.

## Escape analysis — the join-only rule

- Rule: a value pushed into array `xs` does not escape when `xs` is a local this function allocated (`ownsSite`), flows `local`, and every other use of `xs` is `xs.push(...)`, `xs.join(...)` or `xs.length`. The join result is a fresh allocation and is analysed as it is today.
- Any other use — index read, `for...of`, spread, passing `xs` to a call, assigning it, returning it, a closure capture — keeps today's behaviour (escapes). That is the whole safety argument: a string read back out with `parts[0]` and returned must stay alive.
- The rolling freeze: `src/` may not use the new behaviour in its own source until the next release; nothing in `src/` needs to.
- `docs/LANGUAGE.md` Memory model gains the rule; the cookbook gets the `parts + join` entry with its IR; `tests/self/goldens/checked*.txt` are regenerated with `node tests/self/goldens.js --update`, never hand-edited.
- Owns: `src/escape.ts`, `src/attributes.ts` (only if the use classifier needs a helper), the `src/` files whose NL9011 count the change raises (widened 07:25Z, owner-approved — fix the loops, never raise a count), `tests/perf-baseline.json` (lowering only), `tests/cases/mem_join_parts_*`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/cookbook/**`, `docs/IR_COOKBOOK.md`.
- Commit: `perf(codegen): ...`, with `Measured:` the jsonField loop's kept bytes before/after, `Tests:` the new goldens.

## Out of scope

- Rewriting `replaceAll` in `std/text` or any other `parts + join` user: stage 2 fixes them all by fixing the analysis.
- Following arrays through calls or element reads in general.
- `jsonUnescape`'s value path.

## Tests

| Case | Shape | Expect |
|---|---|---|
| `mem_join_parts_scope` | loop calls `f()` that does local `parts.push(sub)` ×n, `return parts.join("")`; prints `Arena.used()` delta | delta 0 (or a constant), `.ll` shows mark/release in the loop |
| `mem_join_parts_readback` | `f` returns `parts[0]` | release absent; output correct |
| `mem_join_parts_forof` | `f` iterates `parts` and returns an element | release absent |
| `mem_join_parts_passed` | `f` passes `parts` to a callee | release absent |
| `tests/link/std_json` | escaped keys, prefix keys | same answers as before |

## Verification

```
npm run check
npm test            # read the skip count: undegraded means zero skips
node tests/self/goldens.js --update   # stage 2 only, then read the diff
```

Merge order: stage 1 first; stage 2 merges `main` and regenerates goldens before its own merge. The two may be developed concurrently — their `Owns` sets are disjoint.

## Measurement

Both stages measure the way the original investigation did. The harness is not on `main`: it is commit `956506d` on the unmerged branch `ccr-ee7596b7-up0cqq` (`test(bench): benchmark std/json against popular JSON libraries`). To measure, a worker runs `git fetch origin ccr-ee7596b7-up0cqq && git checkout FETCH_HEAD -- bench/json docs/BENCHMARKS-json.md` and never commits those files. It builds `bench/json/json.ts` with `--profile speed`, runs it against `build/bench/json/input-100000.jsonl` and takes the best of 5, records peak RSS with `build/bench/json/rss`, and runs a 1,000-call `jsonField` loop that prints the `Arena.used()` delta. Baseline on `main`: 62 KB kept, 123 ms, 145 MB RSS.

## Real-world evidence, not just the benchmark

The `bench/json` harness and the 1,000-call loop show where the problem is. They are not the evidence that the change helps. Each PR also has to show the following, and a reviewer treats a change tuned to the harness as a blocking finding:

- **No special cases for the harness.** No fast path keyed to the bench input's shape, key order, key lengths or field names, and no change whose only effect is on `bench/json`. The `std/json` stage must win (or break even) on shapes the harness does not contain: the compiler's own `--json` diagnostic lines (the use the `std/json` header names), objects with many keys where the wanted field is last, keys with escapes, and a miss where no key matches.
- **Breadth for the compiler stage.** Count the NL9011 arena-loop warnings, and the loops left unscoped with the "callee stores" reason, across `std/` and `tests/` and in a build of `src/`, before and after. List which real functions newly get their per-pass release (`replaceAll` in `std/text`, `std/net/http1`, `std/net/websocket`, `std/crypto/base64url`, `std/crypto/x509` and any others that use `parts` + `join`). A rule that only frees `jsonUnescape` is too narrow to be worth its code; say so in the PR if that is what the count shows.
- **A real program.** Time and peak RSS of the self-hosted compiler compiling `src/` (stage1 building itself), before and after. It is the largest Nish program in the repo and full of `parts` + `join`. Report it even if the change is flat; a regression is a finding.
- **No regressions elsewhere.** `node bench/run.mjs --check` (instruction counts against `bench/instructions.json`) passes unchanged. If a count moves, explain it in the PR; never edit the baseline to get green.
- **Honest measurement.** Inputs change on every iteration, results are folded into a printed checksum, best of 5 with the spread reported, and before and after built from the same commit apart from the change. A gain inside the noise is reported as no change.

## Acceptance criteria

1. On merged `main`, a loop that calls `jsonField` 1,000 times on a string value and reads only `.length` keeps no more than 64 bytes of arena (`Arena.used()` delta), with `std/json`'s `parts` + `join` code left as it is.
2. The same holds for a loop calling a user function that builds its result with a local `parts.push(...)` then `parts.join(...)`.
3. A function that returns `parts[0]`, iterates `parts`, or hands `parts` to another function still prints the correct string after 1,000 loop passes (no use-after-release), and its loop keeps the release off.
4. `jsonField` answers as before for escaped keys (`"a\nb"`, `"\u0041"`) and when the key is a prefix of the name or the name is a prefix of the key.
5. The `bench/json` harness run against merged `main` is no slower than 123 ms and peaks below 145 MB RSS; the commit messages carry the measured figures in `Measured:` trailers.
6. `docs/LANGUAGE.md` states when a pushed value does not escape, and the compiler built from merged `main` reaches its fixed point.
7. Beyond `jsonUnescape`, at least one other real `parts` + `join` function in `std/` keeps its callers' per-pass release on merged `main`, and the merged PR lists every function that newly does.
8. On merged `main`, `node bench/run.mjs --check` passes with `bench/instructions.json` unchanged, and the self-hosted compiler building `src/` is no slower and uses no more peak RSS than on the base commit, within measured noise.
9. `jsonField` is no slower than on the base commit on shapes `bench/json` does not contain: a compiler `--json` diagnostic line, a 50-key object whose wanted field is last, and a miss.
