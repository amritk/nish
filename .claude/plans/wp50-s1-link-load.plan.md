---
name: WP50 stage 1 — link and load a wasm module a page drives
overview: Build stage 1 of docs/wp50-wasm-host.md §14 (W6, W8) — a new `scripts/build.sh --profile wasm-host` (explicit exports, fixed memory and stack, `wasm-opt` when present, `--inline`), a loader with `load(source, imports)` and `loadSync`, the `nish/vite` plugin for a module's exports, a Vite-readiness test of the loader text, and a `wasm-size` guard at today's figures. `--profile wasm` stays byte for byte as it is (Q5). One stage, one PR, as §14 says each stage is.
stages:
  - id: link-load
    title: "feat(interop): link a wasm module for a page and load it without fetch (WP50 stage 1)"
    goal: "A Nish module links under `--profile wasm-host` with only the exports the page and loader use, in a fixed memory, optionally inlined as an ES module; its loader instantiates it with `load(source, imports)` or `loadSync(source, imports)`; a Vite page imports the module's exports as TypeScript through `nish/vite`; and a `wasm-size` guard fails when a figure grows. `--profile wasm` output is unchanged."
    verification: "npm run check && npm run lint && node tests/run.js wasm && node tests/run.js emit-dts && node tests/run.js interop && node tests/run.js vite && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/self/goldens.js (no diff after --update) && node scripts/security-scope.mjs"
    status: pending
    todos:
      - id: profile
        content: "Add `--profile wasm-host` to scripts/build.sh beside `wasm`, sharing its input handling (region refusal, the kernel-unit and runtime-wasm.c additions). Link with an explicit export list instead of `--export-all` — the program's exported functions, `memory`, and when runtime-wasm.c is linked the runtime entry points the generated loader calls (nish_arena_mark, nish_arena_release, nish_alloc_array, nish_reset_arena, nish_free_arena) and nothing else — keeping `--gc-sections` and `--strip-all`. The `wasm` branch, its flags and its output must not change by one byte (Q5)"
        status: pending
      - id: memory-stack
        content: "Add `--memory <size>` (initial = maximum, so the memory never grows and the page's views are made once) and a fixed `-z stack-size` to `wasm-host`; refuse `--memory` on every other profile with exit 2, as `--cpu` is refused; state the default when `--memory` is absent in the usage header"
        status: pending
      - id: wasm-opt
        content: "Under `wasm-host`, run `wasm-opt -Oz` when it is on PATH and say in the build line whether it ran; with no wasm-opt the build succeeds as before. Nothing installs wasm-opt"
        status: pending
      - id: inline
        content: "Add `--inline <file.mjs>` to `wasm-host`: write the linked module's bytes as `export const bytes = new Uint8Array([...])` (the decimal array literal, Q10), byte-identical to the .wasm; refuse it on other profiles with exit 2"
        status: pending
      - id: loader
        content: "In src/interop-wasm.ts, make the generated loader export `load(source, imports)` taking a BufferSource or a compiled WebAssembly.Module, and `loadSync(source, imports)` using `new WebAssembly.Module` / `new WebAssembly.Instance`, both sharing one body that builds the export object; `imports` defaults to `{}` so every existing `load(bytes)` caller (web/, examples/, docs) keeps working. Document the 8 MB Chromium main-thread limit on loadSync in the loader's comment (§8). Point the header comment's build line at `--profile wasm-host`"
        status: pending
      - id: vite-ready
        content: "Add a test that reads the generated loader text for a scalar and a runtime-using module and fails on any Node import (any `import` at all), `import.meta.url`, `new URL(` or a top-level `await` (§8)"
        status: pending
      - id: vite-plugin
        content: "Ship `nish/vite`: a plugin module in the npm package (an explicit `./vite` export in package.json ahead of the `./*` std wildcard, with its `.d.ts`, and in `files`). It takes entries from the root package.json's `nish` field or `nish({ entries })`; in a build it compiles each entry with `--emit-dts`, links it with `--profile wasm-host --inline`, and resolves an import of the entry from the page to one generated module that instantiates with `loadSync` and re-exports the loader's typed exports, so the page needs no `await`, no `load` call and no import object. Host modules and `./client.nish` (memory and layout) are stages 2 and 3; leave a clear seam, implement neither. Test it in tests/run.js by driving the plugin's hooks directly (no Vite dependency added to package.json)"
        status: pending
      - id: size-guard
        content: "Add a `wasm-size` block to tests/run.js that builds the hello world (examples/add.ts) and examples/arrays.ts under `--profile wasm-host`, reports raw, gzip -9 and brotli (Node zlib) sizes of the .wasm, the loader and the inlined module, and fails above a per-row ceiling set at the figures measured now, in the style of tests/runtime-budgets.js. State the measured figures and the change against `--profile wasm` (§10 expects about -214 B on add, -736 B on arrays, raw) in the commit's `Measured:` trailer"
        status: pending
      - id: goldens
        content: "Regenerate tests/self/goldens/checked/ with `node tests/self/goldens.js --update` (src/interop-wasm.ts changes) and read the diff; never edit it by hand"
        status: pending
      - id: docs
        content: "Update docs/guide/using-nish/interop.md (a browser section: wasm-host, --memory, --inline, load/loadSync, the Vite plugin, wasm-opt as optional), docs/LANGUAGE.md where it names the wasm profile or the loader, docs/INSTALL.md for optional wasm-opt, and docs/wp50-wasm-host.md's status line (stage 1 built). Grep docs/, .claude/, llms.txt and docs/AI.md for `load(bytes)` and `--export-all` and move every pointer the change makes stale"
        status: pending
