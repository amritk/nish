# Security record: the PostgreSQL client

The record of `nish/net/postgres`, the sans-IO client side of PostgreSQL's
frontend/backend protocol 3.0 ([wp39-http-server.md](../wp39-http-server.md),
E6). It says what the client refuses from a server, and with what code, what a
server can make it hold or compute, where the password lives and when it is
wiped, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the database layer starts
from evidence.

Anchors are function names in `std/net/postgres.ts` at the commit that adds
connection targets (`pgTarget`, `pgTargetUrl`), the last to change it.

**Result.** Every message is framed once, by its length, and a length under 4
or over `maxMessage` fails the connection before its body is read; every
field inside a message is bounded by that message's end, so no backend bytes,
however malformed, make the client read past them or panic. A message the
protocol does not allow at that point, COPY among them, fails the connection.
A server can make the client hold about 3 × `maxMessage` bytes (the message
in its input buffer, and the copies kept as `lastError` and `lastNotice`) and
one row of `maxColumns` columns, and compute at most `maxIterations`
SCRAM iterations; a program can queue at most `maxOutput` bytes unsent. Every
recorded exchange cut at every byte offset, and 4000 seeded mutants of them,
end on a defined failure code without a panic. The server's SCRAM signature is compared in constant time
before an `AuthenticationOk` is believed, and an `AuthenticationOk` that skips
it is refused. The password is held as a `Secret<u8[]>` copy and wiped once
the proof is computed, or when the connection fails or is disposed, and every
SCRAM key is wiped, the hasher that makes StoredKey included. No finding is
open: PG-12 (ClientKey left in a hasher) and PG-13 (an unbounded send buffer)
were fixed in review, and PG-15 to PG-17 (a spent batch run that panicked,
a text key that failed its whole batch, and collidable keys) in the
batcher's. Three properties a reader might assume are not provided, by
design, and are recorded as accepted: no TLS (PG-9), no way to require SCRAM
of a server (PG-10), and MD5 and cleartext refused (PG-11). Two more are
accepted for a Unix socket target: nothing checks who owns the socket
(PG-21), and a host naming the socket file itself is taken as a directory,
as `libpq` takes it (PG-22).

`PgPool` reaches a server only through its connections: each pooled
connection is a `PgConnection` under the same caps, so a server can make the
pool hold at most `size` times what it can make one connection hold — about
3 × `maxMessage` bytes and one row of `maxColumns` columns per slot, at most
1024 slots. The pool's own state is bounded by the program (at most 1024
connections, a queue of at most 2^20 requests, 1024 groups in flight per
connection, 256 registered statements), with a `PG_POOL_FULL` answer in place
of growth. A server does reach the queue in one way: a connection that fails
before it is ready, while no other is, takes the oldest waiting request with
it as `PG_LOST`, so a server that refuses or drops every connection drains
the queue one request per connect, which the program must be ready to see.
A connection that fails reports each request it took as `PG_LOST` and is made
again on its next use. The pool holds one copy of the password until
`dispose`, and each connection its own until its proof is computed. A fresh
nonce for each `connect` and the sockets' lifetimes are the program's (see
Limits). It landed with this record extended, as the rule of #893 asks of
attacker-facing code.

`PgBatcher` reaches a server only through the connection a program hands it,
and adds one thing a server says that it acts on: the ordinal in each row's
last column, which picks the requests the row is routed to. It refuses an
ordinal that is NULL, not an integer, outside the keys it bound, or before
the key the last row was for, and fails the run rather than route the row,
so a server cannot hand one request's rows to another, nor make the helper
read past its arrays (PG-14). Its state is bounded by its config — at most
`queueSize` requests and `queueBytes` of text keys waiting, `runs` executions
of `maxRequests` requests each — all allocated in its constructor, so no
server answer makes it grow. A key refused for room, by `maxBytes` or by the
connection's `maxOutput`, is not a panic: the take stops there, cancels the
bind when nothing was bound, and the request waits.

`pgTarget` and `pgTargetUrl` turn a host and port, or a `postgres://` URL,
into the socket path or TCP host a program connects to; they open nothing.
The URL may come from a configuration file or an environment variable, so
its bytes are untrusted: every escape is checked, `%00` and a bare NUL are
refused, so a decoded path cannot end early at a NUL (PG-19), and a socket
path too long for `sun_path` is refused rather than cut to a shorter path
that names another socket (PG-18). Neither panics on any input (the seeded
URLs under "Properties verified").

## Scope

| File | Functions |
| --- | --- |
| `std/net/postgres.ts` | `PgConfig`; `PgError`; `PgPassword`; `PgConnection` (the constructor, `received`, `receive`, `sent`, `closed`, `dispose`, `next`, `compact`, `fail`, `passwordWiped`, `dispatch`, `reserveColumns`, `readRow`, `readDescription`, `readError`, `authenticate`, `scramStart`, `scramContinue`, `scramFinal`, the builders `prepare`, `closeStatement`, `bindStart`, the `param*` calls with `paramIntArray`, the array builder `arrayStart`, `arrayElement`, `arrayInt`, `arrayNull` and `arrayEnd`, `bindEnd`, `bindCancel`, `sync`, `terminate`, the output reservation and its compaction, and the row readers); `PgText`; `PgArrayWalker`; `PgPool` (the constructor, `register`, `request`, `waiting`, `inFlight`, `dispatch`, `send`, `wanted`, `connect`, `connection`, `next`, `anyReady`, `passwordWiped`, `dispose`) and `PgPoolSlot`; `PgBatchConfig`; `PgBatcher` (the constructor, `waiting`, `addInt`, `addText`, `takeDue`, `take`, `row`, `end`, `fail`, `next`, and the private helpers they call) and `PgBatchRun`; `PgBatchClockConfig`, `PgBatchClock` and `PgBatchTurns`, which take only the program's own times and counts, never a server's bytes; the helpers `pgCopyBytes`, `pgBytesOf`, `pgDecimalLength`, `pgHasNul`, `pgFind`, `pgBytesAre`, `pgSaltedPassword`, `pgSha256Wiped`, `pgScramKeys`; the connection targets `PgTarget`, `pgTarget` and `pgTargetUrl`, with their helpers `pgTargetFailed`, `pgDecoded` (which calls `urlDecode` from `std/net/url.ts`, audited in [url.md](url.md)) and `pgPortValue` |

