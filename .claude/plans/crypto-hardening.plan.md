---
name: Crypto hardening — constant time, wiping, and the open audit follow-ups
overview: std/crypto is constant-time by discipline plus fixture disassembly and a weekly timing run. What is open is making that checkable on the real code (types, Valgrind, DIT, full-path fixtures), one unexplained Ice Lake timing reading, and the audit follow-ups on bcrypt, x509, SHA-256, vector specs and base64.
spec: docs/security/ct-verification.md
priority: 70
stages:
  - id: s1-secret-ct-type
    title: CRYPTO S1 — design Secret constant time by type, refusing branches, indexes and comparisons inside expose
    goal: A design note settles what a checker rule inside expose refuses and allows, how declassification and LLVM are handled, and the owner has accepted or declined building it.
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    issue: 833
    labels: [needs-decision]
    todos:
      - id: s1-design
        content: Write the design note for refusing secret-dependent if, ternary, loop conditions, short-circuits, indexes and early exits inside expose, with the masked forms and a declassification point — see CRYPTO S1 — design Secret constant time by type
        status: pending
      - id: s1-coverage
        content: List every way into the rule (calls, new, closures, this out of a constructor, every declarator) each with its own negative case, per the checker rule in CLAUDE.md — see CRYPTO S1 — design Secret constant time by type
        status: pending
      - id: s1-llvm
        content: State how the rule interacts with LLVM, keeping the ctSelect and ctEq barriers and tests/ct-asm.js as the backstop — see CRYPTO S1 — design Secret constant time by type
        status: pending
  - id: s2-secret-ct-checker
    title: CRYPTO S2 — build the constant-time Secret rule and port std/crypto onto it
    goal: The compiler refuses secret-dependent branches, indexes and comparisons inside expose, with a negative per route in, and std/crypto compiles under the rule.
    verification: node tests/run.js link && node tests/run.js secret && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s2-rule
        content: Add the rule to the checker in src/ beside the Secret checks, with a new diagnostic code and a tests/link negative with expected.err per route — see CRYPTO S2 — build the constant-time Secret rule
        status: pending
      - id: s2-docs
        content: Add the docs/LANGUAGE.md Secrets rule, cookbook entry and guide page, and update docs/security/secret.md — see CRYPTO S2 — build the constant-time Secret rule
        status: pending
      - id: s2-port
        content: Port the std/crypto modules whose headers say discipline onto the rule, one module per commit, under the rolling freeze — see CRYPTO S2 — build the constant-time Secret rule
        status: pending
  - id: s3-ctgrind
    title: CRYPTO S3 — check the real std/crypto for secret-dependent branches and addresses under Valgrind
    goal: CI runs the std/crypto tests under Valgrind memcheck with secret buffers marked undefined on both targets, a known leaky function fails the check, and every declassification is a public value.
    verification: node tests/run.js ct && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 831
    todos:
      - id: s3-hook
        content: Add a test-build runtime hook that marks a buffer undefined or defined for Valgrind, compiled out elsewhere, in runtime/ with its c-symbols entry — see CRYPTO S3 — check the real std/crypto under Valgrind
        status: pending
      - id: s3-mark
        content: Mark keys, nonces and secret scalars in the X25519, P-256 ECDH and ECDSA including the RFC 6979 nonce and safegcd inverse, AES-GCM and ChaCha20-Poly1305 tests, declassifying only the tag-compare result, public keys and ciphertext — see CRYPTO S3 — check the real std/crypto under Valgrind
        status: pending
      - id: s3-negative
        content: Add a negative that must fail, a known leaky function such as naiveEqual from ct_asm_refused, so the check shows it sees a leak — see CRYPTO S3 — check the real std/crypto under Valgrind
        status: pending
      - id: s3-ci-record
        content: Run it under memcheck in CI on both targets and update docs/security/ct-verification.md — see CRYPTO S3 — check the real std/crypto under Valgrind
        status: pending
  - id: s4-dit
    title: CRYPTO S4 — enable Arm DIT around std/crypto on aarch64
    goal: Secret-handling paths of std/crypto set PSTATE.DIT on aarch64 where FEAT_DIT is present and restore it on exit, the cost is measured, and ct-timing records whether DIT was on.
    verification: node tests/run.js c-symbols && node tests/run.js ct_asm && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 832
    todos:
      - id: s4-design
        content: Decide whether the toggle is a runtime helper the modules call or a wrapper around expose for Secret values, and measure its cost per call — see CRYPTO S4 — enable Arm DIT around std/crypto
        status: pending
      - id: s4-detect
        content: Detect FEAT_DIT through HWCAP_DIT from getauxval on Linux and do nothing where it is absent, in runtime/ with its c-symbols entry — see CRYPTO S4 — enable Arm DIT around std/crypto
        status: pending
      - id: s4-timing
        content: Make tests/ct-timing.js record whether DIT was on so the weekly aarch64 reading compares on and off — see CRYPTO S4 — enable Arm DIT around std/crypto
        status: pending
      - id: s4-record
        content: Update docs/security/ct-verification.md so the aarch64 rows become a vendor guarantee where FEAT_DIT is present, and record Intel DOIT as a platform limit — see CRYPTO S4 — enable Arm DIT around std/crypto
        status: pending
  - id: s5-ct-asm-discipline
    title: CRYPTO S5 — extend the disassembly check from the cores to the loops the module headers call discipline
    goal: A tests/ct-asm fixture, or a way to read the real module functions, covers the ChaCha20 rounds and loops, the AES key schedule and block loops, the X25519 ladder loop, inversion and encodings, and the P-256 window loop, table build, inversions and RFC 6979 on x86-64 and aarch64.
    verification: node tests/run.js ct_asm && node tests/ct-asm-runtime.js && npm run lint
    status: pending
    issue: 477
    todos:
      - id: s5-ct13
        content: Settle CT-13, whether the x25519 ladder-step reading is a leak or a harness artefact, before or alongside the fixtures — see CRYPTO S5 — extend the disassembly check to the discipline loops
        status: pending
      - id: s5-fixtures
        content: Add a tests/cases/ct_asm fixture per remaining path in chacha20poly1305, aes, x25519 and p256, or read the real functions instead of copies — see CRYPTO S5 — extend the disassembly check to the discipline loops
        status: pending
      - id: s5-ct16
        content: Close or narrow CT-16, that the check reads clang -O2 for the baseline CPU only — see CRYPTO S5 — extend the disassembly check to the discipline loops
        status: pending
  - id: s6-icelake-timing
    title: CRYPTO S6 — explain the seven P-256 timing readings on Intel Ice Lake
    goal: The seven P-256 functions that differ on a Xeon 8370C are shown to repeat or not on the same CPU, the input class is ruled in or out as the cause, and the finding is recorded in docs/security/ct-verification.md as fixed, accepted or a platform limit.
    verification: node tests/ct-timing.js --samples 1000000 ct_asm_p256 && npm run lint
    status: pending
    issue: 807
    todos:
      - id: s6-repeat
        content: Re-dispatch ct-timing.yml until an 8370C runner comes up, or use an Ice Lake host, and check the seven functions repeat — see CRYPTO S6 — explain the P-256 timing readings on Ice Lake
        status: pending
      - id: s6-fixed-class
        content: Make the fixed class in tests/ct-timing.js a nonzero constant with about half its bits set and see whether the difference disappears, which would point at Hamming weight — see CRYPTO S6 — explain the P-256 timing readings on Ice Lake
        status: pending
      - id: s6-null
        content: Read the A/A null on that runner, then record the verdict, and Hertzbleed-class power and frequency effects if that is the cause, in docs/security/ct-verification.md — see CRYPTO S6 — explain the P-256 timing readings on Ice Lake
        status: pending
  - id: s7-bcrypt
    title: CRYPTO S7 — bcrypt verify wipe, the single-path gap to gcc, and the bench precondition message
    goal: Every array verify rebuilds is wiped and pinned, the single-path gap to gcc is either explained with the IR shown and the needed change named or recorded as accepted, and the bench says to run npm run build first.
    verification: node tests/run.js wipes && node tests/run.js bcrypt && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 953
    labels: [needs-decision]
    todos:
      - id: s7-wipe-check
        content: Check that bcryptSameWiped in std/crypto/bcrypt.ts now wipes the recomputed hash, bcryptRun's digest and the batch lane digests, and add the missing tests/wipes/crypto.js pin — see CRYPTO S7 — bcrypt verify wipe and gap to gcc
        status: pending
      - id: s7-gap
        content: Decide to accept the 7 to 8 percent single-path gap to libxcrypt and gcc as LLVM scheduling, or compare opt -O2 IR and llc output of bcryptEncrypt with clang's IR of Blowfish_encipher and name the change — see CRYPTO S7 — bcrypt verify wipe and gap to gcc
        status: pending
      - id: s7-bench-msg
        content: Make bench/crypto/bcrypt/run.mjs say to run npm run build first when the seed predates bcryptHash4 instead of printing did not build undefined — see CRYPTO S7 — bcrypt verify wipe and gap to gcc
        status: pending
  - id: s8-x509-pki
    title: CRYPTO S8 — x509 exposes extension criticality, AKI issuer and serial, and AIA so pki closes its limbo divergences
    goal: x509.ts exposes each decoded extension's critical flag, the AKI's authorityCertIssuer and serial presence and AIA well-formedness, pki.ts refuses the ten x509-dependent limbo cases, and the findings in crypto-pki.md are marked fixed.
    verification: node tests/run.js x509 && node tests/run.js pki && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1028
    todos:
      - id: s8-critical
        content: Keep and expose the critical flag of each decoded extension in std/crypto/x509.ts, which its header partly describes already — see CRYPTO S8 — x509 exposes criticality, AKI and AIA
        status: pending
      - id: s8-aki-aia
        content: Expose the AKI's authorityCertIssuer and authorityCertSerialNumber and parse AIA with its well-formedness check — see CRYPTO S8 — x509 exposes criticality, AKI and AIA
        status: pending
      - id: s8-pki
        content: Use them in std/crypto/pki.ts to refuse the ten limbo cases and shrink the divergence list, marking the findings fixed in docs/security/crypto-pki.md and crypto-x509.md — see CRYPTO S8 — x509 exposes criticality, AKI and AIA
        status: pending
      - id: s8-psl
        content: Decide separately whether to vendor a Public Suffix List and how to keep it current, for the two public-suffix wildcard cases — see CRYPTO S8 — x509 exposes criticality, AKI and AIA
        status: pending
  - id: s9-vector-rfcs
    title: CRYPTO S9 — vector-crypto-rfcs follow-ups, the staleness PASS line, RFC 8439 Appendix A vectors and coverage gaps
    goal: The spec section prints one staleness PASS per test or the single line is accepted, RFC 8439 Appendix A vectors are added or each omission is given a reason, and the third-party-licence check covers copied .md specs.
    verification: node tests/run.js spec && node tests/run.js third-party && npm run lint
    status: pending
    issue: 1671
    todos:
      - id: s9-staleness
        content: Print a separate staleness PASS per test in the spec section of tests/run.js, or record that the single line is enough — see CRYPTO S9 — vector-crypto-rfcs follow-ups
        status: pending
      - id: s9-rfc8439
        content: Add the RFC 8439 section 2.1.1, 2.2.1 and Appendix A.1 to A.4 vectors to specs/rfc8439-chacha20-poly1305.md where vector allows, or state each omission's reason — see CRYPTO S9 — vector-crypto-rfcs follow-ups
        status: pending
      - id: s9-licence
        content: Make the third-party-licence check's SOURCE regex stop excluding .md so a copied spec with no THIRD_PARTY_NOTICES row fails CI — see CRYPTO S9 — vector-crypto-rfcs follow-ups
        status: pending
      - id: s9-orientation
        content: Fix the vector-spec skill pointer in .claude/orientation.md, which names a skill that lives in amritk/vector, and record the vector 0.2.1 limits as upstream requests — see CRYPTO S9 — vector-crypto-rfcs follow-ups
        status: pending
  - id: s10-sha256-scalar
    title: CRYPTO S10 — SHA-256 scalar body gap to OpenSSL and the multibuffer break-even without SHA-NI
    goal: The soft SHA-256 path is within the 10 percent bar of OpenSSL's scalar body or the obstacle is recorded, and the number of messages that must be ready to make multibuffer beat the scalar or AVX2 body on a CPU without SHA-NI is stated from a measurement.
    verification: node tests/run.js sha256 && node tests/run.js ct_asm && node scripts/security-scope.mjs && npm run lint
    status: pending
    issue: 1180
    todos:
      - id: s10-scalar
        content: Close the scalar gap in sha256Compress in std/crypto/sha256.ts, the soft path being 13.9, 19.8 and 22.1 percent behind OpenSSL, starting from the module-level constant array refusal named in bench/sha256-block/README.md — see CRYPTO S10 — SHA-256 scalar gap and multibuffer break-even
        status: pending
      - id: s10-break-even
        content: Measure on a non-SHA-NI CPU, or derive from AVX2 lane throughput, how many messages must be ready for the 8-lane body to win, and add it to the Multibuffer section of bench/sha256-block/README.md and docs/security/crypto-sha256-hw.md — see CRYPTO S10 — SHA-256 scalar gap and multibuffer break-even
        status: pending
  - id: s11-two-base64
    title: CRYPTO S11 — decide whether two exported padded base64 encoders are intended
    goal: The owner has chosen to accept nish/base64 and nish/crypto/base64url as two encoders, or to unify them, and the chosen state is pinned and documented.
    verification: node tests/run.js link && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    issue: 946
    labels: [needs-decision]
    todos:
      - id: s11-decide
        content: Record the owner's choice between keeping std/base64.ts base64Encode (not constant time, for pixels) beside base64StdPadEncode in std/crypto/base64url.ts, or sharing one — see CRYPTO S11 — two padded base64 encoders
        status: pending
      - id: s11-apply
        content: Apply the choice, updating std/README.md and the tests/link/std_base64_two_modules pin, and close the issue if two stay — see CRYPTO S11 — two padded base64 encoders
        status: pending
