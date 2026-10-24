# Security record: `nish/bytes` — byte-class runs and `copyBytes`

The record of the byte-class runs of `nish/bytes` (#862): `skipBlank`,
`skipDigits` and `skipJsonText`. Each of these lowers to a runtime kernel in
`runtime/runtime-bytes.c` with scalar, SSE2, AVX2, NEON and wasm simd128
paths. The record also covers `copyBytes`, which lowers to `llvm.memmove`. It
says what each function refuses and with what, where each bound is checked,
and the test that pins each property. It is written against `main` at
`804120e` and cites functions rather than lines.

**Result.** Given an array of at most 2^31-1 bytes, no window the attacker
chooses makes a run read outside the array or answer outside its clamped
window. No range makes `copyBytes` touch memory outside either array. An
out-of-range copy panics, and that is the program's own mistake. Overlapping
copies are correct in both directions. Every run is linear and allocates
nothing. Two Low findings are recorded, both fixed:

- BYTES-1: an array longer than 2^31-1 handed in by a host reads with a
  negative `.length`. The runs then answer outside the window and `copyBytes`
  panics falsely. Memory safety still holds. The N-API shim now refuses
  such an array, and `nish.h` states the bound for C hosts.
- BYTES-2: nothing pinned that `std/crypto` keeps out of the variable-time
  runs. A check in `tests/run.js` now does.

## Scope

| File | Functions |
| --- | --- |
| `runtime/runtime-bytes.c` | `nish_bytes_skip_blank`, `nish_bytes_skip_digits`, `nish_bytes_skip_json_text`; the helpers `nish_run_in`, `nish_run_utf8`, `nish_run_wide`, `nish_run_scalar`, `nish_run_resume`, the SSE2/AVX2/NEON/wasm block walkers, `nish_cpu_has_avx2`, `nish_run_choose` and the resolver |
| `std/bytes.ts` | `bytesRunEnd`, `bytesRunStart`, `skipBlank`, `skipDigits`, `skipJsonText`, `copyBytes`, and the walkers they lower from |
| `src/kernels.ts`, `src/emit-arrays.ts`, `src/std-modules.ts` | `bytesWalkOf`, `bytesKernelOf`, `emitBytesKernel`, `bytePointer`, `isBytesModule` |
| `src/runtime.ts`, `runtime/nish.h` | the kernel declarations and their contract |
| `src/secret.ts` | `isPureRuntime`'s admission of the three kernels |

Out of scope:
- `std/json-tokenizer.ts`, which calls the runs; its record is
  `docs/security/json.md`.
- The host interop boundary as a whole (`docs/security/codegen.md`,
  `docs/security/runtime.md`), apart from where it reaches this module
  (BYTES-1).
- The NEON path was checked by inspection and by the binfmt agreement run,
  not under a sanitizer.

## Threat model

The attacker writes the bytes and chooses `from`, `to`, `at` and `count`:
any `i32`, including negative values, `INT32_MIN` and `INT32_MAX`. A win is
any of:

- a byte read or written outside an array;
- a run answer outside `[from, to]` after the documented clamp;
- a copy that overlaps wrongly or passes its bounds;
- a panic on a valid call;
- time not linear in the window.

The program is trusted. A host that builds arrays itself is trusted to keep
the runtime's length invariant, which BYTES-1 asks to have stated and
enforced.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| BYTES-1 | Low | `src/interop-napi.ts` (`nish_napi_array_arg`), `runtime/nish.h`; seen through `std/bytes.ts` (`bytesRunEnd`, `bytesRunStart`, `copyBytes`) | The runtime caps arrays at 2^31-1, but a host can hand in a longer one: a C-ABI `nish_array` with `len` past `INT32_MAX`, or under `--emit-napi` a borrowed `Uint8Array(2**31+5)`, which the shim takes without a cap. In i32 mode `toI32(b.length)` is then negative. `skipBlank(b, 0, 10)` answers `-2147483643`. The `copyBytes` guard's `sub nsw` overflows: poison in the IR, a wrap in practice. A valid small copy then panics and exits the host process. No out-of-bounds access was shown. | **Fixed.** `nish_napi_array_arg` answers -1 for `len > INT32_MAX`, and the shim throws `TypeError: <fn>: argument N (<name>) has more than 2147483647 elements`; `nish.h` states the bound for C hosts, which the runtime cannot check ("N-API: a typed array longer than 2^31-1 is a TypeError, not an array whose length reads negative"). |
| BYTES-2 | Low | `src/secret.ts` (`isPureRuntime`) | `isPureRuntime` admits the three kernels, which are variable-time, so code inside `expose` may call them. No test pins the rule that `std/crypto` does not, though no `std/crypto` module imports `nish/bytes` today. `nish_str_index_of_any` has the same pattern. | **Fixed.** `tests/run.js` compiles every `std/crypto/*.ts` and refuses IR that names `nish_bytes_skip_*` or `nish_str_index_of_any`; `tests/link/std_bytes_runs` is its control, which must name them ("std/crypto: no module's IR calls a variable-time scan kernel (14 modules; std_bytes_runs, the control, names 6)"). |

## Properties verified

**No load passes `to`, on any path** (`simd: byte-runs native ${process.arch}: ...`
and the wasm and aarch64 labels, tests/simd/byte-runs.c). Each vector path
loads a 16- or 32-byte block only while at least that many bytes remain
before `to`, and finishes in the scalar loop. A text run that stops on a lead
byte resumes through `nish_run_wide`, which reads no further than `to`. The
audit also ran these paths under ASan+UBSan and against guard-page windows;
CI pins agreement between paths, not the sanitizer run.

**Every path answers as the scalar one does** (`simd: byte-runs native x64:
3690675 cases agree across scalar base avx2; the resolver picks every pin`).
This covers every class, every alignment and every pin of `NISH_SIMD`.

**A run answers inside its clamped window** (`link/std_bytes_runs: exits with
0 and stdout matches expected.out`). `bytesRunEnd` clamps `to` into
`[0, b.length]` and `bytesRunStart` clamps `from` into `[0, end]` before the
kernel is called. The audit tried windows with bounds at `INT32_MIN`, `-1`,
`0`, `INT32_MAX` and either side of the length, and found no mismatch. The
fixture covers only in-range windows; the extreme ones are not yet pinned.

**`copyBytes` checks the whole range before it copies**
(`link/std_bytes_copy_outside: exits with 1 and stdout matches expected.out`).
The guard refuses a negative `count`, `at` or `from`, and refuses
`at > dst.length - count` and `from > src.length - count`. With lengths of at
most 2^31-1 and `count >= 0`, neither subtraction overflows, so the copy is
inside both arrays. Overlap is a `memmove`. The fixture pins only a source
range past the end; the other edges and the overlap order were checked in the
audit and are not yet pinned.

**Only the CLI's `nish/bytes` lowers to the kernels** (none yet). `isBytesModule`
matches the module by package as well as path. A `std/bytes.ts` compiled as a
root calls its own walkers.

**No `std/crypto` module calls a variable-time run** (BYTES-2's check,
above). The rule is the ct-verification record's: secret-dependent input
never reaches a kernel that returns early.

**A host cannot hand in an array whose length reads negative** (BYTES-1's
N-API check, above). A C host is bound by `nish.h`'s contract instead.

**The freestanding wasm link adds the kernels once**
(`simd: the freestanding --profile wasm link of nish/bytes's runs compiled
${kind} adds runtime-bytes.c once, and answers as Node does`).

Tests:
`simd: byte-runs native ${process.arch}: ...` — the template
`simd: ${label}: ${said}`, with labels `byte-runs native ${process.arch}`,
`byte-runs wasm32-wasi, the scalar base path`,
`byte-runs wasm32-wasi -msimd128` and
`byte-runs aarch64 through binfmt, the NEON path`;
`link/std_bytes_runs: exits with 0 and stdout matches expected.out`,
`link/std_bytes_copy_outside: exits with 1 and stdout matches expected.out` —
each the template `link/${name}: exits with ${wantCode} and stdout matches
expected.out`;
`link/std_bytes_copy_outside: every one of 50 runs at 2 and 8 threads prints
expected.stderr once and exits 1` — the template `link/${name}: every one of
${PANIC_ONCE_RUNS} runs at 2 and 8 threads prints expected.stderr once and
exits ${wantCode}`;
`simd: the freestanding --profile wasm link of nish/bytes's runs compiled
${kind} adds runtime-bytes.c once, and answers as Node does`;
`simd: the freestanding --profile wasm link adds runtime-bytes.c to no module
that calls no run, and not again when the inputs name it`;
`N-API: a typed array longer than 2^31-1 is a TypeError, not an array whose
length reads negative` (BYTES-1);
`std/crypto: no module's IR calls a variable-time scan kernel (14 modules;
std_bytes_runs, the control, names 6)` — the template ending
`(${cryptoFiles.length} modules; std_bytes_runs, the control, names ${control.length})` (BYTES-2).

## Divergences from Node

None found in the answers: under Node, the runs and `copyBytes` are the
TypeScript walkers in `std/bytes.ts`, which the kernels match on every input
the audit tried. How Node's `toI32` reads a `Uint8Array` longer than 2^31-1
was not tested, so BYTES-1 is recorded for the native build only.
