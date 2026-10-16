---
name: HTTP benchmark — a JSON request body, and the cross-runtime twins in the repo
overview: Land the HTTP/1.1 load-test server and runner that exist only on an unmerged branch, add a POST /json-echo scenario that parses a 545-byte body with std/json, commit eight comparison servers that answer the same bytes, and publish one interleaved, noise-banded measurement of all of them in bench/README.md.
stages:
  - id: land-h1-bench
    title: "perf(std): land the HTTP/1.1 load-test server and its two keep-alive wins"
    goal: Bring branch claude/quirky-thompson-47e7tp (bench/http1-server.ts, bench/http.mjs, the recv/send and output-pool changes to std/net/http1-server.ts) onto main through a reviewed PR.
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/self/goldens.js && npm test
    todos:
      - id: h1-take-branch
        content: Start the stage branch from claude/quirky-thompson-47e7tp and merge main into it — see Land the HTTP/1.1 bench
        status: pending
      - id: h1-regen-goldens
        content: Regenerate tests/self/goldens with node tests/self/goldens.js --update, never by hand — see Land the HTTP/1.1 bench
        status: pending
      - id: h1-reanchor-record
        content: Re-anchor docs/security/http1.md rows the branch rewrote to the commit their anchors are at — see Land the HTTP/1.1 bench
        status: pending
      - id: h1-reverify
        content: Re-time the two perf claims against a byte-identical copy on the merged head and put the figures in the commit body — see Land the HTTP/1.1 bench
        status: pending
  - id: nish-json-echo
    title: "feat(bench): POST /json-echo, a JSON request body through std/json"
    goal: The Nish load-test server reads a 545-byte JSON body, decodes it two ways, bumps one field and writes it back with JsonWriter; bench/http.mjs times it and checks every server's bytes before timing.
    verification: npm run check && npm run lint && node tests/run.js bench && build/nish bench/http1-server.ts --link build/bench/h1 && node bench/http.mjs --rounds 1 --duration 2 --only post-json build/bench/h1
    todos:
      - id: echo-payload
        content: Add bench/http-payload.json with the contract bytes — see Request-body contract
        status: pending
      - id: echo-typed
        content: Add POST /json-echo to bench/http1-server.ts via jsonDecode into an Order class and jsonEncode back — see Nish json-echo
        status: pending
      - id: echo-doc
        content: Add POST /json-echo-doc via JsonDocument parse, set and write — see Nish json-echo
        status: pending
      - id: echo-lua
        content: Add bench/http-post-json.lua (wrk POST script reading the payload) — see Nish json-echo
        status: pending
      - id: echo-runner
        content: Add post-json and post-json-doc scenarios, the name=path server spec, the byte pre-check and n/a cells to bench/http.mjs — see Runner changes
        status: pending
  - id: twins
    title: "feat(bench): the cross-runtime HTTP twins under bench/http-twins"
    goal: Eight comparison servers on the latest stable releases, each one core, answering /plaintext, /json and /json-echo with the Nish server's bytes, with a README, build script, conformance check and runner.
    verification: bash bench/http-twins/build.sh && node bench/http-twins/check.mjs && test -z "$(git status --porcelain bench/http-twins)"
    todos:
      - id: twin-node
        content: Add node-http (node:http) and uws (uWebSockets.js on Node) — see Twins
        status: pending
      - id: twin-bun
        content: Add bun (Bun.serve) — see Twins
        status: pending
      - id: twin-go
        content: Add go-nethttp and go-fasthttp — see Twins
        status: pending
      - id: twin-rust
        content: Add rust-hyper and rust-actix — see Twins
        status: pending
      - id: twin-nginx
        content: Add nginx (return, one process, /json-echo answered 404) — see Twins
        status: pending
      - id: twin-tooling
        content: Add build.sh, check.mjs, run.sh, .gitignore and README.md with pinned versions and build steps — see Twins tooling
        status: pending
  - id: measure
    title: "docs(bench): every HTTP server through every scenario, interleaved"
    goal: One interleaved run of Nish (twice, for the noise band) and the eight twins through every scenario, written into bench/README.md's HTTP section with versions and the machine.
    verification: node docs/check-links.mjs && npm run lint && grep -c 'json-echo' bench/README.md
    todos:
      - id: measure-run
        content: Build everything per bench/http-twins/README.md and run bench/http-twins/run.sh at 5 rounds x 5 s — see Measurement
        status: pending
      - id: measure-write
        content: Replace the cross-runtime table in bench/README.md's HTTP section with the new one, the noise band, versions, machine and the Date-header note — see Measurement
        status: pending
---

# HTTP benchmark: a JSON request body, and the twins

## Context

`bench/http1-server.ts` and `bench/http.mjs` (wrk; server pinned to CPU 0, wrk to the rest; rounds interleaved a b … b a) exist only on branch `claude/quirky-thompson-47e7tp`, two commits ahead of an older `main` with no PR. That branch also carries two perf commits to [std/net/http1-server.ts](std/net/http1-server.ts) (one recv and one send per keep-alive request; slots borrow output from an `Http1OutputPool`) and their tests, docs and regenerated `checked.txt`. Its bench/README.md HTTP section has a cross-runtime table (hyper, nginx, Bun, Go, Node) from servers that are not in the repo. Nothing parses a request body.

