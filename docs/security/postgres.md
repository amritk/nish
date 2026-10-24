# Security record: the PostgreSQL client

The record of `nish/net/postgres`, the sans-IO client side of PostgreSQL's
frontend/backend protocol 3.0 ([wp39-http-server.md](../wp39-http-server.md),
E6). It says what the client refuses from a server, and with what code, what a
server can make it hold or compute, where the password lives and when it is
wiped, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the database layer starts
from evidence.

Anchors are function names in `std/net/postgres.ts` at `d375301`, the last
commit to change it on the head that merges this record.

**Result.** Every message is framed once, by its length, and a length under 4
or over `maxMessage` fails the connection before its body is read; every
field inside a message is bounded by that message's end, so no backend bytes,
however malformed, make the client read past them or panic. A message the
protocol does not allow at that point, COPY among them, fails the connection.
A server can make the client hold at most one message of `maxMessage` bytes
and one row of `maxColumns` columns, and compute at most `maxIterations`
SCRAM iterations; a program can queue at most `maxOutput` bytes unsent. Every
recorded exchange cut at every byte offset, and 4000 seeded mutants of them,
end on a defined failure code without a panic. The server's SCRAM signature is compared in constant time
before an `AuthenticationOk` is believed, and an `AuthenticationOk` that skips
it is refused. The password is held as a `Secret<u8[]>` copy and wiped once
the proof is computed, or when the connection fails or is disposed, and every
SCRAM key is wiped, the hasher that makes StoredKey included. No finding is
open: PG-12 (ClientKey left in a hasher) and PG-13 (an unbounded send buffer)
were fixed in review. Three properties a reader might assume are not provided, by
design, and are recorded as accepted: no TLS (PG-9), no way to require SCRAM
of a server (PG-10), and MD5 and cleartext refused (PG-11).

## Scope

| File | Functions |
| --- | --- |
| `std/net/postgres.ts` | `PgConfig`; `PgError`; `PgPassword`; `PgConnection` (the constructor, `received`, `receive`, `sent`, `closed`, `dispose`, `next`, `compact`, `fail`, `passwordWiped`, `dispatch`, `reserveColumns`, `readRow`, `readDescription`, `readError`, `authenticate`, `scramStart`, `scramContinue`, `scramFinal`, the builders `prepare`, `closeStatement`, `bindStart`, the `param*` calls, `bindEnd`, `sync`, `terminate`, the output reservation and its compaction, and the row readers); `PgText`; `PgArrayWalker`; the helpers `pgCopyBytes`, `pgBytesOf`, `pgHasNul`, `pgFind`, `pgBytesAre`, `pgSaltedPassword`, `pgSha256Wiped`, `pgScramKeys` |

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
statement's parameters interpreted as SQL. The program is trusted: its
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
first review of this module and fixed before it merged.

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

The builder calls do not panic: `param*` and `bindEnd` with no bind open
answer false and write nothing ("paramText without a bind is refused" and the
lines after it), as does `paramBytes` on a window outside its array.

## Limits

Edges of the module a caller owns, recorded so that no one assumes otherwise:

- **A server that skips authentication is believed.** An `AuthenticationOk`
  in place of a SASL request is taken; there is no `require_auth`
  equivalent (PG-10).
- **`maxInFlight` has no upper bound.** It is the program's own cap on groups
  sent and unanswered; the bytes they hold are bounded by `maxOutput`.
- **Named statements are not tracked.** A second `prepare("x")` before the
  first is closed is sent, and the server answers the group with `42P05`;
  the caller keeps names unique.
- **Timestamps are checked for shape, not range.** `PgText.timestamp`
  checks the ISO digits and separators, the year (0001–9999) and the offset,
  but not the month, day or time: `2024-99-99` passes into its RFC 3339
  output. The values are the server's, and trusted as such.
- **The output buffer's doubling is bounded by `maxOutput`.** Every message
  first makes room by moving the unsent bytes to the front (PG-13), so the
  buffer grows past its length only when the unsent bytes need it, and never
  past twice `maxOutput` (at most 2^31 − 2, inside an `i32`).

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

**Terminate**: "Terminate drops an open bind", so a half-built Bind is never
sent.
