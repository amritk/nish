---
name: Follow-ups collected from closed feature runs
overview: The closed /feature trackers left acceptance passes that never ran, language gaps that were documented and not filed, stages never built, stale doc lines, and decisions on partial acceptance criteria. Each is a small stage here so none is lost when its tracker closes.
priority: 70
issue: 1855
stages:
  - id: s1-accept-destructuring
    title: SWEEP S1 — run the destructuring-declarations acceptance pass on main
    goal: A session builds main and checks the 11 criteria of the destructuring-decls tracker, posting a criteria table with a verdict, and files what fails.
    verification: node tests/run.js destructuring
    status: pending
    issue: 1878
    todos:
      - id: s1-build-check
        content: Build main and check the 11 criteria of tracker 1576 (merged as 1593) against it — see SWEEP S1 — run the destructuring-declarations acceptance pass
        status: pending
      - id: s1-report
        content: Post the criteria table with a verdict on the tracker and file one issue per failed criterion — see SWEEP S1 — run the destructuring-declarations acceptance pass
        status: pending
  - id: s2-accept-wp39
    title: SWEEP S2 — run the WP39 acceptance pass on main
    goal: A session builds main and checks the 10 criteria of the wp39-complete tracker, posting a table with a verdict.
    verification: node tests/run.js http2 && node tests/run.js http3
    status: pending
    todos:
      - id: s2-build-check
        content: Build main and check the 10 criteria of tracker 1433 (WP39) against it — see SWEEP S2 — run the WP39 acceptance pass
        status: pending
      - id: s2-report
        content: Post the criteria table with a verdict and file one issue per failed criterion — see SWEEP S2 — run the WP39 acceptance pass
        status: pending
  - id: s3-accept-wp50
    title: SWEEP S3 — run the WP50 S3 storage-driven acceptance pass on main
    goal: A session builds main and checks the 11 criteria of the wp50-s3-storage-driven tracker, posting a table with a verdict.
    verification: WASI_SYSROOT=/usr node tests/run.js wasm
    status: pending
    todos:
      - id: s3-build-check
        content: Build main and check the 11 criteria of tracker 1270 (WP50 S3, 1273 merged) against it — see SWEEP S3 — run the WP50 S3 storage-driven acceptance pass
        status: pending
      - id: s3-report
        content: Post the criteria table with a verdict and file one issue per failed criterion — see SWEEP S3 — run the WP50 S3 storage-driven acceptance pass
        status: pending
  - id: s4-accept-soundness-fuzz
    title: SWEEP S4 — run the compiler-soundness-fuzzing acceptance pass on main
    goal: A session builds main and checks the 8 criteria of the security-compiler-soundness-fuzzing tracker, posting a table with a verdict.
    verification: node tests/run.js soundness
    status: pending
    todos:
      - id: s4-build-check
        content: Build main and check the 8 criteria of tracker 883 (897, 902 and 924 merged) against it — see SWEEP S4 — run the compiler-soundness-fuzzing acceptance pass
        status: pending
      - id: s4-report
        content: Post the criteria table with a verdict and file one issue per failed criterion — see SWEEP S4 — run the compiler-soundness-fuzzing acceptance pass
        status: pending
  - id: s5-spread-nl2708
    title: SWEEP S5 — object spread, NL2708 over-refuses and the spread attribute facts are coarse
    goal: NL2708 no longer refuses a spread when a later spread supplies the field, and the attribute facts for a spread are as precise as the fields they copy, each with a test.
    verification: node tests/run.js object_spread && node tests/run.js link && npm run check && npm run lint
    status: pending
    todos:
      - id: s5-nl2708
        content: Make the field-type check in the spread lowering of src/ accept a field a later spread supplies, with a golden and a negative beside tests/cases/obj_spread_override_type — see SWEEP S5 — object spread over-refusal
        status: pending
      - id: s5-attributes
        content: Tighten the attribute facts a spread produces in src/attributes.ts and pin them with a case — see SWEEP S5 — object spread over-refusal
        status: pending
  - id: s6-spread-private
    title: SWEEP S6 — object spread, a private field spreads into a target that declares it
    goal: The rule for spreading a private field into a target that declares it is decided, written in docs/LANGUAGE.md and pinned by a positive or negative test.
    verification: node tests/run.js object_spread && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s6-decide
        content: Record the owner's rule for a private field in an object spread in docs/LANGUAGE.md — see SWEEP S6 — object spread and private fields
        status: pending
      - id: s6-test
        content: Add the reject or accept case matching the rule under tests/cases — see SWEEP S6 — object spread and private fields
        status: pending
  - id: s7-spread-soak
    title: SWEEP S7 — re-run the Chrome wasm-arena soak that object-spread criterion 7 skipped
    goal: The Chrome wasm-arena soak is run on main and its result, a pass or a flake with a count, is recorded.
    verification: WASI_SYSROOT=/usr node tests/run.js wasm
    status: pending
    labels: [deferred]
    todos:
      - id: s7-soak
        content: Run the wasm-arena soak under Chrome ten times on main and record the failure count on the tracker — see SWEEP S7 — re-run the wasm-arena soak
        status: pending
  - id: s8-destructuring-notes
    title: SWEEP S8 — destructuring declarations, the using-mix message and the pattern display key collision
    goal: The diagnostic for using s = scope(), [a] = xs reads correctly, and two patterns at different offsets can no longer share a display key.
    verification: node tests/run.js link && node tests/run.js diagnostic-coverage && npm run check && npm run lint
    status: pending
    todos:
      - id: s8-message
        content: Fix the message for a using declaration mixed with a destructuring declarator in src/ and its tests/wordings entry — see SWEEP S8 — destructuring declarations notes
        status: pending
      - id: s8-key
        content: Make the pattern.<offset> display key unique where two patterns collide in src/ and add a tests/cases case — see SWEEP S8 — destructuring declarations notes
        status: pending
  - id: s9-yaml-perf
    title: SWEEP S9 — std/yaml performance tune, 2x faster than the reference parser with SIMD scans
    goal: bench/yaml-compare shows std/yaml at least 2x faster than @amritk/yaml and docs/BENCHMARKS.md has a yaml row with its commit.
    verification: node bench/yaml-compare/run.mjs && node tests/run.js yaml && npm run lint
    status: pending
    todos:
      - id: s9-baseline
        content: Take an interleaved same-machine baseline of bench/yaml-compare on a trusted run and record the noise band — see SWEEP S9 — std/yaml performance tune
        status: pending
      - id: s9-simd-scans
        content: Add SIMD scans to the std/yaml scanner and measure each cut against the band — see SWEEP S9 — std/yaml performance tune
        status: pending
      - id: s9-row
        content: Add a yaml row to docs/BENCHMARKS.md naming the commit whose bench code produced it — see SWEEP S9 — std/yaml performance tune
        status: pending
  - id: s10-server-stack-slices
    title: SWEEP S10 — check whether the Postgres and bcrypt-pool slices of server-stack-1 were built
    goal: Each of the s5-postgres and s10-bcrypt-pool slices is shown to be covered by a later run or is scheduled as its own stage.
    verification: node tests/run.js postgres && node tests/run.js bcrypt
    status: pending
    todos:
      - id: s10-check
        content: Check std/ and docs/roadmap for what tracker 1114's s5-postgres and s10-bcrypt-pool slices would have built, and record each as covered or open — see SWEEP S10 — check the server-stack-1 slices
        status: pending
      - id: s10-open
        content: Add a stage or file an issue for each slice found open — see SWEEP S10 — check the server-stack-1 slices
        status: pending
  - id: s11-server-stack-nits
    title: SWEEP S11 — server-stack-1 non-blocking follow-ups, checked against main and fixed
    goal: Each of the six follow-ups from tracker 1114 is either fixed or shown already fixed.
    verification: node scripts/gen-reference.mjs --check && node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: s11-guide-1126
        content: Check the guide text added by 1126 for an overclaim and correct it in the matching docs/guide page — see SWEEP S11 — server-stack-1 non-blocking follow-ups
        status: pending
      - id: s11-tests-1134
        content: Add the tests 1134 was missing, as named on tracker 1114 — see SWEEP S11 — server-stack-1 non-blocking follow-ups
        status: pending
      - id: s11-build-cancel
        content: Close the build-cancel gap from 1131 in the build path — see SWEEP S11 — server-stack-1 non-blocking follow-ups
        status: pending
      - id: s11-bench-readme
        content: Fix the stale bench README and the empty 413 body from 1123 — see SWEEP S11 — server-stack-1 non-blocking follow-ups
        status: pending
      - id: s11-release-yml
        content: Correct the module-count message in .github/workflows/release.yml and the Total row of docs/security/README.md — see SWEEP S11 — server-stack-1 non-blocking follow-ups
        status: pending
  - id: s12-fuzz-panic-test
    title: SWEEP S12 — test that a panicking fuzz target is reported as a crash
    goal: A test proves the fuzz harness reports a target that panics as a crash rather than a pass.
    verification: node tests/run.js fuzz && npm run lint
    status: pending
    todos:
      - id: s12-test
        content: Add a fuzz target that panics on purpose under tests/fuzz/ and a check in tests/run.js that the harness reports a crash — see SWEEP S12 — a panicking fuzz target is reported as a crash
        status: pending
  - id: s13-hardware-checks
    title: SWEEP S13 — the checks that need a person or a real GPU
    goal: The Discord and Facebook link unfurls of the og-video page and WebGPU on a real GPU are checked by hand and each result is recorded.
    verification: npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s13-unfurl
        content: Check the Discord and Facebook link unfurls for the og-video page by hand, criterion 7 of tracker 1694 — see SWEEP S13 — the checks that need a person or a real GPU
        status: pending
      - id: s13-webgpu
        content: Run the break-web WebGPU path on a real GPU and record the result, from tracker 1505 — see SWEEP S13 — the checks that need a person or a real GPU
        status: pending
  - id: s14-stale-fuzz-lines
    title: SWEEP S14 — stale fuzz lines in the http1-codec and tls security records
    goal: docs/security/http1-codec.md and docs/security/tls.md say the websocket-client and tls-server-flight targets ran their 30 minute fuzz step.
    verification: node scripts/security-scope.mjs && node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: s14-http1
        content: Replace "not yet run" for websocket-client at docs/security/http1-codec.md lines 106 to 109 with the fuzz.yml runs that succeeded — see SWEEP S14 — stale fuzz lines
        status: pending
      - id: s14-tls
        content: Replace "has had only CI's replay" for tls-server-flight at docs/security/tls.md line 212 with the runs 41088949452, 41163861432, 42333459360 and 43551037262 — see SWEEP S14 — stale fuzz lines
        status: pending
  - id: s15-wp61-62-65-lines
    title: SWEEP S15 — stale initializer lines in the WP61 and WP62 notes and the unticked WP65 S3 box
    goal: The WP61 and WP62 notes no longer say a class field initializer must be a literal, and the WP65 S3 box is ticked if its PR has merged.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: s15-wp61
        content: Correct the initializer-must-be-a-literal sentence at docs/wp61-json-typed-checks.md line 138 — see SWEEP S15 — stale initializer lines in the WP61 and WP62 notes
        status: pending
      - id: s15-wp62
        content: Correct the same sentence at docs/wp62-json-schema-classes.md line 96 and its docs/LANGUAGE.md line citation — see SWEEP S15 — stale initializer lines in the WP61 and WP62 notes
        status: pending
      - id: s15-wp65
        content: Tick the S3 box in docs/roadmap/wp65-lexer-surface.md once the class field initializer PR has merged — see SWEEP S15 — stale initializer lines in the WP61 and WP62 notes
        status: pending
  - id: s16-pki-26
    title: SWEEP S16 — pki accepts a non-critical nameConstraints as critical (PKI-26) and the two transient test failures
    goal: rfc5280 nc permitted-dns-match-noncritical is refused and its divergences.ts row removed, and the transient clang crash and performance diagnostics are reproduced or recorded as not reproducible.
    verification: node tests/run.js crypto_pki_limbo && node tests/run.js net_http3 && npm run lint
    status: pending
    issue: 1463
    todos:
      - id: s16-pki26
        content: Refuse a non-critical nameConstraints as critical in std/crypto/pki.ts and remove its row from tests/link/crypto_pki_limbo/divergences.ts — see SWEEP S16 — pki PKI-26 and the transient failures
        status: pending
      - id: s16-pki28
        content: Decide the public-suffix item PKI-28 tracked by the reopened issue 1028 and record it in docs/security/crypto-pki.md — see SWEEP S16 — pki PKI-26 and the transient failures
        status: pending
      - id: s16-transient
        content: Loop node tests/run.js net_http3 on main under load to reproduce the clang exit 135 and the performance diagnostics in tests/link/net_http3/arena.ts, and record the outcome — see SWEEP S16 — pki PKI-26 and the transient failures
        status: pending
  - id: s17-secret-pin
    title: SWEEP S17 — the secret-alias mutation pin exemption and the neutral-wording rule
    goal: The reject_secret_alias_declarator_moved exemption is kept or removed by a recorded decision, and the neutral wording process line is adopted or declined.
    verification: node tests/run.js nish:secret && npm run lint
    status: pending
    issue: 661
    labels: [needs-decision]
    todos:
      - id: s17-pin
        content: Apply the decision on the declarator_moved exemption in the pin in tests/run.js, renaming the case out of the reject_secret_alias_ set if chosen — see SWEEP S17 — the secret-alias mutation pin
        status: pending
      - id: s17-wording
        content: Adopt or decline the CLAUDE.md line proposed in the close-out comment of tracker 625 about neutral public wording before a fix merges — see SWEEP S17 — the secret-alias mutation pin
        status: pending
