# WP66 run report: C libraries from their headers

Run ledger: amritk/nish#1793 · plan: `.claude/plans/wp66-c-headers.plan.md` on branch `claude/friendly-meitner-4vkntk` (b1e37e30)
Window: plan accepted 2026-11-19 15:27Z → last merge 2026-11-20 03:14Z (11 h 47 m; deadline was 07:27Z) · main at the end: 13db709f

## What was asked

Build the rest of WP66 on top of S1, which merged earlier as #1758:
- the `nish c-import` generator;
- opaque classes;
- fixed-length array fields;
- buffers paired with a count by name;
- packages that link C;
- the generator taught the three new spellings, and §4 re-measured.

S6 (callbacks) stayed an open question and was not built, as agreed at sign-off. Sign-off decisions:
- **D5:** a field-less `declare class` is opaque.
- **D6:** `nish.link` takes `libraries` and `sources`, with no pkg-config.
- The lead merges on green, the deadline is 16 h, and this report is handed over as a file.

## What shipped

| Stage | PR | Merged as | Review rounds | What it adds |
|---|---|---|---|---|
| s7 | #1796 | abadc9f9 | 5 / 6 | `package.json` `nish.link.libraries` / `sources`; a dependency's link needs the root's grant (NL3061); `docs/security/package-link.md` |
| s3 | #1795 | 4d9618cf | 2 / 6 | A field-less `declare class` is an opaque C type: no `new`, no fields, no escape, never mixed with another opaque type |
| s5 | #1794 | f2b8933f | 2 / 6 | `CountedBy<buf, "count">`: a buffer names its count, `u8`–`u64` or an out class; the check runs before C and is proven away when the count is the buffer's length |
| s4 | #1803 | 18af09c6 | 1 / 6 | Fixed-length array fields (`Record<integer<0, N-1>, T>`) laid out like clang's `[N x T]`, indexed with a range check |
| s2 | #1798 | 1d6311f8 | 6 / 6 | `nish c-import`: clang AST → a checked-in Nish module with an overrides file, a Not bound report and a data-model guard (NL3062); `docs/security/c-import.md` |
| s8 | #1810 | 13db709f | 3 / 6 | The generator emits opaque classes, array fields and `CountedBy`; §11.1 re-measures the four headers (sqlite3.h: 52 → 72 of 300 functions bound) |

