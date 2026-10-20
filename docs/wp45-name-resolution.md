# WP45: Name resolution for `nish:net`

**Status: proposed.** Nothing here is built. The anchors below are at
`c8a00d6`.

`nish:net` takes address literals only. `netAddress` answers `-22` for a name
("there is no DNS", `docs/LANGUAGE.md:6783`), the "Not yet" bullet says so
(`docs/LANGUAGE.md:7025`), and `reject_net_unknown_export` pins that
`dnsLookup` does not exist. The relay maps `localhost` by hand
(`examples/relay/README.md:99`), and the account service's Postgres and Resend
calls and the TLS client role (WP34 N13, `docs/wp34-hosting-cs.md:735`) all
need a name. Issue [#479](https://github.com/amritk/nish/issues/479) asks for
a short note that weighs three shapes and chooses one:

- **`getaddrinfo`** in `runtime/runtime-net.c`;
- **a DNS stub resolver** in `std/net/dns`, over the UDP and TCP calls
  `nish:net` already has;
- **both**, a blocking call for start-up and the stub resolver for the loop.

**The recommendation is the stub resolver alone** (§5): it is the only shape
that keeps a program that owns its loop from stalling, the only one whose
capability report is true without a new rule, and the only one whose parser
is usable on wasm32. It gives up `nsswitch`, which §5 prices.

## 1. What every shape has to fit

**The program is the loop.** Every socket is non-blocking from creation
(`SOCK_NONBLOCK` and `accept4`, `runtime/runtime-net.c:158-163,281`; a
connect answers `EINPROGRESS`, `:306`), and the program waits in
`pollWait`, epoll or kqueue (`docs/LANGUAGE.md:6917`). There is no `async`, no
callback (`docs/LANGUAGE.md:6765-6770`, `docs/wp24-async.md:27-39`), and no
timer but `pollWait`'s timeout (`docs/LANGUAGE.md:7025-7027`).

**Nothing blocking can move to a thread.** No `nish:net` call may run in a
`scope()` task or a parallel body (`docs/LANGUAGE.md:7008-7016`;
`reject_net_task` and five siblings). A blocking resolve therefore runs on the
loop's own thread or not at all.

**A stub resolver can be written in Nish today.** `udpBind`, `udpSendTo` and
`udpRecvFrom` (`docs/LANGUAGE.md:6870-6872`, `runtime/runtime-net.c:354-460`)
and `tcpConnect` (`:298-306`) are what one needs. The runtime itself resolves
nothing: its only parser of a host is `inet_pton` (`:111-119`).

**Capabilities are labels on builtins.** Every `nish:net` export is `net`
(`docs/LANGUAGE.md:8174`), reading a file is `fs.read` (`:8172`), and
`crypto.getRandomValues` is `entropy` (`:8168`). WP36 refuses at compile time
(NL2459) what a policy does not grant (`docs/wp36-capability-policy.md:1-12`);
nothing is enforced at run time until WP37's sandbox. Which host is dialled is
out of scope for both (`docs/wp35-capabilities.md:132`,
`docs/wp36-capability-policy.md:96-103`), so there is no allow-list a resolver
must answer to.

**wasm32 has no sockets.** Every `nish:net` call is refused on a wasm32 target
and the `wasi` profile with NL2404 (`src/builtins.ts:88-95`,
`docs/LANGUAGE.md:7017-7024`), `runtime-net.c` is empty under `__wasi__`
(`runtime/runtime-net.c:45-47`), and `--profile wasm` links host IR and fails
at the link instead. The `wasi` profile is `--target=wasm32-wasi`, WASI
preview 1 (`scripts/build.sh:433`).

**N9 holds.** State lives in pools sized at start-up, nothing allocates per
packet, and `Arena.used()` is flat in a soak (`docs/wp34-hosting-cs.md:233-262`);
`runtime-net.c` allocates nothing and writes only the caller's arrays
(`runtime/runtime-net.c:22-23`).

## 2. `getaddrinfo` in `runtime-net.c`

**Capability.** The call would be a `nish:net` export, so the report would say
`net`, and that would not be true. Checked on this container (Ubuntu glibc
2.39, `strace` of a program that resolves `localhost`): `getaddrinfo` opens
`/etc/host.conf`, `/etc/resolv.conf`, `/etc/nsswitch.conf` and `/etc/hosts`,
tries `nscd`'s Unix socket twice, and opens a netlink socket, dynamically and
under `-static` alike. Native builds link glibc dynamically (`scripts/build.sh`
passes no `-static`). A static link warns that
`getaddrinfo` "requires at runtime the shared libraries from the glibc version
used for linking", which is NSS: *general knowledge*, an `nsswitch.conf` that
names a module beyond `files` and `dns` (`mdns4`, `resolve`, `ldap`) makes
glibc `dlopen` a shared object and run its code in the process,
foreign code the walk cannot see. musl, *general knowledge*, has no NSS: it reads
`/etc/hosts` and `/etc/resolv.conf` and speaks DNS itself. Keeping the report
true would mean labelling the export `net` and `fs.read` and `ffi`, a builtin
with three labels where each carries exactly one
(`docs/LANGUAGE.md:8158`), or widening `net`'s row
in LANGUAGE.md to "and whatever the C library reads". For WP37's sandbox, the
confined process would then need read access to four files, a Unix socket and,
through `nsswitch.conf`, an open set of shared objects.

**Blocking.** `getaddrinfo` returns when the resolver does: with
`resolv.conf`'s defaults, *general knowledge*, 5 s per try and two tries per
server. Every connection the loop holds waits that long, and the call cannot
move to a task (§1). "Start-up only" could be documented and not enforced: the
checker has no notion of start-up, and a call in a request handler compiles
the same. glibc's `getaddrinfo_a` (*general knowledge*) answers on a thread of its own by a signal
or a callback, neither of which the language has.

**WASI.** Unchanged: refused with NL2404 like every other export. *General
knowledge*: wasi-libc on preview 1 has no `getaddrinfo`, and preview 1 has no
way to make a socket; preview 2's `wasi:sockets/ip-name-lookup` has one, but
the `wasi` profile is preview 1 (§1). Nothing becomes usable on wasm32.

## 3. A stub resolver in `std/net/dns`

**Capability.** The resolver's socket calls are `nish:net`, so it reaches
`net`. The two other things a stub resolver needs each reach a label of their
own, and the report says so: reading `/etc/resolv.conf` or `/etc/hosts`
(`readFileBytesSync`) is `fs.read`, and a query ID hard to guess is `entropy`.
The shape keeps both out of the resolver's own body. The resolver takes its
name servers from the caller, as addresses; a separate parser turns the bytes
of a `resolv.conf` or a `hosts` file into them, and the program reads the file
itself, at start-up, under its own `fs.read`. IDs come from
`crypto.getRandomValues`, so the resolver reports `net` and `entropy`, and a
program granted `net` alone is refused for the second, truly. For WP37 the
confined process needs UDP and TCP to the servers it was given and, only if it
reads them, the two files.

**Blocking.** A query is a non-blocking UDP socket in the caller's `pollWait`,
with its token. The resolver keeps a deadline per query and reports the
nearest one, so the caller passes `min(its own, the resolver's)` as
`pollWait`'s timeout and hands the resolver the time on each wake. It reads no
clock itself, so it reaches no `clock`. A timeout retries on the next server,
and a reply with the TC bit set retries over `tcpConnect` with a two-byte
length prefix, a second socket in the same loop. No path waits.

**WASI.** The resolver is refused on wasm32 like any `nish:net` caller. The
DNS message code is not: building a query and parsing a reply are pure Nish
over `u8[]`, with no builtin that reaches the operating system. Kept in a
module apart from the socket code, they compile on wasm32, under the `wasi`
profile and under `--profile wasm`, for a host that does its own transport.

## 4. Both

**Capability.** The union: the `getaddrinfo` export inherits §2's report
problem whole, and the stub resolver is §3.

**Blocking.** The stub resolver keeps the loop free; the blocking call stalls
it whenever it is called, and nothing keeps it at start-up (§2). A program
gains nothing it could not do with the stub resolver before its loop starts:
resolve, wait in a `pollWait` of its own, then serve.

**WASI.** The same as §3: the message code is usable, the rest refused.

The cost particular to this shape is two answers to one name. `getaddrinfo`
honours `/etc/hosts` and `nsswitch` and the stub resolver does not, so a name
can resolve at start-up and fail, or resolve elsewhere, on the loop. Two code
paths double the tests and the security surface.

## 5. The recommendation: the stub resolver alone

| Shape | Capability | Blocking | WASI |
| --- | --- | --- | --- |
| `getaddrinfo` | reported `net`; reads four files, a Unix socket and NSS modules the walk cannot see | stalls the loop up to the resolver's timeout; cannot move to a task; start-up only by convention | refused, NL2404; no `getaddrinfo` in preview 1 |
| Stub resolver | `net` and `entropy`, true; files read by the caller under `fs.read` | a socket in the caller's loop; deadlines through `pollWait`'s timeout; TCP on truncation | resolver refused; message code usable on wasm32 |
| Both | the union, with `getaddrinfo`'s hidden reads | the loop stalls whenever the blocking half is called | as the stub resolver |

On each axis the stub resolver is as good or better: it is the only shape
that never blocks the loop, the only one whose labels say what it reaches
under WP35's rules as they are, and the only one with a part that runs on
wasm32. "Both" adds the blocking half's problems and a second answer, for no
capability the stub resolver lacks.

**What it costs.** No `nsswitch`: names served only by an NSS module
(mDNS, LDAP, `nss-resolve` with no stub listener on `127.0.0.53`) do not
resolve. `/etc/hosts` is honoured only when the program reads it and hands
the entries over. `localhost` is answered by the resolver itself as loopback,
as RFC 6761 §6.3 allows, so the issue's first case needs no file and no
packet. The resolver is also code to keep secure (§6).

**What would change it.** A deployment target whose names resolve only through
NSS, or a measured need for `getaddrinfo`'s exact answers. Even then the
answer would be the blocking call as an `ffi` binding a program declares
itself, labelled `ffi` truly, rather than a `nish:net` export.

## 6. Requirements the stub resolver keeps

From #479, for this shape:

- **TTLs.** Each answer carries its TTL, the smallest in its RRset; the
  resolver caches nothing, and a program that keeps an answer keeps its TTL.
- **A and AAAA.** One query of each per name, both in flight at once, the
  answers into one caller-owned array of 18-byte addresses (the
  [address form](LANGUAGE.md#the-address-form)) with the port the caller asked
  for.
- **A bound.** The answers kept per name are capped at a constant (eight, to
  be confirmed in stage 1); the rest are dropped and counted. The queries in
  flight are a pool sized at construction.
- **Untrusted input.** The parser bounds every pointer by the message length,
  follows a compression pointer only backwards and caps the hops, checks each
  count against the bytes left, matches the reply's ID and question to the
  query, and drops a reply whose source is not the server's address and port.
  A `docs/security/dns.md` record, in the shape of the others
  ([docs/security/README.md](security/README.md)), lists each of these with
  the test that pins it.
- **The `net` capability**, with `entropy` beside it (§3), pinned by a
  `caps_` case.
- **N9.** The query pool and the receive buffers are sized at start-up and
  owned by the caller; a query allocates nothing.

The issue's acceptance is the plan for the tests: `localhost` without a
packet; a name in a test-local zone, served by a DNS server written in Nish
on loopback so CI needs no network, over UDP and, for a truncated reply,
TCP; and a seeded mutant fuzz over the response parser on the pattern of
`tests/link/std_json_tokenizer/fuzz.ts` (fixed seed, totals pinned, no panic,
bounded work per byte; `docs/security/json.md:181-184`).

## 7. Stages

Each is a later pull request; none is built here.

1. **`std/net/dns-message.ts`** (`nish/net/dns-message`): a query builder and
   a bounded response parser over caller-owned arrays, with no `nish:net`
   import, so it compiles on wasm32. Unit tests, the fuzz pass, the wasm32
   build of a case that uses it, and `docs/security/dns.md`.
2. **Configuration parsers** in the same module: the `nameserver` lines of a
   `resolv.conf` and the entries of a `hosts` file, each from bytes the caller
   read.
3. **`std/net/dns.ts`** (`nish/net/dns`): the resolver on the caller's loop,
   UDP with TCP on truncation, deadlines through the caller, `localhost`
   locally. The loopback DNS server in `tests/link`, a `caps_` case, and a
   soak with `Arena.used()` flat.
4. **The docs.** `netAddress`'s row and the "Not yet" bullet in LANGUAGE.md
   point at `nish/net/dns`, with a cookbook entry and a guide page. The
   comment in `reject_net_unknown_export` says why `dnsLookup` is still not a
   `nish:net` export; the case itself stays, since the export still does not
   exist.

## 8. Not in this work package, on purpose

- `getaddrinfo`, NSS, and an `ffi` route to either (§5).
- `search` domains and `ndots`: names are absolute. A deployment that needs
  short names, as a Kubernetes service does, adds them later.
- A shared cache, DNSSEC validation, DNS over TLS or HTTPS, and mDNS.
- Racing the addresses of a name (Happy Eyeballs): the caller connects.
- A DNS server in `std/`: the one the tests need lives in `tests/link`.
- WASI preview 2's sockets, and WP37's sandbox beyond what §3 says it needs.