---

# WP50 stage 1 — link and load a wasm module a page drives

Design source: `docs/wp50-wasm-host.md` §2, §8 (W6), §10 "Size" (W8), §12,
§13 Q5 and Q10, and §14 row 1. The note is accepted; this plan builds row 1 and
nothing from rows 2–6. Where the note and `docs/LANGUAGE.md` disagree,
LANGUAGE.md wins.

## Link and load (the one stage)

**Owns:** `scripts/build.sh`, `scripts/size-report.sh`, `src/interop-wasm.ts`,
`runtime/vite.mjs`, `runtime/vite.d.ts`, `package.json`, `knip.json`,
`tests/run.js`, `tests/runtime-budgets.js`, `tests/wasm/**`,
`tests/self/goldens/checked/**`, `examples/arrays.ts`, `docs/guide/using-nish/interop.md`,
`docs/LANGUAGE.md`, `docs/INSTALL.md`, `docs/wp50-wasm-host.md`, `docs/AI.md`,
`llms.txt`

New files this stage creates: `runtime/vite.mjs`, `runtime/vite.d.ts`, and
anything under `tests/wasm/`. If the plugin is better placed elsewhere in the
package, the worker may say so in the PR body, but it stays inside these
globs.

### Why one PR

§14 makes each stage one PR, and the pieces form a chain: the plugin needs both
`--profile wasm-host --inline` and `loadSync` to do anything, so a separate
plugin PR would idle until the other two merged. Together they are one review.

### What the pieces are

| Piece | Where | Notes |
| --- | --- | --- |
| `--profile wasm-host` | `scripts/build.sh` | Explicit exports; `--gc-sections` already applies. How the export list is found (the IR's non-internal `define`s, or the `.d.ts`) is the worker's call; it must not depend on `--export-all`. |
| `--memory`, stack | `scripts/build.sh` | initial = max, never grown in the mode cs uses (§2) |
| `wasm-opt -Oz` | `scripts/build.sh` | only when on PATH; the build line says whether it ran |
| `--inline <file.mjs>` | `scripts/build.sh` | `export const bytes = new Uint8Array([...])` (Q10) |
| `load(source, imports)`, `loadSync` | `src/interop-wasm.ts` | `imports` passed straight to instantiation; stage 2 fills it |
| Vite-readiness test | `tests/run.js` or `tests/wasm/` | no import, no `import.meta.url`, no `new URL(`, no top-level `await` |
| `nish/vite` | `runtime/vite.mjs`, `package.json` | exports only; host modules (stage 2) and `.nish` layout (stage 3) are seams |
| `wasm-size` guard | `tests/run.js` | ceilings at today's figures; brotli from Node's `zlib` |

### Constraints that come from the repository

- **`--profile wasm` is byte-identical** before and after (Q5). A test or the
  PR body shows it for `examples/add.ts` and `examples/arrays.ts`.
- **A `src/` change** runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`,
  reading its skip line) and `node tests/run.js performance`, and regenerates
  `tests/self/goldens/checked/`. The rolling freeze applies: `src/` uses no new
  construct.
- **The user guide moves with the change** (CLAUDE.md): a new profile and new
  `build.sh` flags are user-visible.
- **No line-coverage tool exists** in this repository. The coverage gate is the
  repository's own: every new refusal (`--memory` / `--inline` on another
  profile) has a test, and `tests/diagnostic-coverage.js --require-coverage`
  (inside `npm test`, so inside CI's shards) stays green.
- **CI is the full-suite gate**: all eight `test (…, shard N/8)` rows green on
  the head, each shard's skip count read.

### Out of scope

Host imports, `HostHandle`, the `Imports` type (stage 2); module storage,
`Layout`, views, the panic import (stage 3); strings (stage 4);
`--deterministic` (stage 5); `examples/wasm-arena/` and the Chromium job
(stage 6). Do not change `--profile wasm`'s export list (Q5 defers it).