Out of scope: the socket and loop the program owns (`nish:net`); the HMAC,
SHA-256, base64 and constant-time primitives the SCRAM exchange calls, which
are [crypto-k1.md](crypto-k1.md)'s; and what a program does with a column's
bytes.

## Threat model

The attacker is the server, or anyone on the network between it and the
client: there is no TLS, so every backend byte is theirs, of any length, split
anywhere. A win is a panic, a read or write outside the input or output
buffer, memory or time a server can make the client spend beyond the caps, a
connection that believes a server knows the password when it does not, a
password or key the client leaves in memory after it is done with it, or a
statement's parameters interpreted as SQL. The program's own clients are
attackers too, through the keys a program hands `PgBatcher`: a key reaches
the server only as an element of the bound array parameter, never in SQL
text, and a win for them is a panic, one client's key failing or reading
another's requests, or time a chosen key makes a take spend beyond its caps.
So is whoever wrote the URL `pgTargetUrl` reads: a win for them is a panic,
or a target other than the one the URL spells — a socket path cut short, or
one a decoded byte ended early. A local user who can create the socket a
target names is out of reach of a parser, and is PG-21.
The program is trusted: its
`PgConfig`, its SQL and its names. A NUL in a name or in SQL is refused rather
than sent; the program's mistakes that would leave the connection with no
defined state are panics, listed under "Panic sites".

The password's bytes are used as they are, without SASLprep (RFC 4013): an
ASCII password works, and a non-ASCII one only when it is already in the form
SASLprep would give. That costs a connection, never a secret, and is not a
finding; the guide says so.

## Findings

