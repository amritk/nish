---
name: WP35 — capability analysis and report
overview: The compiler works out which dangerous capabilities (fs, process, net, env, clock, entropy, signal, exit, ffi) every function, module and package can reach. It records one witness call chain per capability and reports them through --emit-capabilities and nish run --capabilities. This PR only reports; enforcement comes in a later one.
stages:
  - id: capabilities
    title: feat(checker) — compute and report each function's reachable capabilities (WP35)
    goal: Every builtin carries exactly one capability label, the attributes fixpoint carries capability sets with a witness path per capability, and the CLI reports them as stable JSON and as a one-line run summary
    verification: npm run check && npm test (undegraded — read the skip count) && npm run lint && npm run lint:dead && node docs/check-links.mjs && npm run test:cli
    todos:
      - id: design-note
        content: Write docs/wp35-capabilities.md covering the set, the builtin audit table, propagation, witness choice, the JSON shape and what is out of scope. Commit it first — see Design note
      - id: capability-table
        content: Add src/capabilities.ts, a total map from every builtin (plain, dotted and every nish-module export) to exactly one capability or none, plus a self-check that fails on an unlabelled builtin — see Builtin audit
      - id: site-collection
        content: Record each builtin and declare-function call site's capability and position in the FactCollector of src/attributes.ts, and record user-call sites with their node — see Propagation
      - id: fixpoint
        content: Carry a capability bitmask plus a per-capability witness (callee and site, distance) through propagate in src/attributes.ts, picking the shortest chain with ties broken by source order — see Propagation
      - id: emit-flag
        content: Add --emit-capabilities with a file.json argument to src/compile.ts and write the report from src/compilation.ts, one object per package, module and exported function — see JSON shape
      - id: run-summary
        content: Add nish run --capabilities, which prints one summary line on stderr before the program runs and leaves its stdout alone — see Run summary
      - id: fixtures
        content: Add fixtures — one per capability, transitive through a package with node_modules, generics per instantiation, function parameters, parallelMapInto bodies, plus a negative case — see Tests
      - id: cli-contract
        content: Add a stable-format check of the JSON to tests/nish/cli.ts — see Tests
      - id: docs-changelog
        content: Add the docs/LANGUAGE.md rule, the docs/AI.md line, the cookbook entry, the CHANGELOG.md line and the AGENTS.md CLI table row, then regenerate goldens with node tests/self/goldens.js --update — see Docs
---

# WP35 — capability analysis and report

## Context

The work stream's goal is that the compiler can prove which dangerous actions a program can perform. Today [src/attributes.ts](../../src/attributes.ts) already runs a whole-program fixpoint (`analyzeFunctions` → `propagate` / `propagateCallee`) over `FunctionFacts`, keyed by LLVM symbol, and every call in Nish is direct:

- generics are monomorphised, so each instance is its own symbol (`sig.instance`);
- a function parameter is an instantiation per callee (`apply$fn.6.square`), so there is no indirect call (LANGUAGE.md "Function parameters");
- `parallelMapInto` / `parallelReduce` bodies are their own instances (`isParallelEntry`).

So capabilities can ride the same fixpoint, with no conservative "unknown callee" case for user code. The one opaque case is a `declare function` (`sig.foreign()`), which is `ffi` by definition.

Builtins are checked in [src/builtins.ts](../../src/builtins.ts). The plain callees (`readFileSync`, `getenv`, `spawnSync`, `signalFd`, …) are listed near line 134, and the dotted ones (`process.exit`, `Math.random`, `Date.now`, `crypto.getRandomValues`, …) are in `checkDotted`. The `nish:` modules are in [src/nish-modules.ts](../../src/nish-modules.ts), including all of `nish:net` (`isNetExport`). There is no `nish:unsafe` module on `main` (base `e2826b9`), so `unsafe` is reserved in the set but labels nothing yet.

The next free WP number is **35**. `docs/` runs to `wp34-hosting-cs.md`, and no open PR claims 35.

## Stage: capabilities

**Owns:** `src/**`, `docs/**`, `tests/**`, `CHANGELOG.md`, `AGENTS.md`. This is the only stage, so it overlaps no other.

## Approach