---

# Crypto hardening — constant time, wiping, and the open audit follow-ups

## Context
There is no roadmap page; the area is tracked in [docs/security/README.md](../../docs/security/README.md) and the constant-time record [docs/security/ct-verification.md](../../docs/security/ct-verification.md). What exists today: `Secret<T>` with wiping ([secret.md](../../docs/security/secret.md)), `tests/ct-asm.js` disassembly fixtures, a weekly `tests/ct-timing.js` run, and the modules' own records ([crypto-aead.md](../../docs/security/crypto-aead.md), [crypto-ecc.md](../../docs/security/crypto-ecc.md), [crypto-bcrypt.md](../../docs/security/crypto-bcrypt.md), [crypto-x509.md](../../docs/security/crypto-x509.md), [crypto-pki.md](../../docs/security/crypto-pki.md), [crypto-sha256-hw.md](../../docs/security/crypto-sha256-hw.md), [crypto-chacha20-hw.md](../../docs/security/crypto-chacha20-hw.md)). Any stage that touches `std/crypto` updates its record and `docs/security/README.md` row in the same PR (CLAUDE.md).

## CRYPTO S1 — design Secret constant time by type
#833: inside `expose`, code may still branch on, index with or compare a secret; HACL* and Jasmin make this a type property. Proposal in the issue: refuse an `if`, ternary, loop condition, `&&` or `||` that depends on the secret, a secret-dependent index or Map key, and an early return or break under such a condition, while allowing `ctSelect`, `ctEq`, arithmetic and bitwise ops, with a declassification point. The rule must cover every way in (calls, `new`, closures, `this` out of a constructor, every declarator), each with a negative. A language change: LANGUAGE.md rule, guide page, cookbook entry, rolling freeze. The issue says "a design to write and decide before building".
Likely files: new `docs/` design note, `docs/security/secret.md`.

