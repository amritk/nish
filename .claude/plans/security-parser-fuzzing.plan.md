---
name: Security — coverage-guided fuzzing of the std parsers that read attacker bytes
overview: Build every std parser that reads peer bytes as a libFuzzer target under ASan and UBSan, give each a seed corpus, run the C runtime's own tests under the same sanitizers, add a fixed-seed smoke run to every PR and a scheduled long run that uploads crashes, and turn every crash found into a fixed, recorded, regression-tested finding. Test-only tooling — no `nish fuzz` command, no `src/` change.
stages:
  - id: harness-json-url-regex
    title: "test(security): libFuzzer harness, sanitizer runtime build, CI fuzz jobs, JSON/URL/regex targets"
    goal: A documented one-command recipe builds any tests/fuzz/targets/<name>.ts as a libFuzzer binary under -fsanitize=fuzzer,address,undefined where a panic is a crash; the runtime tests run under ASan+UBSan in a tests/run.js section; CI runs a bounded fixed-seed smoke over every target per PR and a scheduled long run that uploads crashes; the JSON (tokenizer, typed, dynamic), percent-decoding and regex targets exist with seed corpora, and every crash they found is fixed and recorded
    verification: bash scripts/fuzz.sh --smoke (every target, fixed seed, bounded time) exits 0; node tests/run.js fuzz and node tests/run.js runtime_sanitize pass with no skips; npm run check; npm run lint; npm test undegraded
    status: pending
    todos:
      - id: h-recipe
        content: scripts/fuzz.sh — build (`--build <name>`), run (`--run <name> [-- libFuzzer args]`), replay a corpus (`--replay`), and `--smoke` over every tests/fuzz/targets/*.ts it discovers by glob. Recipe — `nish <target>.ts -o <dir>/` (library module, no main), then clang -g -O1 -fsanitize=fuzzer,address,undefined -fno-sanitize-recover=undefined over the .ll, tests/fuzz/harness.c and the runtime units (the list tests/run.js's RUNTIME_C names), -lm. A separate script, not a scripts/build.sh profile, so it never overlaps the security-binary-hardening run's edits to build.sh
      - id: h-harness
        content: tests/fuzz/harness.c — LLVMFuzzerTestOneInput wraps (data, size) as a nish_array copy (data may be NULL at size 0), calls the target's `export const fuzzOne = (data: u8[]): void`, then nish_reset_arena(). This is the fixed target interface the other stage writes against
      - id: h-panic-is-crash
        content: Make a panic, a bounds or division failure and OOM abort() under the fuzz build so libFuzzer and ASan record them (they exit(1)/_exit(1) today). Guard it behind a macro the fuzz recipe defines (e.g. -DNISH_FUZZ_ABORT in runtime/runtime.c's nish_panic and nish_fatal_exit); the default build is byte-for-byte unchanged. A target's deliberate refusal is a return code, never a panic, so any panic on fuzz input is a finding
      - id: h-sanitizer-runtime
        content: A tests/run.js section `runtime_sanitize` that builds tests/runtime-test.c with the RUNTIME_C units under -fsanitize=address,undefined -fno-sanitize-recover=undefined (single-threaded and -DNISH_THREADS) and runs it; it skips with a named reason only when the clang_rt sanitizer libraries are missing, and CI installs them so it never skips there. Every sanitizer report it raises is a runtime finding (docs/security/runtime.md)
      - id: h-fuzz-section
        content: A tests/run.js section `fuzz` that builds every target and replays its committed corpus and crash-regression inputs (tests/fuzz/corpus/<name>/, tests/fuzz/regressions/<name>/) through the sanitizer build — the per-PR proof that fixed crashes stay fixed
      - id: h-toolchain
        content: Install libclang-rt-18-dev where LLVM is installed — .claude/hooks/session-start.sh and the CI LLVM install step — so the sanitizer runtimes exist
      - id: h-ci
        content: CI — a `fuzz-smoke` job in .github/workflows/ci.yml running scripts/fuzz.sh --smoke (fixed -seed, -max_total_time per target, total under 10 minutes) and node tests/run.js runtime_sanitize; a new scheduled .github/workflows/fuzz.yml (weekly cron plus workflow_dispatch) running each target for a longer bound and uploading crash-*/leak-*/timeout-* files and the grown corpus as artifacts, failing on a crash. Optional — a build.sh-free layout OSS-Fuzz could wrap is noted in the docs, not built
      - id: h-targets
        content: Targets with seed corpora — json-tokenizer (JsonTokenizer next() loop), json-typed (jsonDecode into two or three concrete shapes — nested arrays, optional fields, a Map<string, V>), json-value (JsonDocument.parse), url (percentDecode under every flag combination, percentDecodePathSegment, UrlQuery, UrlPathSegments), regex (input split into pattern, flags and subject; regexCompile then test/find/findAll/replaceAll)
      - id: h-campaign
        content: Run each of this stage's targets for at least 30 minutes locally; every crash, sanitizer report, timeout or OOM is a finding — fix it with a regression input in tests/fuzz/regressions/<name>/ and a test the README's rules require (shown failing on the base commit), recorded in docs/security/json.md, url.md or runtime.md, or a new docs/security/regex.md. Do not fix JSON-13, H1-1 or H2-1 (another run owns them). Do not edit docs/security/README.md — the other stage updates the index for both
      - id: h-docs
        content: .claude/testing.md — a "Fuzzing" section (the recipe, the target interface, adding a target, reading a crash, the smoke and scheduled jobs); every pointer that moves is moved
  - id: net-crypto-targets
    title: "test(security): fuzz targets for TLS, QUIC, HPACK, HTTP/1, WebSocket and X.509"
    goal: Every network and crypto parser that reads peer bytes is a libFuzzer target with a seed corpus, each fuzzed for at least 30 minutes, and every crash found is fixed with a regression test and recorded; the security index counts this run's findings across both stages
    verification: every target under tests/fuzz/targets/ that this stage adds builds and replays its corpus and regressions clean under the sanitizer recipe (bash scripts/fuzz.sh --smoke once the harness stage has merged); npm run check; npm run lint; npm test undegraded
    status: pending
    todos:
      - id: n-tls
        content: Targets tls-client-hello (tlsParseClientHello and tlsReadClientHello, plus the other tlsRead* readers in std/net/tls/codec.ts) and tls-record (TlsRecordReader push/next/consume over arbitrary chunking; tlsRecordLength; TlsRecordProtection.open under a fixed installed key). Seed corpus from the ClientHellos and records the existing tests already use
      - id: n-quic
        content: Targets quic-header (quicParseHeaderInto across short CID lengths, quicPacketNumberDecode) and quic-frame (quicParseFrame looped over a payload). Seeds from RFC 9000/9001 test vectors already in the tests
      - id: n-hpack
        content: Target hpack (HpackDecoder.decode over a sequence of blocks split from the input, so the dynamic table is exercised; hpackHuffmanDecode directly). Seeds from RFC 7541 Appendix C
      - id: n-http1-ws
        content: Targets http1 (Http1Parser feed/next over arbitrary chunking, small and default limits) and websocket (WsDecoder with expectMasked true and false). Seeds — request heads, chunked bodies, masked and unmasked frames, fragmented messages, close frames
      - id: n-x509
        content: Targets x509-der (x509ParseCertificate, x509DerSignatureRS) and x509-pem (pemToDer, x509ParseChain, x509ParseP256PrivateKey from the input as text). Seeds — the certificates and keys the tests already carry
      - id: n-campaign
        content: Run each target at least 30 minutes; every crash, sanitizer report, timeout or OOM is a finding — fix it in std/net or std/crypto per docs/security/README.md (and the Secret/wipe rules in CLAUDE.md for std/crypto), with a regression input in tests/fuzz/regressions/<name>/ and a tests/link/ or tests/run.js check shown failing on the base commit, recorded in tls.md, quic.md, http1.md, http2.md or crypto-x509.md. Do not fix JSON-13, H1-1 or H2-1
      - id: n-index
        content: After merging main with the harness stage in it, update docs/security/README.md — the counts and notes for every record either stage changed, a row for regex.md if it was added, and a line saying which records are now fuzzed by which target
