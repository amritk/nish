---
name: WP77 — nish/credential, a credential store for command-line programs
overview: A Nish CLI that signs in has nowhere safe to keep the token. The builtins it needs landed with credential-cli-builtins (spawnPiped, writeFileSyncMode, mkdirSyncMode, createFileExclusiveSync, renameSync), but no std module puts them together. Add nish/credential with a locked 0600 file backend (S1), the macOS Keychain through /usr/bin/security (S2) and the Linux Secret Service through secret-tool with a fallback to the file (S3), with its security record.
priority: 130
labels: [ready]
issue: 2081
stages:
  - id: s1-file-backend
    title: WP77 S1 — nish/credential's API and its file backend, with its security record
    goal: std/credential.ts stores, reads and deletes a secret by service and account in a 0600 file inside a 0700 directory, written atomically under a cross-process lock, with secrets handed in and out as Secret values.
    verification: node tests/run.js std_credential && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2082
    todos:
      - id: s1-api
        content: Add std/credential.ts with CredentialStore (get, set, delete, accounts) and the CRED_BACKEND and CRED_E codes, registered in src/std-modules.ts stdModuleNames — see WP77 S1
        status: pending
      - id: s1-location
        content: Place the store under XDG_CONFIG_HOME or HOME/.config on Linux and HOME/Library/Application Support on macOS, refusing a relative or unset base with a code — see WP77 S1
        status: pending
      - id: s1-atomic
        content: Write through writeFileSyncMode to a temporary name at 0o600 and renameSync over the store, inside a 0o700 directory made by mkdirSyncMode — see WP77 S1
        status: pending
      - id: s1-lock
        content: Serialise every rewrite with a lock file taken by createFileExclusiveSync and stamped with a per-acquisition token, reclaiming a stale lock and releasing only a lock still carrying the token — see WP77 S1
        status: pending
      - id: s1-tests
        content: Add tests/link/std_credential (round trip, modes read back by stat, a symlinked store refused, a missing account, racing writers through spawned copies) with its expected.caps.json — see WP77 S1
        status: pending
      - id: s1-record
        content: Write docs/security/credential.md with its README row, a guide page docs/guide/using-nish/credentials.md routed in scalar.config.json, and std/README.md and standard-library.md rows — see WP77 S1
        status: pending
  - id: s2-macos-keychain
    title: WP77 S2 — the macOS Keychain backend through /usr/bin/security -i
    goal: On macOS the store keeps secrets in the login Keychain by sending security's interactive commands on stdin, so no secret reaches argv, and it tells a missing item from a locked or unreachable Keychain by exit status.
    verification: node tests/run.js std_credential && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2083
    todos:
      - id: s2-commands
        content: Send add-generic-password with -U, find-generic-password with -w and delete-generic-password to /usr/bin/security -i through spawnPipedWithin, never by bare name — see WP77 S2
        status: pending
      - id: s2-quoting
        content: Quote for security's line parser (double quotes, backslash escapes for backslash and quote), refuse control characters in service and account, and cap the line below the 4096-byte buffer — see WP77 S2
        status: pending
      - id: s2-encoding
        content: Store the secret base64-encoded behind a prefix so find-generic-password never answers it as hex, and read exit 44 alone as not found — see WP77 S2
        status: pending
      - id: s2-tests
        content: Add a check in the macos-keychain CI job (WP75 S2 adds it, or this stage does if it lands first) against a throwaway keychain named by path, covering round trip, quotes and backslashes, an overlong line and a locked keychain — see WP77 S2
        status: pending
  - id: s3-secret-service
    title: WP77 S3 — the Linux Secret Service backend through secret-tool, and the auto backend
    goal: On Linux the store keeps secrets through secret-tool found on an absolute PATH entry with the secret on stdin, and the auto backend falls back to the file backend when no Secret Service answers, recording which backend holds each account.
    verification: node tests/run.js std_credential && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    issue: 2084
    todos:
      - id: s3-secret-tool
        content: Run secret-tool store, lookup and clear with the secret on stdin, resolving secret-tool on absolute PATH entries only and finding nothing when PATH is unset — see WP77 S3
        status: pending
      - id: s3-auto
        content: Add CRED_BACKEND_AUTO that tries the OS store and falls back to the file on a failed write, and record the holding backend in the file's index so get and delete ask the right one — see WP77 S3
        status: pending
      - id: s3-tests
        content: Add tests/run.js checks with a stub secret-tool placed ahead on PATH, proving behaviour by the stub's exit status, plus a relative PATH entry ignored — see WP77 S3
        status: pending
      - id: s3-docs
        content: Extend docs/security/credential.md and the credentials guide page with both OS backends and auto — see WP77 S3
        status: pending
