# nish in a browser worker

The compiler compiled to WebAssembly, driven from a Web Worker. `self/` is an
Nish program, so the compiler compiles it and the `wasi` profile links it
against wasi-libc; the result is a 480 KB module (about 140 KB gzipped) that
lexes, checks and emits LLVM IR with no server involved.

```bash
npm run build
build/nish self/compile.ts --link web/nish.wasm --profile wasi
```

That needs a WASI sysroot and `wasm-ld` ([../docs/INSTALL.md](../docs/INSTALL.md), the WASI section). The module
is ignored by git: it is a build artefact like `build/`.

## Running it

Without a browser, through `node:worker_threads`:

```bash
node web/compile.mjs web/nish.wasm examples/add.ts
node web/compile.mjs web/nish.wasm examples/nbody.ts --number-mode f64
node web/compile.mjs web/nish.wasm self/compile.ts | head   # the compiler, compiled by itself, in wasm
```

`compile.mjs` reads the entry and every module it imports, hands them over as
text, and prints the IR on stdout and the diagnostics on stderr — the same
streams and the same exit code `nish` itself would produce. The IR it writes
is byte-identical to what the native compiler writes for the same input; `tests/run.js`
checks that on every run where the toolchain is present.

In a browser, serve this directory with any static server that sends
`application/wasm` for `.wasm` and open `index.html`:

```bash
python3 -m http.server -d web 8000     # or any static server
```

## The pieces

| File | What it is |
| --- | --- |
| `wasi.mjs` | A WASI preview1 host over an in-memory filesystem. No imports at all, so the same file runs in a page, in a Node worker, and under `node --eval`. |
| `worker.mjs` | The compile worker: one request, one fresh instance, one reply. Bound to `self.onmessage` in a browser and to `parentPort` under Node. |
| `compile.mjs` | A Node driver for the worker — the CLI above. |
| `index.html` | A playground: source on the left, IR or diagnostics on the right. |

The worker protocol is one message in, one message out, matched by `id`:

```js
{ id, files: { "main.ts": "export const main = (): number => 0;" },
  args: ["--number-mode", "f64"], entry: "main.ts", output: "main.ll" }

{ id, status: 0, stdout: "", stderr: "wrote main.ll\n", files: { "main.ll": "; ModuleID = …" } }
```

`status` is the compiler's exit code, and `--json` in `args` turns every
diagnostic into one flat object per line, which is the surface a real editor
integration would read ([../AGENTS.md](../AGENTS.md)).

## What it cannot do

- **It stops at the IR.** `nish` emits textual LLVM IR and hands the rest to
  `clang` and `wasm-ld`, and neither exists in a page. So a playground shows
  the IR; running the compiled program in the browser needs the link step done
  somewhere else.
- **No `--link`, and no `--profile`.** They shell out through `spawnSync`,
  which WASI answers with `-1`; the compiler reports that as a toolchain
  failure and exits 3, the same as a machine with no `bash`.
- **No `--target host`.** `process.platform` and `process.arch` are `unknown`
  under WASI, so the compiler refuses to guess a triple (`self/target.ts`).
  Name a triple instead: `--target wasm32-wasi`.
- **One instance per compile.** The arena only grows and `proc_exit` ends the
  instance that ran it, so each request is instantiated fresh. The module is
  compiled once, so this costs about a millisecond; compiling all 54 modules
  of `self/` peaks around 140 MiB of linear memory, and a single-file program
  is far below that.
