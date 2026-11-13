---
name: Idle and per-call costs — SQLite busy backoff, idle Http1Server connections, HmacSha256.digest
overview: Pin that the default SQLite build already waits on a lock in milliseconds, cut what an idle Http1Server connection holds, and give HmacSha256 a digest that allocates only the tag (plus a digestInto that allocates nothing).
stages:
  - id: sqlite-busy-pin
    title: "test(runtime): pin SQLite's sub-second lock-wait backoff in the default build"
    goal: A link test proves a default build (no NISH_SQLITE_CFLAGS) waits on a busy lock in millisecond steps, and the SQLite security record says why HAVE_USLEEP is not needed
    verification: node tests/run.js sqlite_busy && node tests/run.js sqlite && npm run check && npm run lint && node scripts/security-scope.mjs
    todos:
      - id: busy-link-test
        content: Add the link program tests/link/sqlite_busy_backoff (two connections, one holding a write lock, PRAGMA busy_timeout on the other) asserting the elapsed wait — see Stage sqlite-busy-pin
        status: pending
      - id: busy-record
        content: Record in docs/security/sqlite.md that SQLite 3.54.1's busy handler keys on HAVE_NANOSLEEP, which defaults on, so the default build already backs off 1–100 ms, and name the new test — see Stage sqlite-busy-pin
        status: pending
  - id: http1-idle-conn
    title: "perf(net): shrink what an idle Http1Server connection holds"
    goal: An idle keep-alive Http1Server connection on the default config holds measurably fewer bytes than on the base, measured with bench/http1-conn and pinned by a ceiling in tests/runtime-budgets.js
    verification: node tests/run.js net_http1_server && node tests/run.js runtime-budget && node tests/run.js std_http1 && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: idle-baseline
        content: Measure the idle cost per connection on the base, both the default config and idleInput, after one and after several requests per slot, with bench/http1-conn's rss shape — see Stage http1-idle-conn
        status: pending
      - id: idle-constructor-trims
        content: Cut Http1Connection and Http1Parser construction allocations — shared empty arrays, no throwaway HttpDate, a lazy or smaller spans array — see Stage http1-idle-conn
        status: pending
      - id: idle-head-keep
        content: Stop a slot keeping headBytes and headLengths, about 1.2 KB, across idle without losing the head-reuse fast path — see Stage http1-idle-conn
        status: pending
      - id: idle-input-default
        content: Decide from measurements whether idleInput becomes the default, and either flip it with its docs or record why not — see Stage http1-idle-conn
        status: pending
      - id: idle-ceiling
        content: Add an idle-connection byte ceiling to tests/runtime-budgets.js, checked by an existing net_http1_server startup program, and update the bench README figures — see Stage http1-idle-conn
        status: pending
  - id: hmac-digest-into
    title: "perf(crypto): HmacSha256.digest allocates only the tag, and digestInto allocates nothing"
    goal: HmacSha256.digest allocates only its returned 32-byte tag, a new HmacSha256.digestInto(out, at) allocates nothing, and every wipe still holds under -O2
    verification: node tests/run.js crypto_hmac && node tests/run.js crypto_hkdf && node tests/run.js crypto_jwt && node tests/run.js nish:secret && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    todos:
      - id: sha256-digest-into
        content: Add Sha256.digestInto(out, at) in std/crypto/sha256.ts that writes the digest into a caller's window, with Sha256.digest built on it — see Stage hmac-digest-into
        status: pending
      - id: hmac-digest-into-method
        content: Add HmacSha256.digestInto(out, at) with the scratch's window check, hold the inner digest in a wiped per-instance field, and build digest on it — see Stage hmac-digest-into
        status: pending
      - id: hmac-tests-wipes
        content: Add link tests for digestInto (vectors, window panics, digest-twice, the wipe read-backs) and its counts in tests/wipes/crypto.js — see Stage hmac-digest-into
        status: pending
      - id: hmac-docs
        content: Update docs/security/crypto-k1.md, std/README.md and the guide, and regenerate docs/reference — see Stage hmac-digest-into
        status: pending
---

# Idle and per-call costs

Three findings from a review of the libraries. This is what reading the code
showed about each one.