## Approach

- **One stage lands the prerequisite** rather than rebuilding it: it is finished, measured work, and the json-echo stage edits its files.
- **The Nish server is the reference.** A twin is correct when its bytes equal the Nish server's. The body bytes are fixed here (Request-body contract) so the twins stage can be written in parallel with the Nish stage.
- **One runner.** The twins are driven by `bench/http.mjs`, not a second load-test script: each twin has a `serve` launcher that takes `<port>` and prints `listening <port>`, the same contract the Nish binary already meets, so pinning, interleaving and the spread are computed by one piece of code for everyone.
- **nginx sits out json-echo.** `return` cannot parse a body; nginx answers `/json-echo` with 404 and its cell reads n/a. Its `/json` uses `$connection_requests` for `n` (same shape, per-connection count) — noted beside the table.
- **Noise band.** The Nish binary runs twice (`nish` and a byte-identical copy `nish-copy`) in the same interleaved rounds; the spread between the two is the band every other delta is read against.

## Request-body contract

`bench/http-payload.json`, 545 bytes, no trailing newline, ASCII only, no characters any encoder escapes (`<` `>` `&` `/`, non-ASCII), and no integer-valued floats:

```json
{"id":1048576,"revision":7,"name":"order-2026-10-16-0042","customer":{"id":90211,"name":"Ada Lovelace","email":"ada@example.com","verified":true},"currency":"CAD","total":129.95,"items":[{"sku":"KB-104","name":"Mechanical keyboard","qty":1,"price":89.5},{"sku":"MS-220","name":"Wireless mouse","qty":2,"price":19.95},{"sku":"PD-007","name":"Desk pad","qty":1,"price":0.55}],"tags":["web","priority","gift"],"shipping":{"method":"ground","street":"12 Analytical Way","city":"Vancouver","region":"BC","postal":"V6B 1A1"},"notes":null,"paid":false}
```

The request is `POST /json-echo` with `Content-Type: application/json` and `Content-Length: 545`. The response is `200`, `Content-Type: application/json`, and the body is the payload byte for byte with `"revision":7` replaced by `"revision":8` — key order kept, compact, numbers in shortest round-trip form. Every server decodes into a typed structure (class / struct) except where noted, increments `revision`, and re-encodes; none may splice bytes.

`GET /plaintext` → `Hello, World!` (`text/plain`). `GET /json` → `{"message":"Hello, World!","n":<requests answered so far>}` as the Nish server writes it today.

## Land the HTTP/1.1 bench

**Owns:** `bench/http1-server.ts`, `bench/http.mjs`, `bench/README.md`, `std/net/http1-server.ts`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, `docs/security/http1.md`, `knip.json`, `tests/link/net_http1_server/**`, `tests/link/net_http1_server_f64/**`, `tests/self/goldens/**`

- Check out `claude/quirky-thompson-47e7tp` (commits `1a76901a`, `27052265`) as the stage branch, `bash scripts/fetch-seed.sh --force`, merge `origin/main` (a merge, not a rebase), resolve, regenerate the goldens with `node tests/self/goldens.js --update` and read the diff.
- `docs/security/http1.md`: rows the branch rewrote name the commit their `file:line` anchors are at (CLAUDE.md, Security).
- `std/` changed, so run `node tests/run.js wasi` and `node tests/run.js performance` before pushing (CLAUDE.md).
- Re-run `node bench/http.mjs` on the merged head against main's build and a byte-identical copy; the PR title is the conventional subject above and the PR body is the changelog prose with `Measured:` figures from this head, the noise band included.

## Nish json-echo

**Owns:** `bench/http1-server.ts`, `bench/http-payload.json`, `bench/http-post-json.lua`, `bench/http.mjs`, `knip.json`. **Starts after land-h1-bench merges** (its files exist only there).