### Decision needed
Build a compile-time constant-time rule at all. Options: (a) build it, accepting the cost of porting `std/crypto`; (b) keep `tests/ct-asm.js` plus Valgrind (S3) and the timing run as the checks. The issue frames it as a proposal; no option is recommended there.

## CRYPTO S2 — build the constant-time Secret rule and port std/crypto onto it
Only after S1 is accepted. Likely files: `src/` checker, `docs/LANGUAGE.md`, `std/crypto/*.ts`. Needs the golden regeneration the CLAUDE.md "generated goldens" rule describes.

### Decision needed
Gated on S1's outcome; if S1 declines the rule, close this stage.

## CRYPTO S3 — check the real std/crypto under Valgrind
#831: `tests/ct-asm.js` proves no secret branch or secret-indexed load only for the `ct_asm_*` fixtures, which copy each module's cores. BoringSSL's `CONSTTIME_SECRET`, ctgrind, liboqs and SUPERCOP's TIMECOP mark secret bytes undefined for memcheck; any "conditional jump depends on uninitialised value" is a failure. CI already installs valgrind (`.github/workflows/ci.yml`). Like `ct-asm.js` it does not cover variable-time instructions (S4 and S6). Complements #477 (S5).
Likely files: `runtime/`, `tests/`, `.github/workflows/ci.yml`, `docs/security/ct-verification.md`.

