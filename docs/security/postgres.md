# Security record: the PostgreSQL client

The record of `nish/net/postgres`, the sans-IO client side of PostgreSQL's
frontend/backend protocol 3.0 ([wp39-http-server.md](../wp39-http-server.md),
E6). It says what the client refuses from a server, and with what code, what a
server can make it hold or compute, where the password lives and when it is
wiped, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the database layer starts
from evidence.

Anchors are function names in `std/net/postgres.ts` at `eed1ae3`, the last
commit to change it on the head that merges this record.

**Result.** Every message is framed once, by its length, and a length under 4
or over `maxMessage` fails the connection before its body is read; every
field inside a message is bounded by that message's end, so no backend bytes,
however malformed, make the client read past them or panic. A message the
protocol does not allow at that point, COPY among them, fails the connection.
A server can make the client hold at most one message of `maxMessage` bytes
and one row of `maxColumns` columns, and compute at most `maxIterations`
SCRAM iterations. The server's SCRAM signature is compared in constant time
before an `AuthenticationOk` is believed, and an `AuthenticationOk` that skips
it is refused. The password is held as a `Secret<u8[]>` copy and wiped once
the proof is computed, or when the connection fails or is disposed. One
finding is open, Low: the hasher state of one SHA-256 over ClientKey is not
wiped (PG-12). Three properties a reader might assume are not provided, by
design, and are recorded as accepted: no TLS (PG-9), no way to require SCRAM
of a server (PG-10), and MD5 and cleartext refused (PG-11).

## Scope

| File | Functions |
| --- | --- |
| `std/net/postgres.ts` | `PgConfig`; `PgError`; `PgPassword`; `PgConnection` (the constructor, `received`, `receive`, `sent`, `closed`, `dispose`, `next`, `compact`, `fail`, `dispatch`, `reserveColumns`, `readRow`, `readDescription`, `readError`, `authenticate`, `scramStart`, `scramContinue`, `scramFinal`, the builders `prepare`, `closeStatement`, `bindStart`, the `param*` calls, `bindEnd`, `sync`, `terminate`, and the row readers); `PgText`; `PgArrayWalker`; the helpers `pgCopyBytes`, `pgBytesOf`, `pgHasNul`, `pgFind`, `pgBytesAre`, `pgSaltedPassword`, `pgScramKeys` |

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
than sent, and a nonce shorter than 18 bytes or an empty user is a panic in
the constructor.

## Findings

