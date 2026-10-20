---
name: WP44 design note — name resolution for nish:net
overview: Write docs/wp44-name-resolution.md for issue 479, weighing getaddrinfo in runtime-net.c, a DNS stub resolver in std/net/dns, and both, against the capability, blocking and WASI questions, and recommend one. A note only — nothing is implemented.
stages:
  - id: note
    title: "docs: WP44, name resolution for nish:net — getaddrinfo, a stub resolver, or both"
    goal: A proposed WP44 note that compares the three options on capability, blocking and WASI, recommends one with its reasons, and is indexed in both design-note tables
    verification: node docs/check-links.mjs && npm run lint && test -z "$(git diff --name-only origin/main...HEAD | grep -vxE "docs/(wp44-name-resolution|README|MASTER_PLAN)\.md")"
    todos:
      - id: facts
        content: Ground every claim in the tree at a named commit, with file:line anchors — see Note → What it has to rest on
      - id: options
        content: Write one section per option (getaddrinfo, stub resolver, both) covering capability, blocking and WASI — see Note → The three axes
      - id: table
        content: Add the 3×3 comparison table, one row per option and one column per axis, no empty cell — see Note → Shape
      - id: decide
        content: Decide and state one recommendation, with the reasons tied to the axes and what would change the answer — see Note → The recommendation
      - id: fixed-reqs
        content: State how the recommended shape meets the issue's fixed requirements and acceptance — see Note → Requirements every shape keeps
      - id: stages
        content: Sketch the recommended shape's later implementation stages and what stays out, without building any — see Note → Shape
      - id: index
        content: Add the WP44 row to the docs/README.md design-notes table and to MASTER_PLAN.md §5 as proposed — see Note → Indexing
---

## Context