---

# Follow-ups collected from closed feature runs

## Context
No roadmap page. Stages SWEEP S1 to S15 come from #1821, a collection issue; it is linked from the parent issue rather than attached to any one stage, and closes once every stage it fed is closed. #1463 and #661 are the issues of S16 and S17. The item numbers below are the trackers each line came from; #1821 says none of it was re-checked against `main` beyond what the line says, so each stage begins by checking its own claim.

## SWEEP S1 — run the destructuring-declarations acceptance pass on main
From tracker #1576, 11 criteria, merged as #1593. A verification pass by a session that builds `main`, not a code change; file what fails.

## SWEEP S2 — run the WP39 acceptance pass on main
WP39 (`docs/roadmap/wp39-http-server.md`). Tracker #1433, 10 criteria. Its stale doc lines are in the DOCS plan, not here.

## SWEEP S3 — run the WP50 S3 storage-driven acceptance pass on main
WP50 (`docs/roadmap/wp50-wasm-host.md`). Tracker #1270, 11 criteria, #1273 merged.

## SWEEP S4 — run the compiler-soundness-fuzzing acceptance pass on main
Tracker #883, 8 criteria, #897, #902 and #924 merged.

## SWEEP S5 — object spread, NL2708 over-refuses and the spread attribute facts are coarse
From tracker #1349. NL2708 over-refuses when a later spread supplies the field (the rule row in `docs/LANGUAGE.md` near line 6731 says a field a later spread supplies is still checked). The spread attribute facts are coarse. Likely files: `src/`, `tests/cases/obj_spread_override_type`.

