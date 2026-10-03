# Security policy

Nish is a pre-alpha compiler: **do not use it in production**, and do not let
anything it builds handle data, money or systems you care about
([README](README.md)). Security reports are still wanted. This file says how to
send one, which releases get fixes, what the project treats as a vulnerability,
and where the audit records are.

## Reporting a vulnerability

Report it privately, through GitHub's private vulnerability reporting: on the
repository page open **Security**, then **Report a vulnerability**
(<https://github.com/amritk/nish/security/advisories/new>). Only the
maintainers see the report, and the fix can be prepared in a private fork
before anything is published.

**Do not open a public issue, pull request or discussion for a
vulnerability**, and do not post its details anywhere else. If the button
is missing, open a public issue that asks for a private contact and contains
no details.

A useful report has:

- the version (`nish --version`) or the commit;
- the platform, and the target (native or `wasm32`) if the issue is in a
  compiled program;
- the smallest program, command line or input that shows the problem, and
  what happens against what should happen;
- the severity you think it has, using the scale below.

You will get an acknowledgement, and then the fix lands on `main` with a
regression test that fails before it and passes after. The finding is
added to the matching record under [`docs/security/`](docs/security/README.md),
with credit to you if you want it. There is no bug bounty.

A crash of the compiler itself on a program you wrote (exit 70, an internal
error) is an ordinary bug: report it as a public issue, as
[docs/INSTALL.md](docs/INSTALL.md) says. It becomes a security report only if
an attacker could use it to do more than stop the compile.

## Supported versions

The project is on 0.x, and every minor release may break things
([`docs/LANGUAGE.md`](docs/LANGUAGE.md) says what counts as a break). Fixes are
made on `main` and ship in the next release. Nothing is backported.

| Version | Gets security fixes |
| --- | --- |
| `main` | yes |
| the latest 0.x release ([releases](https://github.com/amritk/nish/releases/latest), [npm](https://www.npmjs.com/package/@amritk/nish)) | yes, through the next release |
| every earlier release | no: upgrade |

The compiler is built by the release before it (the seed,
[`.claude/selfhost.md`](.claude/selfhost.md)). A fix in the C runtime, or a new
runtime function the compiler needs, therefore reaches the `nish` binary itself
one release after it lands. The audit records say where that applies (CLI-6,
CLI-7 and CLI-9 in [`docs/security/cli.md`](docs/security/cli.md)).

## Threat model

The full model for each area is in its record. In summary:

| Who is the attacker | What they control | What must hold | Record |
| --- | --- | --- | --- |
| A user of a compiled program | every byte the program reads: its input, the files and directories it is pointed at, and their size | the program never reads or writes outside an object, never reads freed memory, never races, and never reaches LLVM undefined behaviour because the compiler removed a check or emitted an attribute it could not justify. Input that makes it panic, loop without end or allocate without bound is denial of service (Medium) | [codegen](docs/security/codegen.md), [runtime](docs/security/runtime.md) |
| A peer of a program using `nish/crypto` | every byte on the verifying, decrypting and key-agreement side: keys, signatures, tags, ciphertexts, certificates, PEM | no forgery, no key recovery, no panic, no accepted non-canonical encoding, and no branch or secret-indexed load on a secret in the code the constant-time check reads | [crypto-aead](docs/security/crypto-aead.md), [crypto-ecc](docs/security/crypto-ecc.md), [crypto-k1](docs/security/crypto-k1.md), [crypto-x509](docs/security/crypto-x509.md), [ct-verification](docs/security/ct-verification.md) |
| The author of a checkout you compile, or another user on your machine | every file and file name in the checkout, the source itself, and anything in a world-writable directory | compiling a program runs none of its code. `nish run` runs the program its source describes and nothing else. No output is written outside what the command line names | [cli](docs/security/cli.md) |
| Whoever sits between you and a release: a mirror, a proxy, a tampered release asset | the bytes of a download | the installers, the seed fetch and CI unpack and run nothing whose SHA-256 is not either pinned in `install.sh` or published in the release's `SHA256SUMS` | [supply-chain](docs/security/supply-chain.md) |

**Out of scope.** These are not vulnerabilities:

- **What a program you compile and run does on purpose.** Compiling a program
  and running it runs its code. The compiler must not run a checkout's code
  just because you compiled it, but the program you then run is yours to
  trust.
- **The holes the language asks for by name**: an out-of-range
  [`uncheckedGet` or `uncheckedSet`](README.md#where-it-is-not-safe), each a
  call a module reaches only by importing it from `nish:unsafe` (and every index
  of your own package under the deprecated `--unchecked-indexing`, which never
  reaches a dependency or `nish/`), `Arena.reset()` and `Arena.release(m)` with
  a live reference, signed overflow (undefined except through the `nish:unsafe`
  `wrapping*` calls, or in your own package under the deprecated `--wrapping`),
  and what an interop host does with a pointer it is given. A dependency that
  imports `nish:unsafe` has taken that hole on its own account, and its import
  says so; `--emit-checked` lists every such import and call.
- **Timing outside the constant-time check's reach**: functions no fixture
  names, profiles and `-march` targets other than the baseline `clang -O2` the
  check reads, and `wasm32`, where the engine recompiles the module
  ([`docs/LANGUAGE.md`](docs/LANGUAGE.md#constant-time-ctselect-and-cteq)).
- **Secrets left in memory.** Nothing is wiped yet (ECC-2, X509-7), so an
  attacker who can already read the process's memory is not in the model.
- **`curl … | sh`**, which runs `install.sh` itself unverified (SC-17,
  accepted). Read `install.sh` and run it from a checkout if that matters
  to you.

**Severity.** Critical: forgery, key recovery, remote code execution. High:
memory corruption, a verifier that accepts bad input, secret-dependent timing
in a fixture path. Medium: denial of service (a panic, an unbounded loop or
allocation) on attacker input. Low: hardening and documentation drift.

## Audit records

The first audit (#363) went over the repository area by area. Each record
says what was checked, how, what was found, its severity and what became of
it, and names the test that pins each property. The index has every area's
counts and every finding still open:
**[`docs/security/README.md`](docs/security/README.md)**.

| Area | Record |
| --- | --- |
| ChaCha20-Poly1305 and AES-GCM | [`docs/security/crypto-aead.md`](docs/security/crypto-aead.md) |
| P-256 ECDSA and X25519 | [`docs/security/crypto-ecc.md`](docs/security/crypto-ecc.md) |
| SHA-2, HMAC, HKDF, constant-time compare, base64url | [`docs/security/crypto-k1.md`](docs/security/crypto-k1.md) |
| DER, PEM and X.509 | [`docs/security/crypto-x509.md`](docs/security/crypto-x509.md) |
| The constant-time checks | [`docs/security/ct-verification.md`](docs/security/ct-verification.md) |
| Bounds-check elimination, emitted attributes, thread rules | [`docs/security/codegen.md`](docs/security/codegen.md) |
| The C runtime | [`docs/security/runtime.md`](docs/security/runtime.md) |
| `nish`, `nish run` and its cache | [`docs/security/cli.md`](docs/security/cli.md) |
| Install, launcher, seed fetch, release workflows | [`docs/security/supply-chain.md`](docs/security/supply-chain.md) |
