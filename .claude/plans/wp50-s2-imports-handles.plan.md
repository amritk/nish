---
name: WP50 stage 2 — imports from the page's TypeScript, and host handles
overview: Build stage 2 of docs/wp50-wasm-host.md §14 (W1, W4). A Nish module imports the functions the page supplies from the page's own TypeScript (a host module named by `--host` or `"nish": { "host": [...] }`). Each one becomes a wasm import from module `host`. A host object crosses as a nominal `HostHandle<"kind">` lowered to `i32`. The `.d.ts` types what the page owes (`Imports`). The loader passes the host module through, with one adapter closure where a value needs converting. `--emit-ts` keeps the import. Anything that would copy or allocate in secret is refused with the explicit form named, and `nish/vite` wires host modules in. A program with no host module is byte-identical. One stage, one PR, as §14 says each stage is.
stages:
  - id: imports-handles
    title: "feat(interop): import a wasm module's host functions from the page's TypeScript (WP50 stage 2)"
    goal: "A Nish module built for freestanding wasm imports functions from a host module (the page's own TypeScript, named by `--host` or package.json). The compiler reads only the module's exported signatures and `HostHandle` aliases and skips the bodies. Each function is a wasm import `host.<name>` that the generated loader satisfies from the host module, with adapters only where needed. `HostHandle<K>` is a nominal i32 both checkers enforce. `--emit-dts` exports `Imports`. `--emit-ts` keeps the import. Every refusal in §3's table has a code, a remedy and a test. `nish/vite` passes host modules. A program with no host module compiles byte-identically."
    verification: "npm run check && npm run lint && node tests/run.js host-import && node tests/run.js wasm && node tests/run.js emit-dts && node tests/run.js emit-ts && node tests/run.js interop && node tests/run.js vite && node tests/run.js capabilit && node tests/run.js ffi && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js (no diff after --update) && node tests/diagnostic-coverage.js --require-coverage && node scripts/gen-diagnostic-codes.mjs --check && node scripts/security-scope.mjs"
    status: pending
    todos:
      - id: host-units
        content: "Host modules (§3). Name them with `--host <file>` (repeatable; src/compile.ts beside `--emit-dts`, src/options.ts, the `--help` text in src/cli-style.ts) and with a `host` key in the root package.json's `nish` field (src/manifest.ts `NishManifest` and its key loop, src/compilation.ts `readRootNish`, and NL3036's text in src/codes.ts and compilation.ts, which lists the accepted keys). In `Compilation`'s import resolution, an import whose resolved file is a host module becomes a host unit: lexed and parsed for its exports only, never checked as Nish and never emitted. An import from any other file stays an ordinary Nish import"
        status: pending
      - id: skip-bodies
        content: "Read a host module's signatures and skip each `export function` body unparsed, as a balanced run of tokens, so the body may use the DOM, closures, promises, classes and anything else TypeScript has. Non-exported top-level code (consts, classes, imports of other page modules) is skipped the same way. If the lexer cannot read a token in a skipped region (a regex literal is the known case, since a balanced skipper has no parser context for `/`), refuse the file with a new diagnostic whose message says to move that code into a module the host file imports. Before relying on the lexer, check it against the TypeScript in Vite's `create-vite` templates (vanilla-ts, react-ts, vue-ts script blocks, etc.; get them with `npm pack create-vite`, which is not a dependency) and record the result in the PR body: which files lex, which do not, and why"
        status: pending
      - id: signatures
        content: "Check each host signature against §3's table. Accept `i32`, `u8`, `u16`, `u32`, `f32`, `f64`, `boolean`, a ranged integer, an enum and a `HostHandle` in both directions. Accept `i64`/`u64` as `bigint`. `number` means the program's number mode. Refuse each of these with its own diagnostic and §3's remedy text: a `string` result; an object, class, array of objects, function, `Promise`, `unknown` or `any` in a parameter or result. A typed-array parameter (`Float32Array`, `Uint8Array`, ... read as `f32[]`, `u8[]` there only) and a `string` parameter are stage 3 (buffer windows) and stage 4 (strings). Until then they are refused with a diagnostic that says which stage adds them. Never accept one silently or crash on it. Codes take the next free number in their band (`node scripts/gen-diagnostic-codes.mjs`); no number is moved or reused"
        status: pending
      - id: build-modes
        content: "Where each form is allowed (decided at sign-off): a host module is accepted only in a freestanding wasm build (`--target wasm32-*` other than WASI, or `--emit-dts`; see `isFreestandingWasmBuild` / `buildsWasmModule` in src/visibility.ts) and refused in a native or `--profile wasi` build, because there is no page there. `declare function` is refused in a freestanding wasm build with a message that names the host-module form. It stays legal in native and WASI builds, since a C library on wasm stays a `--profile wasi` program (§3). Any existing test that links a `declare function` under freestanding `--profile wasm` changes to the new refusal, and the PR body lists each. Withdraw LANGUAGE.md's untested sentence that the freestanding `--profile wasm` link resolves a declaration against the C it is given"
        status: pending
      - id: emit
        content: "Emit each imported host function as a declaration carrying `\"wasm-import-module\"=\"host\" \"wasm-import-name\"=\"<name>\"` in an attribute group (src/emit.ts beside `foreignDeclarationFor`), with no other attribute on the declaration. Its callers are pessimised exactly as for a C declaration (src/attributes.ts, the `sig.foreign()` branch: they lose `readnone` and `willreturn`). Confirm with `build.sh --profile wasm-host` that wasm-ld turns each into `{module:\"host\",name,kind:\"function\"}` with no `--allow-undefined`. Show the exact IR in the PR body for each test snippet the PR adds"
        status: pending
      - id: capability
        content: "A call to a host import carries the `ffi` capability (Q2): `--deny ffi` refuses it, `--emit-capabilities` names the import, and a program that calls one is not `deterministic` (src/capabilities.ts, src/capability-report.ts)"
        status: pending
      - id: host-handle
        content: "`HostHandle<K>` (§4): a builtin type taking one string-literal type argument, nominal per `K`, lowered to `i32` (src/types.ts / the checker's type-reference resolution, alongside how `CPtr` is a builtin name). Allowed: `===` and `!==` against the same kind and against the literal `0`; storage anywhere a scalar goes; parameter and result of a host import and of a Nish function. Refused, each with a test: a different kind, arithmetic, conversion to or from a number (an `as` cast included), and a non-literal or missing type argument. A handle is made only by an import that returns one. A host module's exported `type X = HostHandle<\"k\">` alias is importable by the Nish module (`import { type GpuBuffer } from \"./host.ts\"`). Declare it in runtime/nish.d.ts as `type HostHandle<K extends string> = number & { readonly [hostKind]: K }` over a `unique symbol`, so tsc refuses the same mixed call (a test runs tsc over that call and expects it to fail). Its TS reading is that branded number"
        status: pending
      - id: nish-types
        content: "Make `import type { f64, i32, u32, ... } from \"nish\"` resolve for a page's tsc: the npm package exports the declarations `runtime/nish.d.ts` already has, through a root `\".\"` types entry in package.json (no dependency is added). The Nish compiler treats `\"nish\"` in a host module's `import type` as its own builtin names. Test it with tsc over a sample host module"
        status: pending
      - id: dts-loader
        content: "src/interop-dts.ts: when the program imports a host module, the `.d.ts` gains `Imports = { host: typeof import(\"<host module, relative to the .d.ts>\") }`. A test runs tsc against a host module missing an export the Nish module calls and expects it to fail. Mark a function whose host signature has `i64`/`u64` as \"allocates per call\". src/interop-wasm.ts: the generated loader takes the host module (`import * as host`, or as the `imports` object's `host` key; the loader still imports nothing itself, so stage 1's Vite-readiness test stays green). It passes each function straight through when every parameter and the result are `i32`, `f32` or `f64`. A function that needs adapting (unsigned or `boolean` parameter or result, `bigint`) gets one closure, built once at `load`/`loadSync`, that allocates nothing when called. A test reads the generated loader text and checks it passes a pure-i32/f64 import through by reference, with no wrapper. A Node round trip instantiates a module that calls host imports of every crossing kind (signed, unsigned, boolean, f32, f64, bigint, handle) and checks the values both ways"
        status: pending
      - id: emit-ts
        content: "`--emit-ts` keeps an import from a host module as written (rebasing the specifier to the output location if needed) instead of refusing it, and NL4010 still refuses a `declare function`. A test runs the TS reading under Node against a real host module and checks it calls the very function the wasm import table names. Regenerate tests/differential/emit-ts-known.txt only under the Node that .github/workflows/ci.yml pins, or leave it untouched if no verdict changes"
        status: pending
      - id: vite
        content: "runtime/vite.mjs (the `importsFor` seam stage 1 left): the generated entry module imports each host module the entry imports and passes it as `host` to `loadSync`, so the page passes nothing. Test it by driving the plugin's hooks directly, as stage 1's test does; package.json gains no Vite dependency"
        status: pending
      - id: zero-cost
        content: "Pin §12's zero cost: a program with no host module emits no import and no attribute. Every existing golden and `.ll` stays byte-identical (except goldens of the src/ modules this stage edits, regenerated). The stage-1 `wasm-size` rows for examples/add.ts and examples/arrays.ts are unchanged. Report the size of one host import (§14 expects about 20 B per imported function) in the commit's `Measured:` trailer"
        status: pending
      - id: goldens
        content: "Regenerate tests/self/goldens/checked/ with `node tests/self/goldens.js --update` and read the diff. Register each new positive tests/cases/* with `node tests/differential/goldens.js --update` in the same commit. Write new `.ll` goldens with `UPDATE_GOLDENS=1 node tests/run.js <case>`. Never edit a generated file by hand"
        status: pending
      - id: docs
        content: "docs/LANGUAGE.md: the host-module rule, the crossing table and its refusals, `HostHandle`, the `declare function` change in freestanding wasm, and the capability. docs/IR_COOKBOOK.md: the import-attribute declaration. docs/guide/using-nish/interop.md: the browser section gains host modules, `--host`, the package.json key, handles, `Imports`, the loader's host argument and the Vite plugin's host modules. docs/guide/using-nish/cli.md (or wherever the guide lists flags): `--host`. docs/ARCHITECTURE.md: any new src/ file in its table. docs/wp50-wasm-host.md: status line (stage 2 built). Grep docs/, .claude/, llms.txt, docs/AI.md and source comments for NL4010's wording, `declare function` on wasm, and `importsFor` / `imports = {}`, and move every pointer the change makes stale"
        status: pending
