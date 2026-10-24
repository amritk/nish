# Fuzzing

libFuzzer targets for the parsers in `std/` that take untrusted bytes:
JSON, percent-decoding and query strings, and regular expressions. Each is
built with the repository's own compiler and std and linked under
`-fsanitize=fuzzer,address,undefined`.

| Path | What it is |
| --- | --- |
| `targets/<name>.ts` | one target: a library module exporting `fuzzOne` |
| `corpus/<name>/` | its seed inputs, replayed by `npm test` and fuzzed from |
| `regressions/<name>/` | inputs that once crashed it, replayed by `npm test` |
| `harness.c` | `LLVMFuzzerTestOneInput`, which calls `fuzzOne` |
| `../../scripts/fuzz.sh` | the one recipe: build, run, replay, smoke |

## The recipe

```sh
npm run build                          # build/nish, from this checkout
bash scripts/fuzz.sh --build regex     # build/fuzz/bin/regex
bash scripts/fuzz.sh --run regex       # fuzz until stopped or a crash
bash scripts/fuzz.sh --run regex -- -max_total_time=1800 -jobs=4
bash scripts/fuzz.sh --replay          # every corpus and regression once
bash scripts/fuzz.sh --smoke           # what CI's fuzz-smoke job runs
```

The compiler must be built from this checkout (`NISH`, default `build/nish`).
A compiler finds `std/` beside itself, so the seed would fuzz its own std.
The sanitizer runtimes come from `libclang-rt-18-dev`. The session-start hook
and CI install it.

The runtime's units are built from source with `-DNISH_FUZZ_ABORT`. Under that
flag a panic, a failed bounds or division check, and an out-of-memory call
`abort()`, so libFuzzer sees them as crashes. Every run gets `-timeout=1` and
`-rss_limit_mb=2048` ahead of the caller's arguments. An input that runs longer
than a second is a crash.

`--run` writes new inputs to `build/fuzz/work/<name>/`, a scratch directory,
and never to `corpus/`. Crash inputs land in `build/fuzz/artifacts/<name>/`.

## The target interface

```ts
export const fuzzOne = (data: u8[]): void => { ... }
```

- One target per file, named after the module it drives (`json-typed`,
  `url`, `regex`).
- `data` is a heap block of exactly the input's length. It is freed after the
  call, and the arena is reset after every input. A target never keeps `data`,
  or anything it allocated, across calls; ASan reports a target that does.
- A refusal is a return code and is not a crash: the parser's error value,
  an `isErr()`, a negative length. A crash is a `panic`, a failed check, a
  sanitizer report, a timeout or an out-of-memory.
- Check the parser against itself, not only for crashes. The existing
  targets compare two ways of answering the same question: a strict decode
  against a lenient one, `exec` against `find`, encoding a decoded value and
  decoding it again. They `panic` when the two answers disagree.
- Use the first byte for flags or a mode when the API has options. Every
  target documents its input layout in its header comment.
- Hold any limit that guards a known open finding (JSON-13's map keys, in
  `json-typed.ts`) so a long run does not spend itself rediscovering it.

## Adding a target

1. Write `targets/<name>.ts` to the interface above.
2. Put a handful of small, valid and near-valid inputs in `corpus/<name>/`,
   one file each, named for what they exercise.
3. `bash scripts/fuzz.sh --replay <name>`, then fuzz it for a few minutes
   with `--run`.
4. `node tests/run.js fuzz`: it builds and replays every target, so the new
   one is part of `npm test`, and CI's smoke and weekly jobs pick it up from
   the directory with no list to edit.

## Reading a crash

Replay the input on its own. libFuzzer prints the panic message, or the
sanitizer report, then the stack:

```sh
build/fuzz/bin/<name> build/fuzz/artifacts/<name>/crash-<sha1>
build/fuzz/bin/<name> -minimize_crash=1 -runs=10000 build/fuzz/artifacts/<name>/crash-<sha1>
```

A crash from CI is in the run's `fuzz-smoke-artifacts` or `fuzz-<name>`
artifact. Then work it the way the security records require
(`docs/security/README.md` → "Writing a record"):

1. Decide whether the target or the parser is wrong. A target that expects
   something the parser documents it does not do is fixed in the target. The
   input still goes in `regressions/` and the PR names the fix.
2. Copy the minimized input to `regressions/<name>/<what-it-is>`, and show it
   crashing the target on the commit before the fix.
3. Fix the parser, and pin the fix with a test in the suite as well as the
   regression input.
4. Record it in the area's record: `docs/security/json.md`, `url.md`,
   `regex.md` or `runtime.md`, using that page's severity scale.

## In CI

- **`fuzz-smoke`** (`.github/workflows/ci.yml`, every pull request): builds
  every target, replays its corpus and regressions, and fuzzes it for 60
  seconds from `-seed=1`. It then runs `node tests/run.js runtime_sanitize`:
  the runtime unit test under ASan and UBSan, single-threaded and with
  threads.
- **`Fuzz`** (`.github/workflows/fuzz.yml`, Saturdays and on dispatch): one
  runner per target, 30 minutes each by default. A crash fails that
  target's job. The crash inputs and the grown corpus are uploaded as
  `fuzz-<name>`. Copy any inputs worth keeping into `corpus/` by hand.
- **`npm test`** builds and replays every target in its `fuzz` section. It
  does not fuzz.

## OSS-Fuzz

The project is not on OSS-Fuzz. The layout would carry over directly: a
`build.sh` that runs `npm run build` and the link line from `scripts/fuzz.sh`
into `$OUT/<name>`, with `corpus/<name>/` zipped as
`$OUT/<name>_seed_corpus.zip`. libFuzzer's flags would come from the
platform's `$CFLAGS` instead of `SAN_FLAGS`.