---

# Security — parser fuzzing

## Decision: test-only tooling, not `nish fuzz`

The harness is `scripts/fuzz.sh` plus `tests/fuzz/`, not a CLI command. A
`nish fuzz` command would be a `src/` change under the rolling freeze, a new
CLI contract (flags, exit codes, `--json` codes), a guide page and a cookbook
entry, for a workflow only the std's maintainers run. The emitter needs no
change: a target is a library module (`nish x.ts -o dir/`, no `main`) whose
`fuzzOne` export is a plain C symbol; the C harness supplies libFuzzer's entry
point. Nothing a Nish user sees changes, so no guide page moves.

## The target interface (fixed — both stages write against it)

```ts
// tests/fuzz/targets/<name>.ts
import { … } from "nish/…";
export const fuzzOne = (data: u8[]): void => { … };
```

- One target per file; each builds to its own binary (exports share one flat C
  namespace).
- The target never retains `data` or any arena object across calls; the
  harness resets the arena after every input.
- A parser's refusal is a return code and is fine; a panic, sanitizer report,
  timeout (> 1 s per input default) or OOM is a crash.
- Seed corpus: `tests/fuzz/corpus/<name>/`; a fixed crash's minimised input:
  `tests/fuzz/regressions/<name>/`, replayed by `node tests/run.js fuzz`.