---

# WP77 — nish/credential, a credential store for command-line programs

## Context

The `credential-cli-builtins` run (#992) landed what a credential-storing CLI needs from the runtime, each in [`runtime/nish.d.ts`](../../runtime/nish.d.ts):

| Builtin | Line | Capability |
| --- | --- | --- |
| `writeFileSyncMode(path, data, mode)` (refuses a symlink, `fchmod`s before writing) | 1111 | fs.write |
| `createFileExclusiveSync(path, data, mode)` (`O_CREAT \| O_EXCL`; -17 if present) | 1128 | fs.write |
| `mkdirSyncMode(path, mode)` | 1142 | fs.write |
| `renameSync`, `unlinkSync` | 1071, 1082 | fs.write |
| `spawnPiped(argv, stdin, stdout, stderr)`, `spawnPipedWithin(…, timeoutMs)` | 1270, 1301 | process.spawn |
| `getenv` | 1491 | env |

No `std/` module combines them, so every CLI that signs in writes its own store: where it lives, its modes, an atomic rewrite, a lock, and how to talk to the OS keyring without leaking the secret into a process list. A generated API CLI (`login`/`logout`) needs exactly this.

S2 and S3 need S1's API. They are independent of each other.

## Approach

- **One API, three backends.** `CredentialStore(service, backend)` with `CRED_BACKEND_FILE`, `CRED_BACKEND_KEYCHAIN` (macOS), `CRED_BACKEND_SECRET_SERVICE` (Linux) and, from S3, `CRED_BACKEND_AUTO`.
- **Secrets are `Secret` values** (`nish:secret`): `get` answers `Secret<u8[]> | null` and `set` takes one, and every buffer that held the plain value is wiped before return. What a wipe cannot reach (the child process's copy, the file on disk) is recorded in the record.
- **Secrets never go in argv.** A process's command line is readable by other processes, so every helper takes the secret on stdin. `security -i` qualifies because the secret travels inside the command it reads on stdin.
- **Helpers by absolute path.** `/usr/bin/security` on macOS (SIP keeps it there, and a user-writable PATH entry could shadow it). `secret-tool` is looked up on absolute PATH entries only, and an unset PATH finds nothing: the lookup fails closed.
- **The real operation decides fallback, not a probe.** A failed OS-store write falls back to the file under `AUTO`; a read that finds nothing is "not found". The holding backend is recorded per account so `delete` never reports success over a live secret.

## WP77 S1 — nish/credential's API and its file backend, with its security record

```ts
export const CRED_OK: i32 = 0
export const CRED_E_NOT_FOUND: i32 = -1
export const CRED_E_LOCKED: i32 = -2        // the lock is held and not stale
export const CRED_E_STORE: i32 = -3         // the store or helper failed; see detail()
export const CRED_E_LOCATION: i32 = -4      // no usable base directory
export class CredentialStore {
  constructor(service: string, backend: i32)
  get(account: string): Secret<u8[]> | null  // null with code() CRED_E_NOT_FOUND or an error
  set(account: string, secret: Secret<u8[]>): i32
  delete(account: string): i32
  accounts(): string[]                       // from the file's index
  code(): i32
  detail(): string
}
```

- **Location.** Linux: `$XDG_CONFIG_HOME/<service>/` when it is absolute, else `$HOME/.config/<service>/`. macOS: `$HOME/Library/Application Support/<service>/`. A relative or unset base is `CRED_E_LOCATION`. `service` is refused if it holds `/`, `..`, NUL or a control character.
- **File.** `credentials.json`, a JSON object of account to `{ "backend": …, "secret": <base64 or absent> }`. The directory is made `0o700` with `mkdirSyncMode`. Each rewrite goes to `credentials.json.<token>.tmp` through `writeFileSyncMode(…, 0o600)`, then `renameSync` replaces the store.
- **Lock.** `credentials.lock` taken with `createFileExclusiveSync`, holding a random token and the time. A lock older than a fixed staleness bound is reclaimed. Release unlinks only a lock still holding this acquisition's token. The lock is held across the helper call and the index write together.
- **Tests.** `tests/link/std_credential`: round trip, `stat` modes 0600/0700, a symlink at the store refused (`writeFileSyncMode` answers -40), a missing account, a corrupt store answered `CRED_E_STORE` rather than a panic, and racing writers (several spawned copies each adding an account; every account survives). The capability report is pinned in `expected.caps.json`.
- **Record and docs.** `docs/security/credential.md`: scope `std/credential.ts`, what a wipe cannot reach, file modes, the lock's race window. Its row goes in [`docs/security/README.md`](../../docs/security/README.md); `node scripts/security-scope.mjs` watches `std/net` and `std/crypto`, so check that it accepts a scope row for a file outside them. A new guide page `docs/guide/using-nish/credentials.md` with its route in `scalar.config.json`, and rows in [`std/README.md`](../../std/README.md) and [`standard-library.md`](../../docs/guide/using-nish/standard-library.md).

## WP77 S2 — the macOS Keychain backend through /usr/bin/security -i

- **Commands.** `add-generic-password -U -s <service> -a <account> -w <value>`, `find-generic-password -s … -a … -w` and `delete-generic-password -s … -a …`, sent on stdin to `/usr/bin/security -i` through `spawnPipedWithin` with a timeout. A test-only keychain path can be passed as the commands' last argument.
- **Quoting.** `security -i`'s line parser (`split_line` in Apple's `SecurityTool`) is not a shell: inside double quotes only a backslash escapes, and the closing quote ends the argument. So wrap each argument in `"`, escape `\` and `"`, and refuse CR, LF, NUL and other control characters in service and account. The parser reads each line into a 4096-byte buffer and runs whatever overflows as the next command, so cap the line well below that; under `AUTO` an oversized secret goes to the file.
- **Encoding.** `find-generic-password -w` prints a value with any non-printable byte as bare hex, so the secret is stored as a fixed prefix plus base64, and a value without the prefix is refused.
- **Exit status.** `security` exits with the low byte of the OSStatus. Only 44 (`errSecItemNotFound`) is "not found". Anything else (36 is a locked keychain over ssh) is `CRED_E_STORE`, so a caller never reads a locked store as empty.
- **Tests** run in the `macos-keychain` CI job WP75 S2 adds (the main `test` job is ubuntu only; whichever stage lands first adds the job, scoped by `scripts/ci-scope.mjs` with a per-command test in `node tests/run.js ci-scope`), against a throwaway keychain made with `security create-keychain`: round trip, names with quotes and backslashes, an overlong line refused, and a locked keychain answered `CRED_E_STORE`.

## WP77 S3 — the Linux Secret Service backend through secret-tool, and the auto backend

- **Commands.** `secret-tool store --label=<service> service <service> account <account>` with the secret on stdin, `secret-tool lookup service … account …` and `secret-tool clear …`. `secret-tool lookup` exits 1 both for "not found" and for some failures, so a lookup that fails is followed by a check that the service answers at all (a `secret-tool search` on a nonce attribute) before it is read as not found.
- **Lookup.** `secret-tool` is resolved on absolute PATH entries only; a relative entry (`.`, `node_modules/.bin`) is skipped, because it would run whatever the working directory holds. No PATH means no helper.
- **AUTO.** It tries the OS store for the platform and falls back to the file when the helper is missing or a write fails. It records the holding backend in the index, and `get` and `delete` ask that backend. A delete whose clear fails but whose follow-up lookup finds nothing drops the entry and warns; one whose lookup still finds the secret is refused.
- **Tests** in `tests/run.js` put a stub `secret-tool`, built by the test, ahead on PATH. Behaviour is proved by the stub's recorded calls and exit status, never by message text, because CI's runners are not this container (`.claude/testing.md` → "Checks that spawn a process"). Cases: store and lookup, the secret absent from the stub's argv, a relative PATH entry ignored, a missing service falling back to the file under `AUTO`.

## Out of scope

- Windows Credential Manager (WP79).
- OAuth flows, token refresh and revocation: a caller's job, built on this store.
- Encrypting the file backend at rest with a passphrase.
- Enumerating Keychain or Secret Service items the store did not write.

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | round trip, modes, symlink refused, corrupt store, racing writers, caps report | the `tests/link/std_*` programs with `expected.caps.json` |
| S2 | throwaway keychain in the `macos-keychain` job; quoting; line cap; locked keychain | the `sha256-macos` job in `.github/workflows/ci.yml` |
| S3 | stub `secret-tool` ahead on PATH; argv free of the secret; fallback | the spawn checks in `tests/run.js` |

## Verification

Per stage, its `verification:` line, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs`, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, and every CI test shard green on the PR head.