- Read the body through the `H1_BODY` events into one buffer the slot reuses (no per-request allocation once warm — the server's existing rule); answer at `H1_END`. A body over 4 KiB is answered 413.
- `/json-echo`: `class Order` (and `Customer`, `Item`, `Shipping`) mirroring the payload, `notes: string | null`; `jsonDecode` from `nish/json-typed`, `revision += 1`, `jsonEncode` onto a `JsonWriter` reset onto one buffer per request. If `JsonWriter.f64` does not print `129.95`, `89.5`, `19.95`, `0.55` in shortest form, use `JsonNumber` for those fields and say so in a comment.
- `/json-echo-doc`: `JsonDocument.parse`, `set` the `revision` member to `newNumber(8)` (read + 1), `write` with the same `JsonWriter`. The document is reused across requests (`clear`).
- Both answer the exact contract bytes; a malformed body answers 400.
- `bench/http-post-json.lua`: sets `wrk.method`, `wrk.body` (read from the file in env `NISH_HTTP_PAYLOAD`, default `bench/http-payload.json`) and the content type.

## Runner changes

In `bench/http.mjs` (Nish json-echo stage):

- Scenarios gain `post-json keep-alive c=256` (`/json-echo`) and `post-json-doc keep-alive c=256` (`/json-echo-doc`), run through the Lua script.
- A server argument may be `name=<path>`; the label is `name`. A bare path keeps today's basename label.
- Before a server's first timed round in a scenario, one request checks its response: status and body against the contract (plaintext exact, json by pattern, json-echo exact). 404 makes every cell of that server in that scenario `n/a`; any other mismatch exits 1 naming the server, scenario and first differing byte.

## Twins

**Owns:** `bench/http-twins/**`. Runs alongside the two stages above; **merges after nish-json-echo** (its check and runner use `bench/http-payload.json` and the runner's `name=path`). Until then, test against the contract bytes from this plan via `check.mjs --payload <file>`.

| dir | stack (latest stable at build time, exact version pinned) | one core |
| --- | --- | --- |
| `node-http` | Node 26 `node:http` | one process |
| `uws` | uWebSockets.js (GitHub tag) on the newest Node it ships a binary for | one loop |
| `bun` | `Bun.serve` | one process |
| `go-nethttp` | Go `net/http`, `encoding/json` | `GOMAXPROCS=1` |
| `go-fasthttp` | `valyala/fasthttp`, `encoding/json` | `GOMAXPROCS=1` |
| `rust-hyper` | hyper 1.x + tokio current-thread, serde_json | current-thread runtime |
| `rust-actix` | actix-web 4.x, serde_json | `workers(1)` |
| `nginx` | nginx stable, `return` | `worker_processes 1`, `master_process off`, `daemon off` |

- Each dir has an executable `serve` taking `<port> [ignored...]`, printing `listening <port>` on stdout once bound, serving `127.0.0.1:<port>`, exiting on SIGINT. `n` for `/json` counts requests in the process.
- Lockfiles are committed (`package-lock.json` / `bun.lock`, `go.sum`, `Cargo.lock`); toolchain versions are pinned in README and, where the tool reads one, a file (`go.mod` `toolchain`, `rust-toolchain.toml`, `.node-version`).
- No `/json-echo-doc` route: 404.

## Twins tooling

- `bench/http-twins/build.sh [name...]`: builds into `build/http-twins/<name>/` (under the already-ignored `build/`); fetches nothing it has not pinned.
- `bench/http-twins/.gitignore`: `node_modules/`, `target/`, any in-tree build output, so `git status --ignored` shows only ignored products after a build.
- `bench/http-twins/check.mjs [--payload file] [name...]`: starts each built twin and the Nish server if `build/bench/h1` exists, sends the three requests, compares bodies and content types byte for byte, exits non-zero on any mismatch.
- `bench/http-twins/run.sh [http.mjs args]`: builds the Nish server and a byte-identical copy, then `node bench/http.mjs` with `nish=… nish-copy=…` and every twin as `name=build/http-twins/<name>/serve`. Same pinning for all, because it is the same runner.
- `bench/http-twins/README.md`: what each twin is, exact versions, how to install each toolchain on Ubuntu (wrk and nginx included), build, check, run; that build products stay out of git.

## Measurement

**Owns:** `bench/README.md`. **Starts after all three stages merge.**

- Fresh session; install toolchains per the twins README; `bash bench/http-twins/build.sh && node bench/http-twins/check.mjs` green first.
- `bash bench/http-twins/run.sh --rounds 5 --duration 5`, every scenario, both Nish copies in the interleave. Keep the raw output in the PR body.
- In bench/README.md's HTTP section, replace the cross-runtime table: rows are scenarios (including `post-json` and Nish's `post-json-doc`), columns are servers, cells median req/s with the spread, plus peak RSS. State the noise band (nish vs nish-copy) and read every claim against it. List versions and the machine (`lscpu` model, vCPUs, kernel, clang, wrk, `-t`). Next to the table: **the Nish server sends no `Date` header and every twin does**; nginx's json-echo is n/a and why; nginx's `/json` `n` is per connection.
- Remove the paragraph saying the comparison servers are not in the repo, if any, and link `bench/http-twins/README.md`.

## Out of scope

- Adding a `Date` header to the Nish server. HTTP/2 and HTTP/3. Multi-core runs. Any change to `std/json*`: a missing feature found there is reported in the PR, not built.
- A CI job that runs the twins (they need eight toolchains); CI keeps compiling `bench/http1-server.ts` only.

## Tests

- land-h1-bench: the branch's `tests/link/net_http1_server*` updates, unchanged in intent.
- nish-json-echo: `bench/http1-server.ts` compiles in the existing `bench:` checks if it is listed there (add it if a sibling list exists); the runner's pre-check is the byte test.
- twins: `check.mjs` is the conformance test.

## Verification

Per stage, the `verification` line above, plus `npm run check`, `npm run lint` and an undegraded `npm test` before the PR opens (CLAUDE.md, definition of done).