## CRYPTO S4 — enable Arm DIT around std/crypto
#832: `docs/security/ct-verification.md` says the AES kernels and the x25519 ladder step "do not set PSTATE.DIT", so on aarch64 timing is the cores' behaviour, not a guarantee. AWS-LC sets DIT and Go has `crypto/subtle.WithDataIndependentTiming` (Go 1.24). Plan from the issue: `msr DIT, #1` on entry with the previous value restored, FEAT_DIT detected first, the cost measured. x86's equivalent, Intel DOIT (Ice Lake and newer), needs the operating system to enable it: record that as a platform limit and do not attempt it from user space. Neither covers power or frequency effects (S6).
Likely files: `runtime/runtime-aes.c` (an AT_HWCAP read exists there), `tests/ct-timing.js`.

## CRYPTO S5 — extend the disassembly check to the discipline loops
#477: per module, what disassembly covers and what is still discipline (table in the issue): ChaCha20 rounds and loops; AES key schedule, packing and block loops; the X25519 255-step ladder, inversion and encodings; P-256's 64-window loop, table build, inversions and RFC 6979 nonce derivation. Settle CT-13 (#378, closed as an artefact in `ct-verification.md`) first or alongside. CT-16 (clang -O2, baseline CPU only) was narrowed by WP38 S2 and remains partly open.
Likely files: `tests/cases/ct_asm_*.ts`, `tests/ct-asm.js`, `tests/ct-asm-runtime.js`.