---

# WP50 stage 2 — imports from the page's TypeScript, and host handles

Design source: `docs/wp50-wasm-host.md` §3 (W1), §4 (W4), §12, §13 Q1 (as
revised), Q2 and Q6, and §14 row 2. The note is accepted; this plan builds row 2
and nothing from rows 3–6. Where the note and `docs/LANGUAGE.md` disagree,
LANGUAGE.md wins. Stage 1 (`12af3794`, #1243) gave the loader
`load(source, imports)` / `loadSync` and left the `importsFor` seam in
`runtime/vite.mjs`; this stage fills both.

## Imports and handles (the one stage)

**Owns:** `src/**`, `runtime/nish.d.ts`, `runtime/vite.mjs`, `runtime/vite.d.ts`,
`package.json`, `knip.json`, `tests/**`, `examples/**` (a new host example only),
`docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/ARCHITECTURE.md`,
`docs/guide/**`, `scalar.config.json`, `docs/wp50-wasm-host.md`, `docs/AI.md`,
`llms.txt`

New files this stage may create: a `src/host-*.ts` unit for reading host
modules if that is cleaner than growing `src/compilation.ts`, test fixtures
under `tests/**`, and a host-module example. Nothing outside these globs.

### Why one PR

§14 makes each stage one PR, and the pieces form a chain. `HostHandle` is only
made by a host import that returns one. `Imports`, the loader's adapters, the
TS reading and the Vite plugin all consume the host unit. A separate handle PR
would idle until the import PR merged. The diff is large (likely 1,500–2,500
lines with tests), so review runs in several shards, but it is one review of
one mechanism.

### What the pieces are

| Piece | Where | Notes |
| --- | --- | --- |
| `--host`, `nish.host` | `src/compile.ts`, `src/options.ts`, `src/cli-style.ts`, `src/manifest.ts`, `src/compilation.ts` | NL3036's accepted-keys text moves with it |
| Host unit, body skipping | `src/compilation.ts` / new `src/host-*.ts`, `src/lexer.ts` if needed | lexed for exports only; never checked as Nish; never emitted |
| Signature rules, refusals | the checker | §3's table; strings and typed arrays are refused until stages 4 and 3 |
| Build-mode rules | `src/visibility.ts` callers | host module: freestanding wasm only; `declare function`: refused there only |
| Import attributes | `src/emit.ts`, `src/attributes.ts` | `"wasm-import-module"="host"`; callers pessimised as for C |
| `ffi` | `src/capabilities.ts`, `src/capability-report.ts` | Q2 |
| `HostHandle<K>` | `src/types.ts`, checker, `runtime/nish.d.ts` | nominal i32; Q6: values only, no handle class |
| `import type … from "nish"` | `package.json` `"."` types entry | lets the page's tsc read the same names |
| `Imports`, adapters | `src/interop-dts.ts`, `src/interop-wasm.ts` | straight pass-through for i32/f32/f64 |
| TS reading | `src/emit-ts-*.ts` | keeps the import line; NL4010 stays for `declare function` |
| Vite | `runtime/vite.mjs` | fills `importsFor` |

### Decisions taken at sign-off (not spelled out in the note)

- **WASI keeps `declare function`.** §3 says `declare function` is refused "in
  a wasm build", and also that "a C library on wasm stays a `--profile wasi`
  program". `isWasmBuild` covers WASI. So the refusal applies to freestanding
  wasm (and `--emit-dts`) only, and host modules are refused under WASI as in
  a native build.
- **String parameters and typed-array parameters** in a host signature are
  refused in this stage, with a message naming the stage that adds them
  (strings: stage 4; buffer windows: stage 3). This keeps every host signature
  either working or refused, never half-supported.

### Constraints that come from the repository

- **A `src/` change** runs `WASI_SYSROOT=/usr node tests/run.js wasi`
  (reading its skip line) and `node tests/run.js performance`, and
  regenerates `tests/self/goldens/checked/`. The rolling freeze applies: `src/`
  itself uses neither a host module nor `HostHandle`.
- **An untyped emit-ts walk knows nothing** (CLAUDE.md): in `src/emit-ts-*.ts`
  read types only through `walk.typeAt`, and treat a null binding table under
  `walk.untyped` as unknown.
- **A new construct ships with** a golden `.ll`, an `llvm-as` pass, a wasm
  round trip with expected output, a negative test per refusal, its
  LANGUAGE.md rule, cookbook entry and guide page
  (`docs/ARCHITECTURE.md` → "How to add a construct"). Native round trips
  apply to `HostHandle` in a Nish function that does not touch a host module.
- **No line-coverage tool exists** in this repository. The coverage gate is the
  repository's own: every new refusal has a test, and
  `tests/diagnostic-coverage.js --require-coverage` stays green (it runs inside
  `npm test`, so inside CI's shards).
- **Security record**: §14 places the `docs/security/` record for the loader's
  import adapters with stage 3, together with the `nish.panic` import.
  `node scripts/security-scope.mjs` must still pass. If it refuses a file this
  stage adds, the record comes with this stage.
- **Test names**: the new checks go in a `tests/run.js` section whose
  check names contain `host-import`, so `node tests/run.js host-import` runs
  them alone (the bare filter `host` also matches `localhost` checks).
- **CI is the full-suite gate**: all eight `test (…, shard N/8)` rows green on
  the head, each shard's skip count read.

### Out of scope

Module storage, `Layout`, the views, buffer windows `(view, at, n)` for
imports, the re-entry flag, the `nish.panic` import and site numbers (stage 3).
`nish/host/text` and string crossings (stage 4). `--deterministic` (stage 5).
`examples/wasm-arena/` and the Chromium job (stage 6). The handle-class form
over a `HostHandle` field (Q6). The `nish/page` `HostTable` helper is §11's
stage-3/6 work; a test may write its own small table. #1257's defects (the
`wasm-size` guard under `wasm-opt`, the plugin's default compiler, extensionless
imports) are not this stage's.