Rows PG-1 to PG-8 are the shapes a hostile server's bytes can take, each
checked and found to hold; they are recorded so that the audit can see what
was tried. PG-9 to PG-11 are accepted. PG-12 and PG-13 were found by the
first review of this module and fixed before it merged; PG-15 to PG-17 by the
batcher's first review, and fixed before it merged. PG-18 to PG-20 are the
shapes a URL can take, checked as the parser was written; PG-21 and PG-22
are accepted.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| PG-1 | High if it failed | `next`, `received`, `receive`, `compact` | A message's length must not make the client read past its buffer or hold more than `maxMessage`. | **Holds.** A length under 4 is `PG_ERR_FRAME`, one over `maxMessage` is `PG_ERR_TOO_BIG` before its body is read, and the input buffer grows by doubling to one message at most. `receive` panics on a window outside its source, as `received` does on a count past `inputRoom()`. A message split into 1-byte pieces frames the same as one whole. |
| PG-2 | High if it failed | `dispatch`, `readRow`, `readDescription`, `readError` | A field inside a message must not be read past the message's end: a column longer than its row, a length of `-2`, a string without its NUL, a count short of its fields. | **Holds.** Each is `PG_ERR_FRAME`; a row with bytes after its last column is too. |
| PG-3 | Medium if it failed | `readRow`, `readDescription`, `reserveColumns` | A row or description must not make the client allocate without bound. | **Holds.** Over `maxColumns` (1664, PostgreSQL's own) is `PG_ERR_TOO_BIG` before the column arrays grow. |
| PG-4 | Medium if it failed | `dispatch`, `authenticate` | A message at the wrong point — a row before authentication, `BackendKeyData` once ready, `ReadyForQuery` or an `ErrorResponse` for no group, COPY, an unknown type — must not be acted on. | **Holds.** Each is `PG_ERR_UNEXPECTED`. A `NotificationResponse` is read and dropped. |
| PG-5 | High if it failed | `scramContinue` | The server's SCRAM nonce must extend the client's, so an old exchange cannot be replayed into a new one. | **Holds.** A nonce that does not start with ours, adds nothing, or holds a byte outside `!`..`~` is `PG_ERR_SCRAM`. |
| PG-6 | High if it failed | `scramFinal`, `authenticate` | The client must not believe a server that does not know the password. | **Holds.** The `v=` signature must be 32 bytes and equal the one computed with the proof, by `timingSafeEqual`; a mismatch is `PG_ERR_SERVER_SIGNATURE`. An `AuthenticationOk` before the server's final message is `PG_ERR_SCRAM`. |
| PG-7 | Medium if it failed | `scramContinue` | The iteration count must not make the client spin, nor overflow while it is read. | **Holds.** Outside `minIterations`..`maxIterations` (4096 to 100000) is `PG_ERR_SCRAM`, and the digits stop being read once the count passes `maxIterations`. |
| PG-8 | Medium if it failed | `dispatch` (`ParameterStatus`) | A `client_encoding` other than `UTF8` would make `columnText` decode bytes as what they are not; a `DateStyle` other than ISO or a `TimeZone` other than UTC would make `PgText.timestamp` read a time the server did not mean. | **Holds.** The first is `PG_ERR_ENCODING`, the other two `PG_ERR_SETTING`, at startup or after a `SET`. |
| PG-9 | Medium | the whole module | No TLS: an eavesdropper reads every query and row, and a man in the middle can answer as the server. SCRAM keeps the password itself from them, and PG-6 keeps a server that does not know it from being believed, but a MITM can relay the exchange and then read and change what follows. | **Accepted.** TLS is out of this stage's scope; the guide says so. Connect over a trusted network or a local socket until it lands. |
| PG-10 | Low | `authenticate` | A server may answer `AuthenticationOk` at once (`trust`), and the client takes it: a program cannot insist on SCRAM, so an attacker that can answer as the server skips authentication. | **Accepted.** Without TLS the attacker of PG-9 wins anyway; a `requireAuth` setting belongs with TLS. |
| PG-11 | Low | `authenticate` | MD5 and cleartext passwords are refused with `PG_ERR_AUTH_UNSUPPORTED`, so a role whose password is MD5-hashed cannot connect. | **Accepted.** Without TLS cleartext sends the password as it is, and an MD5 response is a hash anyone who sees it can replay; SCRAM-SHA-256 is PostgreSQL's default since 14. `nish/crypto/md5` is therefore not written. |
| PG-12 | Low | `pgScramKeys`, `pgSha256Wiped` | `sha256(clientKey)`, the one-shot that made StoredKey, left a hasher whose state and block had absorbed ClientKey, which is password-equivalent for that server. | **Fixed.** StoredKey is computed by `pgSha256Wiped`, a hasher of its own whose `state`, `block` and `schedule` are wiped before it returns, as `HmacSha256.digest` does for its two. Not observable from outside (the hasher is a local); the wipes are read in the source. |
| PG-13 | Low | the builders, `sent`, the output reservation | The output buffer doubled without a cap and was compacted only once fully drained, so a program that queued faster than it sent grew it without bound, toward an `i32` offset's end. The program is trusted, so this is Low. | **Fixed.** `maxOutput` (1 MiB by default) caps the bytes queued unsent: a builder call that would pass it answers false and writes nothing, the room for `Sync` and `Terminate` is kept free under it, and the sent prefix is moved off the front once more than half the buffer is gone, or before any message, `bindEnd`'s, `Sync` and `Terminate` included, that would otherwise grow the buffer past its end; the buffer doubles only while twice its length fits in an `i32`. "a prepare that would pass maxOutput is refused", "a parameter that would pass maxOutput is refused", "unsent bytes count against maxOutput", "a send past half the buffer moves the rest to its start", "rather than double the buffer". |
| PG-14 | High if it failed | `PgBatcher.row` | A row is routed to requests by the ordinal in its last column, which the server sends. An ordinal past the keys, of 0 or less, NULL, not an integer, or past an int8 would index outside the run's arrays or give one request another's rows; one that goes back would answer a request after its last event. | **Holds.** `row` reads the ordinal with the connection's integer decoder (`int` for a text batch, `binaryInt` for a `binary` one, with `binary.failed` saved and restored around it) and refuses each of these before it routes anything: it answers false, counts the row in `refused`, and fails the run, so every request still waiting on it gets `PG_BATCH_FAILED`. A run's rows are routed only while it is open, and `take` resets a reused run's keys, so a later batch cannot read an earlier one's. "an ordinal past the keys", "ordinal 0", "a negative ordinal", "a NULL ordinal", "an ordinal that is not an integer", "an ordinal past an int8", "a row of no columns", "an ordinal that goes back", "a later batch cannot read an earlier one's ordinals", "and a bad one does not set it" (the program's `text.failed`); for a `binary` batch, "a binary take answers a run", "its Bind asks for one result format, binary", "its ordinals are read as binary int8s, each row to its request", "binary.failed stays as the caller set it", "a text ordinal is refused" and "a NULL ordinal is refused" (`link/std_postgres_batch`). |
| PG-15 | Medium | `PgBatcher.row`, `end`, `fail`, `next` | A run was named by its index, reused once answered, and an event on a run that was over panicked. So a server that sent `CommandComplete` twice, a `DataRow` or `CommandComplete` after an `ErrorResponse`, or a connection lost after its answer, ended the program; and had the panic been lifted, a late event would have reached the run's next batch, another set of requests. | **Fixed.** `take` answers a handle, the run's index plus its uses times `runs` (the uses wrap after 2^20, so a handle stays under 2^30), and a run's next take answers a new one. A spent handle — its run answered or taken again — makes `row`, `end` and `fail` do nothing and `next` answer `PG_BATCH_NONE`, and counts the call in `stray`. Only the program's own mistakes still panic (see Panic sites). "a second CommandComplete is stray", "a row after CommandComplete is stray", "an error after CommandComplete, as a commit at Sync can fail, is stray", "a connection lost after CommandComplete, before the group is done", "a row after an error is stray", "a CommandComplete after an error is stray", each through a `PgPool` from the server's bytes; "the one run is taken again under a new handle", "a row on the spent handle answers false", "and next on it answers nothing", "each counted stray", "the new execution is untouched", "the run is free again, under its next handle: a use of 16 runs on". |
| PG-16 | Medium | `PgBatcher.addText` | A text key that is not UTF-8, or holds a NUL, is refused by the server for the whole array, so one client's bad key failed every request batched with it. | **Fixed.** `addText` answers false for a key with a NUL or that is not RFC 3629 UTF-8 (an overlong form, a surrogate, past U+10FFFF, a stray or missing continuation byte), before it is queued. "a key with a NUL is refused", "a lone continuation byte is refused", "an overlong NUL is refused", "an overlong three-byte form is refused", "a surrogate is refused", "past U+10FFFF is refused", "a character cut by the window is refused", "a bad second continuation byte is refused", "only the good ones wait". |
| PG-17 | Low | `PgBatcher.take` | Each key is bound once, found by an open-addressed table hashed with a 31-bit polynomial a client could collide, and `maxRequests` reached 65,536: keys chosen to collide made one take probe on the order of 2^31 slots. | **Fixed.** `maxRequests` is at most 1024, so a take probes at most maxRequests² / 2 slots whatever the hash; it compares a key's bytes only on an equal 31-bit hash, so the bytes compared are at most that bound times the key length, which `maxBytes` caps. FNV-1a, which replaced the polynomial, makes chance collisions rarer but does not set that bound: it is unseeded, and `bwfgaa` and `zidhaa` share a 31-bit hash. "text keys quoted and escaped, each once", where only their bytes tell those two apart; `link/std_postgres_batch_config_requests_panic` (1025, after 1024 is taken). |
| PG-18 | High if it failed | `pgTarget` | `sun_path` holds 108 bytes on Linux, its NUL included; a longer path cut to fit would connect to a different socket, perhaps one another user made. | **Holds.** A `/` path over 107 bytes, or an `@` name over 107 after its `@`, is `PG_TARGET_TOO_LONG`, with `path` empty and `unix` false. macOS's 104-byte `sun_path` is left to `unixConnect`, which answers `-36` there rather than cut. "a 107-byte socket path is taken", "a 108-byte socket path is refused", "not cut short", "nor unix", "an @ name of 107 bytes after the @ is taken", "one of 108 is refused", "a longer port counts", "a long encoded directory is refused" (`link/std_postgres_unix_target`). |
| PG-19 | High if it failed | `pgDecoded`, `pgTargetUrl`, `pgTarget` | A percent escape must decode to the byte it spells and nothing else: a `%` at the end, with one digit or a non-hex one would read past the text or decode garbage, and `%00`, or a NUL byte as given, would end the path early in the C call. | **Holds.** Each is refused, `PG_TARGET_BAD_ESCAPE` for an escape and `PG_TARGET_BAD_HOST` for a bare NUL, in every part of the URL, including those `pgTargetUrl` does not otherwise read, as `libpq` refuses them. Decoding is `urlDecode`'s, which also refuses escapes that decode to bytes that are not UTF-8. "an escape that is not UTF-8 is refused", "escaped UTF-8 decodes"; "a bare % ends the host", "a % with one digit", "%G1 is no hex", "%1G is no hex", "%00 is refused", "in the user too", "in the database too", "in the port", "in a query key", "in a query value", "in an ignored value", "a NUL in the host is refused"; "lower-case escapes" and "an encoded port" decode. |
| PG-20 | Medium if it failed | `pgTargetUrl`, `pgPortValue` | The host is the authority after its last `@` and before its port, or a query `host`; a password with an `@`, an encoded `,` (libpq's list of hosts) or a port past 65535 must not become a different host or wrap to another port. | **Holds.** The user information ends at the last `@`; a `,` is `PG_TARGET_BAD_HOST`, since one target names one host; a port is 1 to 5 digits naming 1 to 65535, else `PG_TARGET_BAD_PORT`, so it cannot overflow. "an @ in the password is not the host", "an encoded , is two hosts", "two hosts are refused", "an empty port is refused", "a port of letters is refused", "a six-digit port is refused", "port 65536 is refused", "?port=0 is refused", "?host= overrides the authority, ?port= the port". |
| PG-21 | Low | `PgConnection`, over a socket | A local user who can create the socket a target names, in a directory others may write such as `/tmp`, can answer as the server; under `peer` or `trust` the server asks for no password, so nothing proves it is the server. | **Accepted.** As PG-10: there is no `requirepeer` to check the socket's owner, which `nish:net` cannot report. Put the socket in a directory only the server's user may write, as `/var/run/postgresql` is; the guide says peer and trust send no password. |
| PG-22 | Low | `pgTarget` | A host that is a path to the socket file itself, not its directory, is taken as a directory, as `libpq` takes it, and names `<file>/.s.PGSQL.<port>`, which does not exist. | **Accepted.** The connect fails (`ENOTDIR`); it reaches no other socket. Kept for `libpq`'s meaning of the same string; the guide says so. "a full socket path is taken as a directory, as libpq does". |

`keys`, the 64 bytes `pgScramKeys` answers, the proof taken from it and the
server signature kept for the final message are none of them secret (the
proof is sent on the wire), but each is wiped once used, and on `fail()`, so
that nothing of the exchange outlives it. The wipe of these three is read in
the source; no test observes it.

## Panic sites

A panic is for the program's own mistakes, never for a server's bytes:

| Where | When | Test |
| --- | --- | --- |
| constructor | a nonce shorter than 18 bytes | `link/std_postgres_nonce_panic` (17 bytes, after 18 are taken) |
| constructor | an empty `user` | `link/std_postgres_user_panic` (after a one-letter user is taken) |
| constructor | a startup parameter with a NUL | `link/std_postgres_nul_panic` (a NUL in `database`, after one without is taken) |
| constructor | a cap out of range: `maxMessage` or `maxOutput` under 1024 or over 2^30 − 1, `maxColumns` outside 1..65535, `maxInFlight` under 1, `minIterations` under 1 or over `maxIterations`, `maxIterations` over 214,748,363 | `link/std_postgres_config_panic` covers `maxOutput` of 1023, after 1024 is taken; the other bounds share its condition and are not tested one by one |
| `received` | a count past `inputRoom()` | — |
| `receive` | a window outside its source | `link/std_postgres_receive_panic` |
| `sent` | a count past the bytes queued | — |
| `pgFind` | a range outside the buffer; every caller passes one inside a framed message, so no input reaches it | the fuzz below, which never reaches it |
| `pgScramKeys`, `scramFinal` | an HMAC shorter than 32 bytes, keys not 64 bytes; `hmacSha256` always answers 32 | — |
| `PgPool` constructor | a size outside 1..1024 ("a PgPool size out of range") | `link/std_postgres_pool_size_panic` (1025 slots, after 1024 are taken) |
| `PgPool` constructor | a queue outside 1..2^20 ("a PgPool queueSize out of range") | `link/std_postgres_pool_queue_panic` (a queue of 0, after 2^20 is taken) |
| `PgPool` constructor | `maxInFlight` over 1024, which sizes each slot's ring | `link/std_postgres_pool_inflight_panic` (1025, after 1024 is taken) |
| `PgPool.connect` | a slot that wants no connection, or one outside 0..size − 1 | `link/std_postgres_pool_connect_panic` (the slot just connected, after the wanted one is taken) and `link/std_postgres_pool_connect_range_panic` (slot 2 of 2) |
| `PgPool.connect` | after `dispose` | `link/std_postgres_pool_connect_dispose_panic` (a wanted slot, after `dispose`) |
| `PgPool.connection` | a slot outside 0..size − 1 or with no connection made | `link/std_postgres_pool_connection_panic` (slot 1, after slot 0's is read) and `link/std_postgres_pool_connection_range_panic` (slot 2 of 2) |
| `PgPool.next` | a slot outside 0..size − 1, by `connection`, which it calls first | `link/std_postgres_pool_next_panic` (slot 2 of 2, after slot 0 answers) |
| `arrayElement`, `arrayNull` | no array open ("an array element with no arrayStart()") | `link/std_postgres_array_element_panic` (`arrayNull`, after a parameter is taken with no array) |
| `arrayEnd` | no array open ("arrayEnd() with no arrayStart()") | `link/std_postgres_array_end_panic` (a second `arrayEnd`, after the first) |
| `arrayStart` | an array already open ("arrayStart() while an array is open") | `link/std_postgres_array_start_panic` (a second `arrayStart`, after the first opens) |
| `param*` | an array open ("a parameter while an array is open"), which would write a parameter inside it | `link/std_postgres_array_param_panic` (`paramInt` inside an open array) |
| `bindEnd` | an array open ("bindEnd() while an array is open") | `link/std_postgres_array_bindend_panic` (after the array opens) |
| `arrayElement` | a window outside its source ("arrayElement() outside its source") | `link/std_postgres_array_window_panic` (one byte past the end, after an in-bounds window) |
| `paramIntArray` | a window outside its array ("paramIntArray() outside its array") | `link/std_postgres_int_array_range_panic` (one value past the end, after an in-bounds window) |
| `arrayInt` | no array open ("an array element with no arrayStart()") | `link/std_postgres_array_int_panic` (after a parameter is taken with no array) |
| `paramBytes`, `paramNull`, `paramTextArray`, `paramIntArray` | an array open ("a parameter while an array is open") | `link/std_postgres_array_param_bytes_panic`, `_null_panic`, `_text_array_panic`, `_int_array_panic` (each inside an open array, after the array opens) |
| `PgBatcher` constructor | a `keyType` other than `PG_BATCH_INT` or `PG_BATCH_TEXT` ("a PgBatchConfig keyType out of range") | `link/std_postgres_batch_config_key_panic` (after a text batcher is made) |
| `PgBatcher` constructor | an empty `name` or `select`, or a NUL in them or in `orderBy` ("a PgBatchConfig name or query empty or with a NUL") | `link/std_postgres_batch_config_query_panic` (after an ordered batcher is made); `link/std_postgres_batch_config_empty_panic` (an empty `select`); `link/std_postgres_batch_config_name_empty_panic` (an empty `name`); `link/std_postgres_batch_config_name_nul_panic` and `link/std_postgres_batch_config_select_nul_panic` (a NUL in each) |
| `PgBatcher` constructor | a cap out of range: `maxRequests` outside 1..1024, `maxBytes` under 22 (the widest int8 key in its braces) or over 2^30 − 1, `queueSize` outside 1..2^20, `queueBytes` outside 0..2^30 − 1, `runs` outside 1..1024 ("a PgBatchConfig cap out of range") | `link/std_postgres_batch_config_cap_panic` covers `maxBytes` of 21, after 22 is taken, and `link/std_postgres_batch_config_requests_panic` `maxRequests` of 1025, after 1024; `link/std_postgres_batch_config_queue_size_panic` `queueSize` of 0, after 1; `link/std_postgres_batch_config_queue_bytes_panic` `queueBytes` of −1, after 0; `link/std_postgres_batch_config_runs_panic` `runs` of 1025, after 1024; the other bounds share their condition |
| `PgBatcher.addInt` | a text batcher | `link/std_postgres_batch_add_int_panic` (after `addText` on it is taken) |
| `PgBatcher.addText` | an int8 batcher | `link/std_postgres_batch_add_text_panic` (after `addInt` on it is taken) |
| `PgBatcher.addText` | a window outside its source | `link/std_postgres_batch_add_text_window_panic` (one byte past the end, after the whole source) |
| `PgBatcher.row`, `end`, `fail`, `next` | a handle no take could answer: negative, or `runs` · 2^20 or more ("a PgBatcher run out of range"); a spent one is not a panic (PG-15) | `link/std_postgres_batch_run_range_panic` (`next` of 2 · 2^20 with 2 runs, after the last handle); `link/std_postgres_batch_run_negative_panic` (`fail(-1)`, after a never-taken handle is counted stray) |
| `PgBatcher.row`, `end`, `fail` | events still owed ("before next(run) answered PG_BATCH_NONE") | `link/std_postgres_batch_pending_panic` (a second `fail` while the second request's event is owed); `link/std_postgres_batch_row_pending_panic` (a `row` after a `fail` and one `next`) |
| `PgBatcher.takeDue` | a clock whose waiting count is not the batcher's, or whose `maxCount` is below `maxRequests` ("PgBatcher.takeDue with a clock that does not mirror the batcher") | `link/std_postgres_batch_clock_take_due_panic` (a request added without `arrived`, after a mirrored take) |
| `PgBatchClock` constructor | a setting out of range: `maxCount` outside 1..2^20, `minCount` outside 1..`maxCount`, `factor` outside 0..64 or NaN, `weight` outside (0, 1] or NaN, `maxWaitUs` or `lightWindowUs` outside 0..60,000,000, `lightCount` outside 0..1024, `queueSize` outside 1..2^20 ("a PgBatchClockConfig setting out of range") | `link/std_postgres_batch_clock_config_panic` (`factor` 64.5, after 32 is taken); the other bounds share its condition |
| `PgBatchClock.started` | a size under 1, over the items waiting, or over `maxCount` ("PgBatchClock.started with a size out of range") | `link/std_postgres_batch_clock_started_panic` (a second start with none waiting, after one) |
| `PgBatchClock.startsFor` | a reason outside `PG_CLOCK_WAIT`..`PG_CLOCK_IDLE` | — |
| `PgBatchTurns` constructor | a size outside 1..1024 | — |
| `PgBatchTurns.started`, `release` | a slot out of range or holding a batch ("PgBatchTurns slot out of range or holding a batch") | — |
| `PgBatchTurns.finished` | a slot holding no batch ("PgBatchTurns.finished on a slot holding no batch") | `link/std_postgres_batch_clock_turns_panic` (slot 0 finished twice, after once) |

Apart from the array misuse above, the builder calls do not panic: `param*`,
`arrayStart` and `bindEnd` with no bind open answer false and write nothing
("paramText without a bind is refused" and the lines after it, "without a
bind, arrayStart is refused"), as does `paramBytes` on a window outside its
array. An open array is the program's state, not the server's, so misusing it
is a panic rather than a refusal a caller could miss and send a Bind whose
array never closed.

## Limits

Edges of the module a caller owns, recorded so that no one assumes otherwise:

- **A server that skips authentication is believed.** An `AuthenticationOk`
  in place of a SASL request is taken; there is no `require_auth`
  equivalent (PG-10).
- **`maxInFlight` has no upper bound on a lone connection.** It is the
  program's own cap on groups sent and unanswered; the bytes they hold are
  bounded by `maxOutput`. A pool refuses one over 1024, since each slot holds
  a ring of that many tickets.
- **A fresh nonce for each connect is the program's.** `PgPool.connect`
  takes the nonce it is given; the pool checks its length (18 bytes or
  more), not its freshness. A program that reuses one weakens SCRAM's
  replay protection; `crypto.getRandomValues` for each call is the rule.
- **The sockets are the program's.** The pool never opens or closes one.
  The program closes a slot's socket on `PG_FAILED`, calls `closed()` when
  a read answers 0 or an error other than `AGAIN`, or a write fails, and at
  the end sends `terminate()` and closes each socket itself: `dispose`
  wipes the passwords but neither sends `Terminate` nor closes a socket.
  The carrier's `reset` check pins the read error.
- **A pool neither times out nor retries.** A request waits in the queue
  until a connection takes it; one lost with its connection (`PG_LOST`) is
  the program's to run again, since the pool cannot know whether the server
  committed it. The carrier owns every clock.
- **Named statements are not tracked.** A second `prepare("x")` before the
  first is closed is sent, and the server answers the group with `42P05`;
  the caller keeps names unique.
- **Timestamps are checked for shape, not range.** `PgText.timestamp`
  checks the ISO digits and separators, the year (0001–9999) and the offset,
  but not the month, day or time: `2024-99-99` passes into its RFC 3339
  output. The values are the server's, and trusted as such. `PgBinary`'s
  `timestamp` and `iso` compute the date from a microsecond count, so every
  output is a real date; a year outside 0001–9999, `infinity` among them, is
  refused.
- **A binary column is read as the program says it is.** Rows carry no
  format of their own: a program that reads a text row with `PgBinary` (or a
  binary one with `PgText`) gets the wrong value or `failed`, never a read
  outside the column. Each binary decoder checks the column's window against
  its buffer and its length against the type's (2, 4 or 8 for an integer, 1
  for a `bool`, 8 for a `float8` or a time) before it reads a byte.
  `PgBinaryArray` walks a one-dimensional `int2[]`, `int4[]` or `int8[]` the
  same way: its header's `ndim` (0 or 1), `hasnull` and element OID (20, 21 or
  23) are checked, and every element's length word must equal its type's size
  (a NULL needs `hasnull` 1), each before the bytes it names are read. The
  walk ends with `PG_ARRAY_END` only when it has consumed the column exactly,
  so a count the header gives and bytes left over, or a short column, both
  fail. Its only allocation is its constructor's, and no element is read past
  the column's window.
- **The output buffer's doubling is bounded by `maxOutput`.** Every message
  first makes room by moving the unsent bytes to the front (PG-13), so the
  buffer grows past its length only when the unsent bytes need it, and never
  past twice `maxOutput` (at most 2^31 − 2, inside an `i32`).

- **`maxOutput` is the program's to size against `maxBytes`.** A take stops
  at the first key the connection refuses for room, and a key longer than a
  connection could ever hold stays at the head of its queue; `addText`
  refuses only a key that could never fit `maxBytes`. Such a key blocks every
  request behind it: each take answers -1 and none is ever sent, which is why
  the sizing rule below matters. A take whose array
  fills `maxBytes` fits a connection with nothing else unsent when
  `maxBytes + name.length + 32 <= maxOutput` (the Bind's head of 11 and the
  name, the array's length word of 4, and `PG_TAIL`'s 17): "a full take fits
  maxOutput at the bound", "and a byte past it is refused". The guide states
  that bound; the batcher does not read the connection's
  caps when it is made, since one batcher serves every connection of a pool.

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
client's own checks are lines of `tests/link/std_postgres/expected.out`, which
`link/std_postgres: exits with 0 and stdout matches expected.out` compares
byte for byte. Exchanges recorded from PostgreSQL 18 by
`tests/postgres/record.mjs` are replayed whole, in 7-byte and in 1-byte
pieces, by `link/std_postgres_replay: exits with 0 and stdout matches
expected.out`.

**No backend bytes make the client panic** (PG-1, PG-2):
the replay cuts every recording at every byte offset, feeds what is left and
calls `closed()`, and pins the failure code each cut ends on ("every
recording cut at every offset"); then 4000 mutants drawn from a fixed seed
(xorshift32, a bit flipped, a byte inserted or deleted, or the bytes cut)
are replayed, each must end `PG_FAILED` with a code from 1 to 10, and the
count of each code and a checksum over codes and logs are pinned ("fuzz: the
seed's mutants, by the code they ended with"). The end-state check cannot
fail on its own, since `closed()` always leaves `PG_FAILED`; what fails is a
panic, which ends the run, or a moved count or checksum. That a field is
never read past its message's end, rather than merely inside the buffer,
rests on the targeted negatives under "Fields inside a message" below, not on
the fuzz.

**Framing** (PG-1): "a length under 4 is a framing failure", "a failed
connection stays failed", "a message over maxMessage is refused before it is
read", "a message larger than the buffer grows it", "and is read whole", "a
message a little over the buffer", "doubles it", "a byte at a time", every
recording "in 1-byte pieces", and `link/std_postgres_receive_panic: exits
with 1 and stdout matches expected.out` for `receive`.

**Fields inside a message** (PG-2): "an error without its terminator", "a
ParameterStatus without its value", "an authentication request under 4
bytes", "AuthenticationOk with data", "BackendKeyData of 4 bytes",
"ReadyForQuery with a status other than I, T, E", "ParseComplete with a
body", "a tag without its NUL", "EmptyQueryResponse with a body", "NoData
with a body", "ParameterDescription short of its count", "a column longer
than its row", "a row with bytes after its columns", "a column length of -2",
"a RowDescription field cut short".

**Caps** (PG-3, PG-13): "a row over maxColumns", the `maxOutput` lines under
PG-13, and "maxInFlight groups sent: no
more", "prepare is refused", "bindStart is refused" for the client's own cap.

**Order** (PG-4): "a row before authentication", "authentication once
started", "BackendKeyData once ready", "ReadyForQuery with no group in
flight", "a row with no group in flight", "an ERROR with no group in
flight", "an unknown message",
"ReadyForQuery for a group not yet synced", "a notification is ignored".

**SCRAM** (PG-5 to PG-7): "a server nonce that is not ours", "a server nonce
that adds nothing", "a server nonce with a space", "no salt", "a salt that is
not base64", "iterations under minIterations", "iterations over
maxIterations", "iterations that would overflow", "iterations that are not
digits", "AuthenticationOk before the server proved the password"; "a server
signature the password does not make" (PG-6's `PG_ERR_SERVER_SIGNATURE`), "a
server signature of 31 bytes", "a server signature that is not base64", "a
server final without v=", "a server final of one byte"; "SASL without
SCRAM-SHA-256", "a SASL list without its end", "SASLContinue before SASL".
The recorded `scram-ok` exchange computes the proof PostgreSQL accepts and
checks the signature it sends, and `scram-wrong-password` ends with the
server's `FATAL 28P01`.

**Refused methods** (PG-11): "MD5 is refused", "cleartext is refused", and
the recorded `cleartext` exchange.

**Encoding and session** (PG-8): "a client_encoding other than UTF8",
"DateStyle German, DMY", "DateStyle ISOX", "DateStyle empty", "TimeZone
Europe/Paris", "TimeZone UTC0", "a SET TimeZone once ready fails the
connection", against "DateStyle ISO", "DateStyle ISO, MDY" and "TimeZone UTC"
accepted.

**The password**: read through `expose`, the connection's copy is the
password while SCRAM runs ("a new connection holds its copy of the
password", "still after SASL starts") and zeros after ("zeros once the proof
is computed", "zeros after fail()", "zeros after dispose()", "a failed
connection holds no password: its copy is zeros", "trust computes no proof:
zeros once AuthenticationOk arrives"); "dispose may be called twice".

**Parameters never meet the SQL**: every statement goes through Parse, Bind
and Execute ("Parse and Describe", "Bind with every parameter kind, then
Execute"), and "a NUL in a name is refused", "a NUL in SQL is refused", "a
NUL in a closed name is refused", "a NUL in a bound name is refused", "and
nothing is written".

**Array parameters**: an array goes as one text parameter in PostgreSQL's
array literal, and every element stays data. `paramIntArray` writes "every
value in decimal, the most negative too"; the builder writes "NULL unquoted,
every text element quoted, \" and \\ escaped, UTF-8 as it is", so an element
of `NULL`, `,`, `{`, `}` or a quote cannot end the element or the array (the
live `arrays` scenario reads each back through `unnest`). The size is exact
before a byte is written: "an int8[] that would pass maxOutput is refused"
("its exact size is asked for: one value less fits"), "an element whose
escapes pass maxOutput is refused" ("its escapes are counted: one less
fits"), "an element that would pass maxOutput is refused" "and the refused
one left nothing behind", and room for the closing `}` is held for each
element, so "the array still ends". With an array open, "no sync while an
array is open", "no prepare", "no closeStatement", "no bindStart"; a
compaction under it leaves "the array's length patched where it moved to";
and "terminate drops an open array with its bind".

**Server errors**: "an error during startup fails the connection", "FATAL
once ready fails it too", "an ERROR ends the statement, then the group", and
the recorded `no-database` exchange. The recorded `pipeline-unique` exchange
sends five groups in one write, the third a duplicate key: it ends with
`23505` and the fourth and fifth are answered.

**Pipelining**: "sixteen groups, the default maxInFlight, go out
unanswered", "a seventeenth may not start", "the first answer frees one
place", "so the seventeenth goes out", "the answers come back in the order
the groups were sent", "one answer more than was asked for".

**Results from a real server**: the recorded `typed-row` exchange decodes an
int8 past 2^53, an int4, a text, a timestamptz, a bool, a `text[]` and a
NULL; `row-counts` reads `UPDATE 3`, `DELETE 2` and `UPDATE 0` through
`tagRows`.

**What it reaches**: `link/std_postgres_caps` builds a connection under a
policy that denies every capability, so the module reaches none; the
`std_postgres` and replay programs compile under the same policy, the replay
with `fs.read` for its recordings.

**Decoders never write what they refuse**: "year 0000" "leaves out as it
was", and a tag's count past an i64 is -1 and "leaves text.failed alone".
The binary decoders likewise: `-infinity` "leaves out as it was", and "one
byte", "three bytes", "no bytes", "a window past the buffer", "a window
before it", "NULL's length", "bool: 2", "float8: four bytes" and
"timestamp: four bytes" each answer `failed` without reading past the
column. "binary failures leave text.failed alone".

**Binary results**: "one result format code, 1: every column binary" pins
the Bind's bytes, and "the next bindStart is text again: no format codes"
that a binary bind does not leak into the next; "a binary bind refuses
that one" and "bindEnd is never refused for room" that its two extra bytes
are kept free under `maxOutput` from `bindStartBinary` on.
`tests/postgres/live`'s `binary` scenario reads one statement's rows from
PostgreSQL 18 in binary and in text and gets the same line for each, and its
`stamps_binary` batch (a `PgBatchConfig` with `binary` set) reads the same
creation times as its `stamps_text` batch.

**Binary arrays**: `link/std_postgres` walks hand-built arrays. "ndim 0: the
empty array", "one int4", "1000 elements", "a NULL with hasnull 1" and "int2
elements" read in place and end with `PG_ARRAY_END`. Each refusal sets
`binary.failed`: "ndim 2", "another element type: text", "a 3-byte int4
element", "a 4-byte element in an int2 array", "a hasnull that is not 0 or
1", "a NULL with hasnull 0", "a negative dimension", "more elements promised
than given", "bytes after an empty array", "truncated inside the element",
"truncated inside the length word", "truncated inside the header", "a window
past the buffer" and "a window before it". The live `binary` scenario reads
int4[] and int8[] columns, each empty, one element or 1000, in binary and in
text, and gets the same line for each.

**Terminate**: "Terminate drops an open bind", so a half-built Bind is never
sent, and "terminate drops an open array with its bind".

**The pool**: `link/std_postgres_pool` drives a `PgPool` against scripted
servers. Its bounds: "a full queue refuses" "and holds what it had", "256
register; the 257th is refused", "a NUL in a name is refused", "a NUL in SQL
is refused". Its scheduling: "a full connection takes no more", "in FIFO
order", "the next to the one with fewer in flight". Its failures: "a
connection that fails loses each request it took, oldest first", "a
connection that fails starting, none ready, takes the oldest request with
it", "a request being built when its connection fails is lost", "it answers
nothing after PG_FAILED", "two slots fail starting, none ready: the first
takes the oldest". Its isolation: an error in the second of three groups on
one connection fails only that group ("the error is its own"). Its password:
"dispose wipes the pool's password" "and its connections'". It passes as
`link/std_postgres_pool: exits with 0 and stdout matches expected.out`.

**The batcher**: a key reaches the server only as an element of the one
bound array parameter, never in SQL text: `sql` is fixed when the batcher is
made, and keys are written by `arrayElement` and `arrayInt` ("text keys
quoted and escaped, each once" "and routed"). A row's ordinal is refused
when it is NULL, not an integer, outside the keys or going back (PG-14's
tests). A spent run handle routes nothing, so no late event reaches a later
batch (PG-15's tests, and "a later batch cannot read an earlier one's
ordinals"). With `binary` set, a batch's rows come in binary as well: `take`
opens its bind with `bindStartBinary` and `row` reads the ordinal with
`binaryInt`, so a binary batch's refusals are PG-14's, read back in binary
("a binary take answers a run", "binary.failed stays as the caller set it").
Its state is bounded by its config, with each cap's bound a
panic test under Panic sites, and its refusals answered rather than grown:
"only the ones that fit wait", "a full take fits maxOutput at the bound",
"and a byte past it is refused". It passes as `link/std_postgres_batch:
exits with 0 and stdout matches expected.out`, and the live `batch`
scenario below drives three batchers through a pool against PostgreSQL 18.

**Connection targets** (PG-18 to PG-20): the checks quoted in those rows are
lines of `tests/link/std_postgres_unix_target/expected.out`, compared byte
for byte by `link/std_postgres_unix_target: exits with 0 and stdout matches
expected.out`. That `pgTargetUrl` and `pgTarget` never panic is pinned by
3000 URLs drawn from a fixed seed (xorshift32) out of the bytes and escapes
the parser splits on — `/`, `@`, `:`, `%`, `?`, `&`, `=`, brackets, `,`,
`%2F`, `%40`, `%00`, `?host=` and `&port=` among them, cut anywhere: each
must answer a failure code from `PG_TARGET_OK` to `PG_TARGET_TOO_LONG`
("3000 seeded URLs: each answers a defined failure"), each socket target it
gives must end `/.s.PGSQL.<port>` within 108 bytes ("and each socket target
fits sun_path"), and some must be sockets ("some of them sockets"). A panic
ends the run, so the line after it is missing and the comparison fails.

**Against a live server**: `tests/postgres/live/run.mjs` runs the pool and
`tests/postgres/carrier.ts` against PostgreSQL 18, in CI's `postgres-live`
job against a `postgres:18` service. It checks that a wrong password is
refused with `28P01` — the client refuses MD5 and cleartext, so the server
got that far only through SCRAM; that 100 pipelined requests over four
connections, every one of which carries groups, four of which violate a
unique key, fail only those four, whose connections recover, and that the
rows the other 96 inserted are committed while the failed groups' are not
(read back with a fresh connection); that a backend
ended by `pg_terminate_backend` is reported lost and made again; that a
division by zero fails only its own group in a pipeline; that text[], int8[]
and int4[] parameters come back through `unnest` element for element — NULLs,
quotes, backslashes, braces, commas, the text `NULL`, the empty string,
multibyte UTF-8, the empty array and the extreme int8 values — with the
int4[] literal coerced by the server; that the `batch` scenario's three
batchers (users by int8 id over two takes, articles by text slug, and
tags by article, several rows a key in name order), each with a duplicate
key and a key with no row, answer every request its own rows and no
other's through a pooled connection; and that the conduit
article list decodes, escapes and truncates as its golden says. The carrier
serves HTTP while a query sleeps, and with nothing listening on its database
port reports the request lost and the slot failed rather than waiting. Its
`reset` check points it at a server that resets the connection on the
startup message: the read answers ECONNRESET (-104), and the carrier ends
the connection there rather than leave the readable socket to spin. Its
`unix` scenario connects through a `postgres://` URL whose host is the
percent-encoded socket directory: the server asks for no password (`peer`
for a cluster `run.mjs` starts, `trust` in CI's service), so a password the
server would refuse still logs in, and its copy is wiped; and a multi-row read comes back over the socket,
where `inet_server_addr()` is NULL.