## CRYPTO S6 — explain the seven P-256 timing readings on Intel Ice Lake
#807: on the Xeon Platinum 8370C runner, seven P-256 functions read |t| up to 56.27 (`p256FiatMul`, `p256TableMove`, `p256TableSelect`, `p256PointDouble`, `p256PointAdd`, `p256WindowStep`, `p256PointAddMixed`) and repeat on a fresh seed; arm64, a different AVX-512 cloud VM and earlier x64 weekly runs (8573C, EPYC 7763, 9V74) read clean. `ct-asm.js` passes all of them, so a real effect is outside the instruction model: possibly a Hertzbleed-class power or frequency effect or an Ice Lake microarchitectural one, neither measured. The masked moves with no multiply read some of the largest values, which any explanation must cover. Settling steps are the three todos.

## CRYPTO S7 — bcrypt verify wipe, the gap to gcc, and the bench message
#953, from the bcrypt run #873: part 1 asked to wipe verify's recomputed hash. The BCRYPT-7 row in `docs/security/crypto-bcrypt.md` on main now says the rebuilt hash and the given hash are wiped through `bcryptSameWiped`, so this part may already be done (the lead should check `tests/wipes/crypto.js` for the pin and close part 1). Part 2: the single path is about 7 to 8 percent behind libxcrypt and the gcc build (Nish 52.9 ms against 48.6 and 48.8 per cost-10 hash; 4-way 16.0 ms per hash, at or ahead of C); the record blames LLVM scheduling without the IR shown. Part 3 is the bench message.