## SWEEP S6 — object spread, a private field spreads into a target that declares it
From #1349. This needs a design choice.

### Decision needed
Whether a `private` field may spread into a target that declares it. Options are to refuse it (no access leak) or to allow it where the target's class declares the field. #1821 does not recommend one.

## SWEEP S7 — re-run the Chrome wasm-arena soak that object-spread criterion 7 skipped
From #1349 criterion 7: the soak flake was never re-run. Deferred because it needs Chrome.

## SWEEP S8 — destructuring declarations, the using-mix message and the pattern display key collision
From #1576's round-8 non-blocking notes: the message for `using s = scope(), [a] = xs`, and the `pattern.<offset>` display key that can collide.

## SWEEP S9 — std/yaml performance tune, 2x faster than the reference parser with SIMD scans
From #842 criteria 6 and 7 (at least 2x faster than `@amritk/yaml`, SIMD scans). `bench/yaml-compare` exists but no yaml row is in `docs/BENCHMARKS.md`. Needs a trusted bench run; the `perf` rules apply (same-machine interleaved baseline with a noise band).

## SWEEP S10 — check whether the Postgres and bcrypt-pool slices of server-stack-1 were built
From #1114: the `s5-postgres` and `s10-bcrypt-pool` slices never started. #1821 says to check whether later runs covered them before scheduling.