[Issue #479](https://github.com/amritk/nish/issues/479): `nish:net` has no name resolution. `netAddress` answers `-22` for a name ([LANGUAGE.md:6783](../../docs/LANGUAGE.md)) and the "Not yet" bullet says so ([LANGUAGE.md:7025](../../docs/LANGUAGE.md)); [`reject_net_unknown_export`](../../tests/cases/reject_net_unknown_export.ts) imports `dnsLookup` and expects it refused. The relay works around it by mapping `localhost` by hand ([relay README:99](../../examples/relay/README.md)). Postgres, Resend and the TLS client role (WP34 N13, [wp34:141](../../docs/wp34-hosting-cs.md)) all need it. The issue asks for a short design note weighing three shapes and choosing one. Design notes here are `docs/wp*.md`; WP37 is reserved and WP43 is the latest, so this is **WP44**.

## Note

One file, [`docs/wp44-name-resolution.md`](../../docs/wp44-name-resolution.md), status **Proposed**, modelled on [wp42-multicore-server.md](../../docs/wp42-multicore-server.md) (header naming the issue and the commit its anchors are at, numbered sections, a "not in this work package" section). Aim for wp42's length or shorter — the issue asks for a short note.

### What it has to rest on

Facts found in the tree at `c8a00d6` that the note must engage with. Re-check each at the head you write against; quote the anchor, not this list.

| Fact | Anchor |
| --- | --- |
| `runtime-net.c` is non-blocking from creation (`SOCK_NONBLOCK`, `accept4`, EINPROGRESS connect); epoll / kqueue; no resolver, only `inet_pton` | `runtime/runtime-net.c:111-119,158-163,281,306` |
| The program owns its loop through `poll*`; no async, no callbacks, no timer but `pollWait`'s timeout | `LANGUAGE.md:7035-7060`, `wp24-async.md:27-39` |
| UDP (`udpSendTo` / `udpRecvFrom`) and `tcpConnect` exist, so a stub resolver can be written in Nish today | `LANGUAGE.md:6872-6900`, `runtime-net.c:354-460` |
| No `nish:net` call may run in a `scope()` task or parallel body, so a blocking call cannot be pushed to the pool | `LANGUAGE.md:7008-7015`, `reject_net_task` and siblings, `wp42:24-35` |
| Capabilities are compile-time labels on builtins (WP35); WP36 refuses at compile time with NL2459; nothing is enforced at run time until WP37 | `wp35-capabilities.md` §2, `wp36-capability-policy.md:1-12` |
| Reading `/etc/resolv.conf` or `/etc/hosts` from Nish is `readFileBytesSync`, i.e. `fs.read` | `LANGUAGE.md:8170` |
| There is no host or address allow-list; "which host is dialled" is out of scope | `wp35-capabilities.md:131-132`, `wp36` §6 |
| Every `nish:net` call is refused on wasm32 and `--profile wasi` (NL2404); `runtime-net.c` is empty under `__wasi__`; `--profile wasm` links host IR and fails at link instead | `src/builtins.ts:93`, `LANGUAGE.md:7017-7024`, `runtime-net.c:45-47` |
| N9 is WP34's never-exit rule: pools sized at start-up, nothing allocated per packet, `Arena.used()` flat in a soak; caller-owned buffers are a separate `runtime-net.c` rule | `wp34-hosting-cs.md:233-262`, `runtime-net.c:20-22` |
| Untrusted-parser precedent: security record shape and the fixed-seed mutant fuzzer | `docs/security/router.md`, `tests/link/std_json_tokenizer/fuzz.ts`, `docs/security/json.md:181-184` |

Two things the note must check for itself and say it checked (or say it could not): what glibc's and musl's `getaddrinfo` do under a static link (NSS modules loaded by `dlopen`, the files they read), and what wasi-libc offers for sockets and `getaddrinfo` on the preview the wasi profile targets. Claims from general knowledge are marked as such.

### The three axes

Each option section answers all three, concretely:

- **Capability.** What label the WP35 report would show and whether it would be honest: a C `getaddrinfo` reads `/etc/hosts`, `/etc/nsswitch.conf`, `/etc/resolv.conf` and may load shared objects, none of which the walk sees; a Nish stub that reads `/etc/resolv.conf` itself reaches `fs.read` too, so a `--allow net` program is refused. Say how each shape keeps the report true (a new label, `net` widened in LANGUAGE.md's table, resolvers passed in by the caller, …) and what it means for WP37's future sandbox (which files and sockets the confined process then needs).
- **Blocking.** What happens to a program that owns its loop: `getaddrinfo` stalls every connection for the resolver's timeout and cannot be moved to a task; a stub resolver is a socket in the same `pollWait`. Cover timeouts and retries with only `pollWait`'s timer, TCP fallback on truncation, and whether "start-up only" can be enforced or only documented.
- **WASI.** wasm32 and `--profile wasi` refuse `nish:net` today (NL2404) and the `--profile wasm` route fails at link. Say what each shape adds or leaves unchanged there, and whether a pure-Nish response parser and query builder (no sockets) are usable on wasm32 on their own.

### Shape

- An opening section that states the choice and the recommendation in a paragraph.
- One section per option, each covering the three axes above.
- A comparison table: rows getaddrinfo / stub resolver / both, columns capability / blocking / WASI, no empty cell.
- The recommendation (below), then the implementation stages it implies as a numbered sketch — the new exports or `std/` module, the `reject_net_unknown_export` change, the tests, the security record — each a later PR, none built here.
- A "Not in this work package, on purpose" section.

### The recommendation

Exactly one of the three, under its own heading, with the reasons tied to the axes, the cost it accepts (for a stub resolver: no `nsswitch`, `/etc/hosts` handled or not; for `getaddrinfo`: a blocking call and a capability the walk cannot see; for both: two code paths and two answers to the same name), and what evidence would change it. The note's author makes this call from the facts; the plan does not pre-decide it.

### Requirements every shape keeps

From the issue, stated for the recommended shape: answers carry TTLs; A and AAAA both; a bound on the answers kept; DNS responses are untrusted input with a `docs/security/` record planned (name compression loops, pointer bounds, counts against length, ID and question matching, the source address checked); the `net` capability; N9 (pools sized at start-up, caller-owned buffers, no per-query allocation). And the issue's acceptance as the plan for its tests: `localhost`, a name in a test-local zone served by a Nish DNS server over loopback so CI needs no network, and a fuzz pass over the response parser on the `std_json_tokenizer` pattern.

### Indexing

- [`docs/README.md`](../../docs/README.md) "Design notes" table: a WP44 row after WP43, beginning "Proposed."
- [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md) §5 table: `| 44 | … | proposed | [wp44](wp44-name-resolution.md) |` after row 43.

**Owns:** `docs/wp44-name-resolution.md`, `docs/README.md`, `docs/MASTER_PLAN.md`

## Out of scope

- Any code: no change to `src/`, `std/`, `runtime/`, `tests/`, or `docs/LANGUAGE.md` (normative; it changes when the feature lands). `reject_net_unknown_export` stays as it is.
- The user guide: nothing a user sees changes.
- WP37's sandbox design, beyond what the recommendation needs from it.

## Tests

None added — a note changes no behaviour. The note's own test plan is in "Requirements every shape keeps".

## Verification

- `node docs/check-links.mjs` — every relative link and anchor in the note and the two index rows.
- `npm run lint` — file names and Biome.
- The diff touches only the three owned files: `git diff --name-only origin/main...HEAD`.
- Per AGENTS.md, `npm test` once, undegraded, before the PR opens; CI runs it on every push.
- Commit subject is the stage title (`docs:` type, so a patch bump); body is the changelog prose; `Refs: docs/wp44-name-resolution.md` and `Refs #479`, not `Fixes`: the issue stays open for the implementation.