Rows PG-1 to PG-8 are the shapes a hostile server's bytes can take, each
checked and found to hold; they are recorded so that the audit can see what
was tried. PG-9 to PG-11 are accepted. PG-12 is open.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| PG-1 | High if it failed | `next`, `received`, `receive`, `compact` | A message's length must not make the client read past its buffer or hold more than `maxMessage`. | **Holds.** A length under 4 is `PG_ERR_FRAME`, one over `maxMessage` is `PG_ERR_TOO_BIG` before its body is read, and the input buffer grows by doubling to one message at most. `receive` panics on a window outside its source, as `received` does on a count past `inputRoom()`. A message split into 1-byte pieces frames the same as one whole. |
| PG-2 | High if it failed | `dispatch`, `readRow`, `readDescription`, `readError` | A field inside a message must not be read past the message's end: a column longer than its row, a length of `-2`, a string without its NUL, a count short of its fields. | **Holds.** Each is `PG_ERR_FRAME`; a row with bytes after its last column is too. |
| PG-3 | Medium if it failed | `readRow`, `readDescription`, `reserveColumns` | A row or description must not make the client allocate without bound. | **Holds.** Over `maxColumns` (1664, PostgreSQL's own) is `PG_ERR_TOO_BIG` before the column arrays grow. |
| PG-4 | Medium if it failed | `dispatch`, `authenticate` | A message at the wrong point — a row before authentication, `BackendKeyData` once ready, `ReadyForQuery` or an `ErrorResponse` for no group, COPY, an unknown type — must not be acted on. | **Holds.** Each is `PG_ERR_UNEXPECTED`. A `NotificationResponse` is read and dropped. |
| PG-5 | High if it failed | `scramContinue` | The server's SCRAM nonce must extend the client's, so an old exchange cannot be replayed into a new one. | **Holds.** A nonce that does not start with ours, adds nothing, or holds a byte outside `!`..`~` is `PG_ERR_SCRAM`. |
| PG-6 | High if it failed | `scramFinal`, `authenticate` | The client must not believe a server that does not know the password. | **Holds.** The `v=` signature must be 32 bytes and equal the one computed with the proof, by `timingSafeEqual`; a mismatch is `PG_ERR_SERVER_SIGNATURE`. An `AuthenticationOk` before the server's final message is `PG_ERR_SCRAM`. |
| PG-7 | Medium if it failed | `scramContinue` | The iteration count must not make the client spin, nor overflow while it is read. | **Holds.** Outside `minIterations`..`maxIterations` (4096 to 100000) is `PG_ERR_SCRAM`, and the digits stop being read once the count passes `maxIterations`. |
| PG-8 | Medium if it failed | `dispatch` (`ParameterStatus`) | A `client_encoding` other than `UTF8` would make `columnText` decode bytes as what they are not. | **Holds.** It is `PG_ERR_ENCODING`. |
| PG-9 | Medium | the whole module | No TLS: an eavesdropper reads every query and row, and a man in the middle can answer as the server. SCRAM keeps the password itself from them, and PG-6 keeps a server that does not know it from being believed, but a MITM can relay the exchange and then read and change what follows. | **Accepted.** TLS is out of this stage's scope; the guide says so. Connect over a trusted network or a local socket until it lands. |
| PG-10 | Low | `authenticate` | A server may answer `AuthenticationOk` at once (`trust`), and the client takes it: a program cannot insist on SCRAM, so an attacker that can answer as the server skips authentication. | **Accepted.** Without TLS the attacker of PG-9 wins anyway; a `requireAuth` setting belongs with TLS. |
| PG-11 | Low | `authenticate` | MD5 and cleartext passwords are refused with `PG_ERR_AUTH_UNSUPPORTED`, so a role whose password is MD5-hashed cannot connect. | **Accepted.** Without TLS cleartext sends the password as it is, and an MD5 response is a hash anyone who sees it can replay; SCRAM-SHA-256 is PostgreSQL's default since 14. `nish/crypto/md5` is therefore not written. |
| PG-12 | Low | `pgScramKeys` | `sha256(clientKey)`, the one-shot that makes StoredKey, leaves a hasher whose state absorbed ClientKey, and `std/crypto/sha256.ts` has no wipe to reach it. ClientKey, StoredKey, ClientSignature, ServerKey and the salted password are wiped. | **Open.** The fix is a wiping one-shot in `std/crypto/sha256.ts`, outside this module. |

`keys`, the 64 bytes `pgScramKeys` answers, is not wiped: it holds the proof,
which is sent on the wire, and the server's signature, which is not secret.

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
client's own checks are lines of `tests/link/std_postgres/expected.out`, which
`link/std_postgres: exits with 0 and stdout matches expected.out` compares
byte for byte. Exchanges recorded from PostgreSQL 18 by
`tests/postgres/record.mjs` are replayed whole, in 7-byte and in 1-byte
pieces, by `link/std_postgres_replay: exits with 0 and stdout matches
expected.out`.

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

**Caps** (PG-3): "a row over maxColumns", and "maxInFlight groups sent: no
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

**Encoding** (PG-8): "a client_encoding other than UTF8".

**The password**: "a failed connection holds no password", "dispose may be
called twice".

**Parameters never meet the SQL**: every statement goes through Parse, Bind
and Execute ("Parse and Describe", "Bind with every parameter kind, then
Execute"), and "a NUL in a name is refused", "a NUL in SQL is refused", "a
NUL in a closed name is refused", "a NUL in a bound name is refused", "and
nothing is written".

**Server errors**: "an error during startup fails the connection", "FATAL
once ready fails it too", "an ERROR ends the statement, then the group", and
the recorded `no-database` exchange.

**Decoders never write what they refuse**: "year 0000" "leaves out as it
was", and a tag's count past an i64 is -1 and "leaves text.failed alone".

**Terminate**: "Terminate drops an open bind", so a half-built Bind is never
sent.