## SWEEP S11 — server-stack-1 non-blocking follow-ups, checked against main and fixed
From #1114, each still to be checked against `main`: the #1126 guide overclaim, the missing #1134 tests, the #1131 build-cancel gap, the #1123 stale bench README and empty 413 body, the stale module-count message in `release.yml`, and drift in the `docs/security/README.md` Total. These are grouped because each is small.

## SWEEP S12 — test that a panicking fuzz target is reported as a crash
From #888 (security-parser-fuzzing). Likely files: `tests/fuzz/`, `tests/run.js`.

## SWEEP S13 — the checks that need a person or a real GPU
Deferred: needs a person or hardware. #1694 og-video criterion 7 (Discord and Facebook unfurls) and #1505 break-web (WebGPU on a real GPU).

## SWEEP S14 — stale fuzz lines in the http1-codec and tls security records
From the first comment on #1821. `docs/security/http1-codec.md:106-109` says the `websocket-client` target has not run under libFuzzer, and `docs/security/tls.md:212` says `tls-server-flight` has had only CI's replay. Both ran a 30-minute Fuzz step that succeeded in `fuzz.yml` runs 41088949452, 41163861432, 42333459360 and 43551037262. Check each claim ("only", "never") against the runs before editing, per `CLAUDE.md`.