### Decision needed
Accept the single-path gap as the LLVM-versus-GCC difference (the server uses the 4-way path), or investigate by comparing `opt -O2` IR and `llc` output of `bcryptEncrypt` with clang's IR of OpenBSD's `Blowfish_encipher`. The issue lists both and recommends neither.

## CRYPTO S8 — x509 exposes criticality, AKI and AIA
#1028: twelve x509-limbo server-validation cases are accepted by `pki` and refused by limbo. Ten need x509 to expose: extension criticality (seven cases), AKI issuer and serial (two), AIA (one, `webpki::malformed-aia`); two need a Public Suffix List. The header of `std/crypto/x509.ts` already says each extension's critical flag is read, so part of the criticality item may be done; check what is exposed on the decoded type. The PSL is its own decision: whether to vendor a list and keep it current. Refs #987.

## CRYPTO S9 — vector-crypto-rfcs follow-ups
#1671, from #1653 (all six stages merged). Criterion 5 partial: the `spec` section prints one line per test and no separate staleness PASS (hex prints SKIP). RFC 8439 vectors omitted with no reason: 2.1.1, 2.2.1, A.1 vectors 1 to 5, A.2 vectors 1 to 3, A.3 vectors 1 to 11, A.4 vectors 1 to 3. Gaps that need changes in amritk/vector (Ed25519 section 7.1 signatures, X25519 section 6.1 and the 1,000-iteration vector, HMAC test case 5, property sample counts) are recorded in the specs; file them upstream rather than here. Also the `third-party-licence` SOURCE regex and the orientation pointer.

## CRYPTO S10 — SHA-256 scalar gap and multibuffer break-even
#1180, from #1173 (PR #1174): the soft path is 13.9, 19.8 and 22.1 percent behind OpenSSL's scalar body over three runs; the best source rewrite gained 8 to 9.5 percent, under the 10 percent bar, so `sha256Compress` is unchanged. The obstacle is that module-level constant arrays are refused (`bench/sha256-block/README.md`, "Trying to close the gap"); the base body is 3450 instructions with 129 stack stores, 138 stack loads and 905 register moves. The issue says the owner asked for it as its own session. The multibuffer comparison there is 8 lanes with SHA-NI (8 x 47 ns) against about 3 requests per epoll wake and never states the break-even for a CPU without SHA-NI. Nothing secret-dependent may be added; keep digests byte-identical to Node under both `NISH_SHA256` settings.

## CRYPTO S11 — two padded base64 encoders
#946, criterion 8 of run #868: `std/crypto/base64url.ts` exports `base64StdPadEncode` and `base64StdPadDecode` (constant-time, strict, imported by `std/crypto/x509.ts` and `std/net/postgres.ts`), and `std/base64.ts` exports `base64Encode` (encode-only, not constant-time, for kitty-graphics pixels). They were kept apart on purpose (distinct names, `std/README.md` says which is for what, `tests/link/std_base64_two_modules` pins both). Nothing is a bug; both agree byte for byte on the pinned inputs.

### Decision needed
(1) Accept two as intended and close the issue; (2) have `nish/base64`'s encoder call `base64StdPadEncode`, which costs it the constant-time version's speed on pixels; (3) the other way round. The issue does not recommend one; (1) changes no code.