Until the harness stage merges, the net-crypto stage builds its targets with
the recipe by hand (the clang line in `h-recipe`, a local copy of the harness
outside the repo); it does not edit `scripts/fuzz.sh`, `tests/fuzz/harness.c`
or `tests/run.js`'s fuzz sections.

## Stage harness-json-url-regex

**Owns:** `scripts/fuzz.sh`, `tests/fuzz/harness.c`, `tests/fuzz/README.md`,
`tests/fuzz/targets/{json-*,url*,regex*}.ts`,
`tests/fuzz/{corpus,regressions}/{json-*,url*,regex*}/**`, `runtime/*.c`,
`runtime/nish.h`, `tests/runtime-test.c`, `tests/run.js`, `tests/shard-costs.json`,
`.github/workflows/ci.yml`, `.github/workflows/fuzz.yml`,
`.claude/hooks/session-start.sh`, `.claude/testing.md`, `std/json*.ts`,
`std/net/url.ts`, `std/regex.ts`, `docs/security/{json,url,runtime,regex}.md`,
`tests/link/fuzz_{json,url,regex,runtime}_*/**`,
`tests/self/goldens/checked/**` (generated), `tests/differential/goldens*` (generated)

## Stage net-crypto-targets

**Owns:** `tests/fuzz/targets/{tls-*,quic-*,hpack*,http1*,websocket*,x509-*}.ts`,
`tests/fuzz/{corpus,regressions}/{tls-*,quic-*,hpack*,http1*,websocket*,x509-*}/**`,
`std/net/tls/**`, `std/net/tls*.ts`, `std/net/quic*.ts`, `std/net/hpack.ts`,
`std/net/http1*.ts`, `std/net/http2*.ts`, `std/net/websocket.ts`,
`std/crypto/x509.ts`, `docs/security/{tls,quic,http1,http2,crypto-x509,README}.md`,
`tests/link/fuzz_{tls,quic,hpack,http1,ws,x509}_*/**`,
`tests/self/goldens/checked/**` (generated), `tests/differential/goldens*` (generated)

**Depends on (merge order):** harness-json-url-regex. Development starts at once
against the fixed interface above; its smoke verification and the README index
need the harness merged first.

Both stages own the generated goldens; a conflict there is regenerated
(`npm run sync-main`), never merged by hand.

## Acceptance criteria

1. On a fresh checkout with `libclang-rt-18-dev`, `bash scripts/fuzz.sh --build <name>` produces a libFuzzer binary for each of the 14 targets (json-tokenizer, json-typed, json-value, url, regex, tls-client-hello, tls-record, quic-header, quic-frame, hpack, http1, websocket, x509-der, x509-pem — plus any split the workers add), linked with `-fsanitize=fuzzer,address,undefined`, and running it for 10 s exits 0 on a clean parser.
2. A deliberate panic in a target (a test-only target or input) is reported by libFuzzer as a crash with a saved crash file, not a silent exit(1).
3. `node tests/run.js runtime_sanitize` builds the runtime and `tests/runtime-test.c` under ASan+UBSan and passes; it does not skip in CI.
4. `node tests/run.js fuzz` replays every committed corpus and regression input clean.
5. A PR's CI has a fuzz smoke job with a fixed seed and a bounded time, and it is green on the merged PRs.
6. `.github/workflows/fuzz.yml` runs on a schedule and on dispatch and uploads crash files as artifacts.
7. Every crash the campaigns found has a fix, a regression input, a test shown failing on the base, and a row in its security record; `docs/security/README.md` counts them. "None found" is stated per target in the records when true.
8. `.claude/testing.md` documents the recipe, the target interface and how to add a target; no `src/` file changed.