## Requirements as given

> SQLite's lock-wait handler sleeps whole seconds by default, because it is
> compiled without HAVE_USLEEP. The entry sets it through NISH_SQLITE_CFLAGS;
> the default build should include it.
> Each idle Http1Server connection costs about 1.2 KB, which matters at
> hundreds of thousands of connections.
> HmacSha256.digest allocates on every call. Minor.

## Stage sqlite-busy-pin

**Owns:** `tests/link/sqlite_busy_backoff/**`, `docs/security/sqlite.md`
**Model:** sonnet

**The finding does not hold for the vendored SQLite.** In 3.54.1
(`runtime/sqlite/sqlite3.c:190106`), `sqliteDefaultBusyCallback` takes the
millisecond back-off table under
`SQLITE_OS_WIN || !defined(HAVE_NANOSLEEP) || HAVE_NANOSLEEP`, not under
`HAVE_USLEEP` as older SQLite did. `unixSleep` (`:47805`) uses `nanosleep` on
the same condition. Preprocessing `sqlite3.c` with `scripts/build.sh`'s default
`-D` set takes the table branch, both natively and for `--target=wasm32-wasi`.
Adding `-DHAVE_USLEEP` to the defaults would change no object. So the stage
pins the behaviour instead of changing the build.

- **The test.** A program opens one database file twice. Connection A runs
  `BEGIN EXCLUSIVE`. Connection B runs `PRAGMA busy_timeout = 300` and then a
  write, which must return `SQLITE_BUSY`. Assert that the elapsed wall time is
  at least 250 ms and under 900 ms. The whole-second handler returns
  immediately whenever the timeout is under 1,000 ms
  (`(count+1)*1000 > tmout`). So a lower bound is what tells the two handlers
  apart, and the upper bound is kept loose for CI. Use the repo's clock
  builtin; see how `tests/link/std_sqlite` drives the binding. Link programs
  are picked up by directory name (`tests/run.js` ~1784). Check that, and
  register the program only if the runner needs it.
- **The record.** One paragraph in `docs/security/sqlite.md`'s options section
  on why `HAVE_USLEEP` is absent and harmless, naming the test.

## Stage http1-idle-conn

**Owns:** `std/net/http1-server.ts`, `std/net/http1-codec.ts`,
`bench/http1-conn/**`, `bench/README.md`, `tests/link/net_http1_server*/**`,
`tests/runtime-budgets.js`, `docs/security/http1-codec.md`,
`docs/guide/using-nish/standard-library.md` (the Http1Server sections only),
`tests/nish-cmp.js` (DECLARED entries for this stage only), and the generated
`docs/reference/net/http1-*.md` and `tests/self/goldens/checked/**`

**Measure first, and record every figure in the PR body.** The tree has no
"1.2 KB": `bench/http1-conn/README.md:382` measures 1,026 B per idle connection,
and only with `idleInput = true`. The default (`idleInput` false) also holds
the parser's `buf` (1,024 + 24 B) and `head` (256 + 24 B). A slot that has
repeated a response head also keeps `headBytes` (1,024 + 24 B) and
`headLengths` (152 B, `http1-server.ts:1664`) for as long as it lives.
`tests/runtime-budgets.js:832` claims 3,976 B for a built connection, which
the tally above does not reconcile with. Re-run
`tests/link/net_http1_server/startup.ts` first and settle that number. Measure
with `node bench/http1-conn/run.mjs --rss N`: the base against an identical
copy of the base for the noise band, then the branch. Measure the default
config and `idleInput`, each after one request and after several requests per
slot.

**Construction trims** (`Http1Connection` ~718–950, `Http1Parser`
`http1-codec.ts` ~180–440):

- Share one empty array for `noOutput`, `noFields`, `headLengths`, `names`
  and `values`. Check every write site first: an empty array that is shared
  and later pushed to is a bug.
- Stop building the throwaway `HttpDate` in the constructor
  (`http1-server.ts:434–453`). `build()` swaps in the shared one, but
  `headDate` keeps the constructor's copy.