- **One PR, one stage.** Every change to `src/` moves `tests/self/goldens/checked-self.txt`, so two parallel `src/` slices would conflict by construction. The design note is the stage's first commit, and the squash lands one `feat(checker)` entry.
- **Report-only.** No diagnostic, no refusal and no change to emitted IR. Every existing `.ll` golden must stay byte-identical. A fixture's own `.ll` is new, and `tests/nish-cmp.js` must see no IR difference against 0.16.0 for any existing program. No new code in `src/codes.ts` is needed. If one turns out to be needed (for example a usage error for `--emit-capabilities` without a file), it takes the next free number in its band and gets a `tests/wordings/` program.
- **A capability is a bit.** `CAP_FS_READ`, `CAP_FS_WRITE`, `CAP_PROCESS_SPAWN`, `CAP_NET`, `CAP_ENV`, `CAP_CLOCK`, `CAP_ENTROPY`, `CAP_SIGNAL`, `CAP_EXIT`, `CAP_FFI`, `CAP_UNSAFE` live in one `i32` mask on `FunctionFacts`, so the fixpoint step is an `|`. The `deterministic` set is a constant mask: clock, entropy, env, fs.read, fs.write, net, process.spawn and ffi.
- **Labelled at the builtin, not at the runtime symbol.** `facts.callees` holds runtime symbols (`nish_read_file`…), but a witness needs the *call site*, and a runtime symbol may serve several builtins. The checker-facing name (`readFileSync`, `process.exit`, `net.connect`) is the key of the audit table.
- **The rolling freeze.** `src/` may *use* only what the 0.16.0 seed compiles: Nish-0, StringMap/StringSet, no new construct. The new code is plain Nish-0, so it is legal there.

## Design note

`docs/wp35-capabilities.md`, written and committed before any `src/` change, in the style of the existing `docs/wp3x-*.md` notes:

1. **The set.** The eleven capabilities, each with its meaning and why it is dangerous, plus the `deterministic` rule. **Ambient = none**: stdout/stderr (`console.log`, `console.error`), `process.argv`, `panic`, arena control, `Math.*` except `random`, string and array builtins, and `nish/threads` are not capabilities. The note says why for each: output is an effect and not an input, and argv is the program's input, so determinism is "same argv and stdin gives same output".
2. **The audit table.** Every builtin, one row each, one label (a capability or `none`). Seeded from the brief:

   | capability | builtins |
   |---|---|
   | fs.read | readFileSync, readFileSyncOrNull, readFileBytesSync, readdirSync, realpathSync, isDirectorySync |
   | fs.write | writeFileSync, appendFileSync, mkdirSync |
   | process.spawn | spawnSync, spawnSyncTo |
   | net | every `nish:net` export |
   | env | getenv |
   | clock | Date.now, monotonicNanos, statMtimeSync (file times) |
   | entropy | crypto.getRandomValues, Math.random (seeded from `time()` and `getpid()` in runtime.c `nish_random`) |
   | signal | signalFd and the other signal builtins |
   | exit | process.exit (`nish:process` `exit` too) |
   | ffi | any call to a `declare function` |
   | unsafe | reserved — `nish:unsafe` has not landed |

   Every builtin the audit finds beyond this list gets a row too. A builtin in two families (for example a file *time* read) takes the one label the brief gives it: statMtimeSync is clock.
3. **Propagation.** The bitmask joins in `propagateCallee`. The witness is a per-(function, capability) record `{ via: callee symbol or builtin name, site: file:line:col, dist }`, relaxed to the smallest `dist` with ties broken by the site's source order. That makes the chain the shortest one and the JSON byte-stable. A chain is rebuilt by following `via` until a builtin.
4. **Granularity.** A function's set is per *instance*: `id<T>` at two type arguments, or `apply` at two callees, are two entries, each named as diagnostics name it (`apply<square>`). A module's set is the union over its functions. A package's set is the union over its modules. The program's set is the entry's closure.
5. **JSON shape** (below), and its stability promise: keys in a fixed order and arrays sorted, so it is diffable in CI.
6. **Out of scope.** Enforcement (a manifest field under `"nish"` in package.json, `--deny`, or a diagnostic), which is the next PR. Also out: capability-typed handles and `using` tokens, argument-level precision (which path is read, which host is dialled), wasm/WASI targets beyond reporting, nondeterminism from thread scheduling or float reduction order, and memory-safety/UB facts.

## Builtin audit

`src/capabilities.ts` holds the table and one function, `builtinCapability(name: string): i32`. It returns a bit, `CAP_NONE` (0, meaning a deliberate "none"), or `CAP_UNLABELLED` (-1). A self-check makes "unlabelled is a bug" executable rather than a convention: the walk in `src/attributes.ts` hits a builtin whose label is `CAP_UNLABELLED`, which is an ICE (exit 70 through `src/ice.ts`). A test in `tests/` also enumerates every builtin name the checker accepts and asserts that each has a label, so a new builtin added without a row fails `npm test` even before any program calls it. It enumerates the plain-callee list in `src/builtins.ts`, the dotted members, and every `nish:` module export from `src/nish-modules.ts`. Mirror the `tests/diagnostic-coverage.js` registry check.

## Propagation

- In `collectFacts` / `FactCollector` ([src/attributes.ts](../../src/attributes.ts)), at each builtin call node, set the bit and seed its witness `{ via: <builtin>, site, dist: 0 }`. At each `sig.foreign()` callee, set `CAP_FFI` with the declare's own name as `via`. At a user call, remember `(callee symbol, site)` so `propagate` can name the hop. `collectFacts` currently returns early for foreign signatures, so give a foreign function `CAP_FFI` there and let callers inherit it.
- In `propagateCallee`: `f.caps |= callee.caps`, and for each bit relax `f.witness[bit]` to `callee.witness[bit].dist + 1` via that call's site. Termination holds because the bits only grow and the distances only shrink, over a finite graph.
- Run it in **round 2 only** (the `facts` table `analyzeFunctions` returns), so it adds no round. Measure the compile time of `src/` before and after, and put the figure in the `Measured:` trailer.
- `parallelMapInto` / `parallelReduce` / `spawn` instances already have the body as a direct callee. Assert it in a fixture rather than special-casing it.
- The fixpoint already covers every module, packages included, because the table is keyed by LLVM symbol across modules.