Every merge passed the same gate:
- converged review;
- every required check green on a merge ref that included the then-current main (read from the lint job's checkout line);
- no conflict;
- files within the stage's Owns, and no sensitive paths;
- main green.

## Acceptance (main 13db709f)

A local agent built the compiler from main. It ran each criterion as a user would and named the test that pins it. The result was 7 pass and 3 partial, with no failures and nothing left unrun.

| # | Criterion (short) | Result |
|---|---|---|
| 1 | c-import sqlite3.h: exit 0, compiles, all 300 functions bound or listed | **pass**: 242 bound + 58 listed, the same 300 names as clang's AST |
| 2 | A program opens `:memory:` through the generated module under `nish run` | **partial**: works, but only with `main` in the generated file or the declarations copied (see gap 1) |
| 3 | Unknown override parameter is a coded error; overrides change output per §7 | **partial**: the output changes are right; the refusal has no NL code, as the guide says on purpose (gap 2) |
| 4 | Another data model is refused, naming the regeneration command | **pass** (NL3062) |
| 5 | Opaque mix-up and `new` refused; `Db \| null` round trip | **pass** (NL2117, NL2806; round trip prints `val=42`, `null ok`) |
| 6 | `unsigned h[5]` reads back by index | **pass** (`h0=100 h4=104 n=5 sum=510`) |
| 7 | `u32` count checked before C, proven away for the buffer's own length | **pass** (panics before C; `ffi-length` proven, no check in the IR) |
| 8 | `nish.link.libraries: ["z"]` under `nish run` and `--link`; a dependency waits for the grant | **pass** (`zlib 1.3`; NL3061 without the grant) |
| 9 | c-import emits the new spellings; §11.1 in the design note | **pass** |
| 10 | Docs, security records, `security-scope.mjs` | **partial**: the records and scope pass; `package.schema.json` lacks `nish.link` (gap 3) |

## Gaps that remain (each with a reproduction)

1. **A generated module cannot be imported for its functions.**
   - `import { sqlite3_open } from "./sqlite3"` fails with "declared … but not exported".
   - Adding `export` fails with "`declare function sqlite3_open` cannot be exported: it is a C function this program calls".
   - The guide says "import it like any other", and its example copies the declarations instead.
   - Users today paste their `main` into the generated file, or copy declarations into their own. This is the biggest usability gap.
2. **A bad override has no NL code.** It is a bare stderr line with exit 1, and `c-import` has no `--json`, so CI wrappers can't tell it apart from other failures. The criterion asked for a code; the guide documents its absence.
3. **`schemas/package.schema.json` and the generated `docs/reference/config/package-json.md` do not list `nish.link`.** They still say a dependency's `nish` field is ignored. `gen-reference --check` passes, because the schema itself is stale. Reproduce with `grep -n '"link"' schemas/package.schema.json`, which finds nothing.
4. **A missing `nish.link` surfaces as a raw `undefined reference` link error**, with `--link` exiting 3. The message does not point at `nish.link`.
5. Smaller items:
   - The c-import refusal of `"nullable"` on an `unsigned char *` count names `CPtr | null` where the module writes `OutU8`.
   - Two non-blocking items from #1798 round 6 may still be open: a bare `enum e;` re-exporting an included enum's constants, and typedef `aligned` applied regardless of order.
   - The NL3036 message does not mention `link` (noted during s7).

## What went wrong in the run, and what it cost

- **s3 stalled for about 2.5 h (18:18–20:46Z).**
  - Its respawned session refused my instruction to merge main, because a worker's auto-mode permission check rejects actions instructed only by another session.
  - I also missed a check-in from 19:17 to 20:44Z, so nobody noticed.
  - Fix used afterwards: put the update step in the worker's initial prompt, and always re-arm the check-in before reporting.
- **Two amend-respawns** (s3, s7): fixes needed files outside the stage's Owns. In each case the worker asked, I widened Owns in the ledger, and I respawned the session.
- **A diagnostic code collision.** #1798 and #1796 both claimed NL3059. #1796 merged first, so #1798 had to renumber to NL3062, which cost one conflict cycle with no CI.
- **s2 held a push for about 1 h** to run the full suite locally, which CLAUDE.md says to leave to CI. Told to stop, it pushed.
- **s2 took all six review rounds.** Its recurring classes were header text reaching the module (fixed with a single emission validator) and facts read only from a declaration's first occurrence.
- **Worker cost (partial, from session records):** s2 ≈ $69, s5 ≈ $23, s8 ≈ $19, s4 ≈ $18, s7 respawn ≈ $4, s3 final ≈ $2. The first s3 and s7 sessions and the lead's own cost are not included.

## Proposed CLAUDE.md lines (not applied)

- "A PR that adds a diagnostic code re-checks the next free number against `main` just before it merges; two open PRs can claim the same code (WP66: NL3059)."
- "In a cloud container `node tests/run.js wasi` fails at the link step (no wasm32 builtins library, about 51 cases); say so in the PR body and let CI's shards answer."
- "A generator's checked-in output (`tests/c-import/*.ts.expected`) is compiled by the built compiler in a test, not only text-diffed."
- "A record or guide sentence about a generator's output is checked by running the generator on the example it gives."

## Next step: a /feature prompt for the follow-ups

```
/feature WP66 follow-ups (after #1793). Requirements:
1. A program can use a module written by `nish c-import` without copying it: either a module may export its `declare function`s and the out classes they take, or the guide states the supported pattern and c-import writes a form that fits it. Decide with the owner at sign-off; update docs/guide/using-nish/c-import.md ("import it like any other") either way.
2. `schemas/package.schema.json` (and the generated docs/reference/config/package-json.md) lists `nish.link` (`libraries`, `sources`, `dependencies`) and stops saying a dependency's `nish` field is ignored.
3. A missing `nish.link` library turns the raw `undefined reference` link failure into a diagnostic that names `nish.link`; NL3036's message mentions `link`.
4. Decide whether a refused c-import override carries an NL code and `--json` output; if yes, add the codes with tests/link negatives.
5. Small leftovers: the "nullable" refusal message on an `unsigned char *` count names the class the module writes; verify and close #1798 round 6's non-blocking items (bare `enum e;` after an included definition; typedef `aligned` order).
Out of scope: S6 (callbacks) and D7 (regenerating std/sqlite.ts), which stay open questions for a design pass first.
```