- Make the 64-slot `spans` array (`http1-codec.ts:435`) lazy, or smaller.
- Keep the widest-first, cache-line field order
  (`http1-server.ts:720`, `http1-codec.ts:180`).
- `Http1TlsServer` (`http1-server.ts:2740+`) builds the same connection.
  Its startup checks (`tls-startup.ts`) must hold too.

**The kept head.** Release or lend `headBytes`/`headLengths` while a slot is
idle, or build them lazily per head, without losing what
`tests/link/net_http1_server_head_reuse` pins. Measure the keep-alive JSON
and plaintext throughput with `bench/http.mjs` against the base's noise
band. If the cost is outside the band, keep the head and say so.

**The idleInput default.** `idleInput` already lends `buf` and `head` via
`park`/`unpark` (`http1-server.ts:1003–1050`). Making it the default saves
about 1.3 KB per idle connection, at the cost of two pool operations per
request, and a lent buffer is not wiped (`docs/security/http1-codec.md`
~608). Flip it only if keep-alive throughput stays inside the noise band.
If you flip it, update its doc comment, the reference, the guide and the
security note. If you do not, record the measurement in
`bench/http1-conn/README.md`.

**The ceiling.** Pin a per-idle-connection byte figure in
`tests/runtime-budgets.js` next to `HTTP1_SERVER_START_BYTES`, checked by an
existing `net_http1_server` startup program. The figure must fail on the base
and pass on the branch.

## Stage hmac-digest-into

**Owns:** `std/crypto/hmac.ts`, `std/crypto/sha256.ts`,
`tests/link/crypto_hmac*/**`, `tests/link/crypto_sha256*/**`,
`tests/wipes/crypto.js`, `docs/security/crypto-k1.md`, `std/README.md` (the
hmac and sha256 rows), `docs/guide/using-nish/standard-library.md` (the crypto
sections only), `tests/nish-cmp.js` (DECLARED entries for this stage only),
and the generated `docs/reference/crypto/**` and `tests/self/goldens/checked/**`

`HmacSha256.digest` (`hmac.ts:279–287`) allocates two 32-byte arrays. One is
the inner digest, which is wiped and thrown away. The other is the returned
tag, which is the contract ("a fresh 32-byte tag, which the caller owns",
`:276`). The class is single-use: a second `digest` panics. Its callers are
handshake-time (`hkdfExpandSha256`, the one-shot `hmacSha256`); the hot paths
already use `HmacSha256Scratch` or `HmacKey`.

- `Sha256.digestInto(out, at)` writes into a caller's window, and
  `Sha256.digest` becomes `new Array(32)` plus `digestInto`. Same output, same
  wipes.
- `HmacSha256.digestInto(out, at)` checks the window and panics the way
  `HmacSha256Scratch.finishInto` does (`:682`). It writes the inner digest
  into a per-instance `u8[32]` allocated in the constructor and wiped right
  after use, then writes the tag from `outer` straight into `out`.
  `digest()` becomes one `new Array(32)` plus `digestInto`. Never return or
  reuse an internal buffer as the tag.
- `HmacSha256Scratch.finishInto` can now use `Sha256.digestInto` as well,
  which drops its two transient arrays. Do it if it is a small change.
- This is `std/crypto`. Follow CLAUDE.md "Security": wipe every
  intermediate, add the new call sites' counts to `tests/wipes/crypto.js`, and
  keep the `crypto_hmac` read-backs that check both hashers are zero after a
  digest. Update the K1-7 row in `docs/security/crypto-k1.md`.
- New public declarations get a doc comment, `@param` and `@returns`
  (`scripts/gen-reference.mjs --check`).

## Merge order and shared files

- `sqlite-busy-pin` is independent of the other two stages.
- `http1-idle-conn` and `hmac-digest-into` run at the same time, and **merge
  in that order**. Both add DECLARED lines to `tests/nish-cmp.js` and edit
  different sections of `docs/guide/using-nish/standard-library.md`, so the
  second may need a textual merge. Both regenerate `tests/self/goldens/checked/`
  (the `examples/file-server.ts.txt` golden names both modules). The
  generated-file rule therefore makes `hmac-digest-into` update from `main`
  and regenerate before it merges. No stage depends on another's code.