## JSON shape

`--emit-capabilities <file.json>` writes one object (2-space indent, trailing newline, keys in this order):

```json
{
  "version": 1,
  "entry": "main.ts",
  "deterministic": false,
  "capabilities": ["clock", "fs.read"],
  "packages": [
    { "name": "<root>", "capabilities": ["clock", "fs.read"],
      "modules": [
        { "path": "main.ts", "capabilities": ["clock", "fs.read"],
          "functions": [
            { "name": "main", "exported": true, "capabilities": ["clock", "fs.read"],
              "witnesses": {
                "fs.read": [
                  { "function": "main", "at": "main.ts:4:10", "calls": "load" },
                  { "function": "load", "at": "lib.ts:2:3", "calls": "readFileSync" }
                ]
              } }
          ] }
      ] }
  ]
}
```

- `capabilities` arrays use the fixed order of the set, not discovery order.
- `functions` lists every **exported** function plus every instance of one: `id<i32>` and `apply<square>` each get an entry. Non-exported helpers appear only inside witness chains.
- Paths are relative to the entry's directory (a package module as `node_modules/<pkg>/<file>`), so the file does not depend on the checkout path.
- Writing the file reuses the path planning `--emit-header` uses, directories included.

## Run summary

`nish run --capabilities main.ts` prints exactly one line to **stderr** before the program runs, and then runs the program as usual. Stdout stays the program's. For example `capabilities: clock, fs.read (not deterministic)`, or `capabilities: none (deterministic)`. The flag is not part of the run-cache key unless it has to be. If it is, say why in the note.

## Tests

| fixture | pins |
|---|---|
| `tests/cases/caps_<capability>` × 10 (fs_read, fs_write, process_spawn, net, env, clock, entropy, signal, exit, ffi) | each label, through one user hop so a witness has two entries; `.ll` golden plus `.stdout` round trip as the harness expects, with a sibling `.caps.json` expected report |
| `tests/cases/caps_pure` | `deterministic: true`, `capabilities: []`, and console.log/argv/exit-free arithmetic being none. `exit` alone keeps `deterministic: true` |
| `tests/link/caps_package/` with `node_modules/` | a capability reached only through a package's module, attributed to that package and module, with the witness crossing the package boundary. Packages with `node_modules` live under `tests/link/` in this repo (for example `package_generic`). Put it there, or under `tests/cases/` if the harness supports it |
| `tests/cases/caps_generic` | `pick<T>` instantiated at two types whose callees differ, so one instance reaches fs.read and the other none |
| `tests/cases/caps_fnarg` | `apply(f, x)` given a pure callee and an env-reading arrow, so two entries with two different sets |
| `tests/cases/caps_parallel` | a `parallelMapInto` body that calls `Date.now()` makes its caller `clock` |
| negative | `reject_emit_capabilities_no_file` (the usage error, exit 2) and a self-check case showing an unlabelled builtin is an ICE (via the suite hook, as `NISH_SIMULATE_ICE` is driven) |
| `tests/nish/cli.ts` | runs `--emit-capabilities` on a fixture and checks the JSON byte-for-byte against the expected file: key order, sorted arrays, relative paths, trailing newline. It also checks the `run --capabilities` summary line format |

Show the exact LLVM IR for every TypeScript fixture in the PR body (CLAUDE.md).

## Docs

- `docs/LANGUAGE.md`: a "Capabilities" rule — the set, the audit, the deterministic rule, and that it is a report today. `docs/AI.md`: one line under "Before you say it compiles" pointing authors at `--emit-capabilities`. `docs/cookbook/`: an entry with a compiled example. `CHANGELOG.md`: the line. `AGENTS.md`: the CLI table row for the new flag, and the `--help` usage string in `src/compile.ts`.
- Regenerate goldens only with `node tests/self/goldens.js --update`, and read the diff. Declare any `tests/nish-cmp.js` difference as that file requires (there should be none in IR).

## Out of scope

- Enforcement of any kind: manifests, deny lists, new diagnostics that refuse programs.
- `nish:unsafe`. The bit is reserved, but nothing is labelled until the module lands.
- Argument-level precision, per-path or per-host policies, and taint.
- Changing emitted IR or any LLVM attribute.

## Verification

```bash
npm run check
npm test                     # must show no DEGRADED banner; skips only the three environmental ones
npm run lint && npm run lint:dead
node docs/check-links.mjs
npm run build && npm run test:cli
node scripts/changelog-gen.mjs --check-subject "feat(checker): …"
```