## SWEEP S15 — stale initializer lines in the WP61 and WP62 notes and the unticked WP65 S3 box
From the second comment on #1821, after the class-field-initializer PR (#1829 in the comment). WP61 `docs/wp61-json-typed-checks.md:138`, WP62 `docs/wp62-json-schema-classes.md:96` (its `LANGUAGE.md:3017` citation points at unrelated text), and WP65's S3 box in `docs/roadmap/wp65-lexer-surface.md`, still unticked on main. Tick it only if the PR has merged.

## SWEEP S16 — pki accepts a non-critical nameConstraints as critical (PKI-26) and the two transient test failures
#1463 criterion 5 and the transient failures; criterion 2 (http-client list items) is carried by the DOCS plan's S2. Nine of ten limbo cases are refused; `rfc5280::nc::permitted-dns-match-noncritical` (PKI-26) is still accepted and keeps its row in `tests/link/crypto_pki_limbo/divergences.ts`. #1028 is reopened for it and PKI-28. Transient on main @ 06c04601, not reproduced since: clang exit 135 building `src/compile.ts` for `net_http3`, then `performance:` diagnostics in `tests/link/net_http3/arena.ts` and `tests/link/net_quic_conn/client.ts`. Belongs with WP34 (network stack).
Likely files: `std/crypto/pki.ts`, `docs/security/crypto-pki.md`.

## SWEEP S17 — the secret-alias mutation pin exemption and the neutral-wording rule
#661, follow-up to #642. The pin requires 38 of 39 `reject_secret_alias_*` cases to compile with the fix reverted; `reject_secret_alias_declarator_moved` is exempt because NL2445 refuses it either way. Criterion 9 asks whether to adopt the CLAUDE.md line proposed in #625's close-out comment.

### Decision needed
Keep the exemption by name, or rename the case out of the `reject_secret_alias_` set so the pin covers every case in it. Adopt or decline the proposed CLAUDE.md line. The issue recommends neither.
