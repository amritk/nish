# PostgreSQL

`nish/net/postgres` is a PostgreSQL client. It reads no socket: a
`PgConnection` writes the messages it wants sent into an output buffer, reads
the server's answers from an input buffer you fill, and tells you what
happened, one event at a time. Your program owns the socket
([`nish:net`](networking.md)) and the loop, so one loop can drive many
connections next to everything else it serves. It is imported like any other
library module ([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)).

It speaks protocol 3.0, which every PostgreSQL since 7.4 understands, and it is
tested against exchanges recorded from PostgreSQL 18.

## A query

The program below connects to a server on `127.0.0.1:5432` and looks up three
users by id through a `PgBatcher` ([below](#batching-keyed-reads)): the
requests for ids 7, 3 and 7 become one execution that asks for each id once,
and every request gets its rows, or word that there were none. The connection
asks for nothing a round trip does not need: the statement is prepared, bound
and executed in one write.

```ts nish:ok
import {
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
  PG_COMPLETE,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_READY,
  PG_ROW,
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
} from "nish/net/postgres";
import { connectResult, netAddress, netClose, netRead, netWrite, pollAdd, pollCreate, pollModify, pollWait, tcpConnect } from "nish:net";
import { secret, wipe } from "nish:secret";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const config = new PgConfig();
  config.user = "app";
  config.database = "app";
  const nonce = new Array<u8>(18);
  crypto.getRandomValues(nonce);
  const password = secret(bytesOf("app password"));
  const conn = new PgConnection(config, password, nonce);
  wipe(password);

  const batch = new PgBatchConfig();
  batch.name = "user_by_id";
  batch.select = "select u.id, u.name from users u where u.id = q.key";
  const users = new PgBatcher(batch);
  users.addInt(toI64(7), 0); // the key, and a tag naming the request
  users.addInt(toI64(3), 1);
  users.addInt(toI64(7), 2);
  const noTypes: i32[] = [];
  let run: i32 = -1;

  const addr = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", 5432);
  const fd = tcpConnect(addr);
  const loop = pollCreate();
  pollAdd(loop, fd, 2, 0);
  const ready: i32[] = [0, 0];
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(fd) !== 0) {
    return 1;
  }
  pollModify(loop, fd, 3, 0);

  let code: i32 = 1;
  let running: boolean = true;
  while (running) {
    // Send what the connection queued.
    while (conn.outputEnd() > conn.outputStart()) {
      const n = netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart());
      if (n < 0) {
        break;
      }
      conn.sent(n);
    }
    // Read what the server answered, and act on each event.
    const got = netRead(fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom());
    if (got === 0) {
      conn.closed();
    } else if (got > 0) {
      conn.received(got);
    }
    let event = conn.next();
    while (event !== PG_NEED_MORE && running) {
      if (event === PG_READY) {
        conn.prepare(users.name, users.sql, noTypes);
        run = users.take(conn); // binds ids 7 and 3 as one execution
        conn.sync();
      } else if (event === PG_ROW && run >= 0) {
        users.row(run, conn);
      } else if (event === PG_COMPLETE && run >= 0) {
        users.end(run);
      } else if (event === PG_ERROR) {
        const e = conn.lastError;
        console.log(e === null ? "error" : `${e.code}: ${e.message}`);
        if (run >= 0) {
          users.fail(run);
        }
      } else if (event === PG_GROUP_DONE) {
        code = conn.groupFailed ? 1 : 0;
        conn.terminate();
        netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart());
        running = false;
      } else if (event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure}`);
        running = false;
      }
      // What the event owes each request, before the next event moves the row.
      for (let e = run >= 0 ? users.next(run) : PG_BATCH_NONE; e !== PG_BATCH_NONE; e = users.next(run)) {
        if (e === PG_BATCH_ROW) {
          console.log(`request ${users.tag}: ${conn.int(0)} ${conn.columnText(1)}`);
        } else if (e === PG_BATCH_MISSING) {
          console.log(`request ${users.tag}: no such user`);
        }
      }
      if (running) {
        event = conn.next();
      }
    }
    if (running) {
      pollWait(loop, ready, 5000);
    }
  }
  conn.dispose();
  netClose(fd);
  return code;
};
```

A real program keeps one loop for all its sockets, asks for writability only
while output is queued, and gives up on a connection that stays silent; the
shape stays the same.

## Events

`next()` frames the next message in the input buffer and answers what it did:

| Event | Meaning | Read |
| --- | --- | --- |
| `PG_NEED_MORE` | the buffer holds no whole message: read more | |
| `PG_READY` | authenticated and ready; answered once | `backendPid`, `serverVersion` |
| `PG_DESCRIBED` | a prepared statement was described | `columns`, `columnType(c)`, an OID: `23` is `int4` |
| `PG_ROW` | a row | `int(c)`, `bool(c)`, `isNull(c)`, `columnText(c)`, `colStart(c)` and `colLength(c)` |
| `PG_COMPLETE` | a statement finished | `tagIs("UPDATE")`, `tagRows()` |
| `PG_ERROR` | a statement failed; the rest of its group is skipped | `lastError` |
| `PG_NOTICE` | the server sent a notice | `lastNotice`, `notices` |
| `PG_GROUP_DONE` | a `sync()`'s group is answered | `groupFailed`, `txStatus` (`73` idle, `84` in a transaction, `69` in a failed one) |
| `PG_FAILED` | final: the connection is over | `failure`, and `lastError` when the server said why |

A row's columns are not copied: `colStart(c)` is an offset into
`inputBuffer()` and `colLength(c)` its length, `-1` for NULL, and they stay
valid until the next `next()`, which may move the unread input to the start
of the buffer or replace the buffer with a larger one: fetch `inputBuffer()`
again after every `next()` rather than keep it, and `outputBuffer()` after
every builder call.

`int`, `bool` and `isNull` read a column where
it lies; `columnText` makes a string. `conn.text` decodes the rest in place:
`timestamp(b, start, length, out, at)` writes a `timestamptz` as
`2024-01-02T03:04:05.123Z` into `out`, and a `PgArrayWalker` walks a `text[]`
column element by element. A decoder that meets text it cannot read answers
`0`, `false` or `-1` and sets `conn.text.failed`.

### Binary results

Open a bind with `bindStartBinary(name)` instead of `bindStart(name)` and
the server sends every result column of that execution in binary format: an
`int8` is eight bytes, a `timestamptz` eight bytes of microseconds since
2000-01-01 UTC, a `bool` one byte. Nothing is parsed, and a row of ids,
counts and times is smaller on the wire. Read its columns with the binary
decoders:

```ts
conn.bindStartBinary("post");
conn.paramInt(id);
conn.bindEnd();
conn.sync();
// on PG_ROW:
const postId: i64 = conn.binaryInt(0); // int2, int4 or int8, by its length
const body: string = conn.columnText(1); // text is the same bytes either way
const n: i32 = conn.binary.timestamp(conn.inputBuffer(), conn.colStart(2), conn.colLength(2), out, 0);
// out[0, n) is 2025-12-31T23:59:19.409Z, the microseconds cut to milliseconds
```

`binaryBool(c)` and `binaryFloat(c)` (a `float8`) read the other fixed-size
kinds, `binaryInt(c)` of a time is its microseconds, and
`conn.binary.iso(micros, out, at)` writes those as `PgText.timestamp` would.
A `text` or `varchar` column needs nothing new. A column of another type, a
`numeric` or a `text[]`, comes in PostgreSQL's own binary layout, which no
decoder here reads: cast it to `text` in the SQL, or bind with `bindStart`.
Rows do not say which format they are in; the program knows which of its
binds asked for binary and reads that execution's rows with
`conn.binary`, whose `failed` is set as `conn.text.failed` is.

A [`PgBatcher`](#batching-keyed-reads) whose `PgBatchConfig` sets `binary` does
the same for each of its batches: `take` opens the bind with
`bindStartBinary`, so every row comes in binary, and `row` reads the routing
ordinal, the last column, with `binaryInt` (an `int8`, the `unnest` ordinal
PostgreSQL sends in binary). It saves and restores `binary.failed` as it
does `text.failed` for a text batch, so the program's own decoding is left as
it was. A batch that leaves `binary` false is unchanged.

A one-dimensional `int2[]`, `int4[]` or `int8[]` column is the exception: it
is read in place by `PgBinaryArray`, which takes the column's window and walks
its elements in order:

```ts
// on PG_ROW, column 3 is an int4[] of ids:
const ids: PgBinaryArray = new PgBinaryArray(conn.binary);
ids.begin(conn.inputBuffer(), conn.colStart(3), conn.colLength(3));
let sum: i64 = 0;
let r: i32 = ids.next();
while (r === PG_ARRAY_ELEMENT) {
  sum += ids.int();
  r = ids.next();
}
// r is PG_ARRAY_END when the array was read whole, `ids.count` elements
```

`begin` reads the header; `next()` answers `PG_ARRAY_ELEMENT`, `PG_ARRAY_NULL`
(an element that is NULL, which is not an error) or `PG_ARRAY_END`, and
`PG_ARRAY_BAD` for an array it refuses. An empty array has no elements, and
`ids.count` is 0 for it. An `ndim` above 1 is refused, as is another element
type, an element whose length is not its type's size, and bytes left over
after the last element; each refusal sets `conn.binary.failed`.

## Statements, groups and pipelining

Every statement goes through the extended protocol, so parameters never meet
the SQL text:

- `prepare(name, sql, paramTypes)` parses and describes a statement. The types
  are OIDs, and `0` lets the server infer one.
- `bindStart(name)`, then one `paramInt`, `paramText`, `paramBytes`,
  `paramTextArray`, `paramIntArray`, `paramInt4Array`, `paramInt8Array`,
  `paramNull` or array (below) per
  parameter, then `bindEnd()`, runs it. `bindStartBinary(name)` does the
  same and asks for the rows in [binary](#binary-results).
- `closeStatement(name)` frees it on the server.
- `sync()` ends the group.

The server answers groups in order, and an error skips only the rest of its own
group. Up to `PgConfig.maxInFlight` groups may wait for their answers at once:
send the next before the last is answered, and the round trips overlap.
`canSend()` says whether another group may start.

A builder call that may not run now — before `PG_READY`, past the cap, a
`prepare` inside an open bind, a `param...` call or `bindEnd()` with no bind
open, a `paramBytes` window outside its array, a name or SQL holding a NUL
byte, or a message that would put more than `PgConfig.maxOutput` bytes (1 MiB)
waiting to be sent — answers `false` and writes nothing. `sync()` and
`terminate()` are never refused for room. Send what is queued and call
`sent(n)`, and the room comes back.

### Array parameters

An array parameter lets one statement take a whole batch, as in
`select ... from unnest($1::text[]) with ordinality as u(x, ord)` or
`where id = any($1::int8[])`:

- `paramIntArray(values, start, count)` binds `values[start, start + count)`
  as an `int8[]`; `count` 0 is the empty array.
- `paramTextArray(items)` binds a `string[]` as a `text[]`.
- `arrayStart()`, then `arrayElement(bytes, start, length)` (a UTF-8 window),
  `arrayInt(value)` (an `i64`, in decimal) or `arrayNull()` for each element,
  then `arrayEnd()`, builds one element at a time, straight into the Bind,
  with no array of the elements first.

```ts
conn.bindStart("names");
conn.arrayStart();
for (let i: i32 = 0; i < count; i++) {
  if (!conn.arrayElement(body, starts[i], lengths[i])) {
    break; // no room under maxOutput: end the array, send the rest next time
  }
}
conn.arrayEnd();
conn.bindEnd();
```

Every element is quoted, with `"` and `\` escaped, so commas, braces, spaces
and the word `NULL` arrive as text; only `arrayNull()` is a NULL. The array is
sent as a text literal, so the server reads it as whatever type the statement
gives the parameter: the same elements bind to `$1::int4[]` or `$1::varchar[]`.

An element refused for room answers `false`, writes nothing and leaves the
array open, so the elements already in it can still be sent: end the array
and the Bind, and put the rest in the next statement. `arrayEnd()` is never
refused. When not even the first element fits, `bindCancel()` drops the open
bind, array and all, unsent, as if `bindStart` had never been called.

While an array is open, `sync()`, `prepare`, `closeStatement` and `bindStart`
answer `false`, as with any open bind. Using an array out of order is a bug, so
it panics: an element or `arrayEnd()` with no `arrayStart()`, a second
`arrayStart()`, or any other `param...` call or `bindEnd()` before
`arrayEnd()`. So do an `arrayElement` window outside its array and a
`paramIntArray` range outside `values`.

In a group that fails, `PG_DESCRIBED` still comes once for each `prepare` the
server parsed before the error: count them to know which statements exist (a
named one outlives its group) and which to prepare again. The connection does
not track names: a second `prepare("x")` while `x` exists fails its group with
SQLSTATE `42P05`, so keep names unique or `closeStatement` first.

### Binary integer array parameters

`paramInt4Array(values, start, count)` and `paramInt8Array(values, start,
count)` bind the same `i64[]` window as `paramIntArray`, but as an `int4[]` or
`int8[]` in PostgreSQL's binary layout: a fixed header, then four or eight
bytes an element, with no digits to write on the client or parse on the
server. `binaryArrayStart(oid)` (`23` for `int4`, `20` for `int8`), then
`binaryArrayInt(value)` or `binaryArrayNull()` for each element, then the
same `arrayEnd()`, builds one element at a time, NULLs included.

```ts
conn.bindStart("posts_by_ids"); // where id = any($1::int8[])
conn.paramInt8Array(ids, 0, toI32(ids.length));
conn.bindEnd();

conn.bindStart("scores"); // from unnest($1::int4[])
conn.binaryArrayStart(23);
for (let i: i32 = 0; i < count; i++) {
  if (!(missing[i] ? conn.binaryArrayNull() : conn.binaryArrayInt(scores[i]))) {
    break; // no room: end the array, send the rest next time
  }
}
conn.arrayEnd();
conn.bindEnd();
```

A binary array is not a literal the server reinterprets: its element type
must be the statement's. Send an `int4[]` where the parameter is `int8[]`
and the server fails that execution with SQLSTATE `42804`
(`PG_ERROR`, as any error); the connection and the rest of the pipeline go
on. An `int4` element outside `-2^31..2^31-1` panics rather than wrapping,
as do a `binaryArrayStart` OID other than `23` or `20`, a binary element in a
text array or a text element in a binary one, and a window outside `values`.
Room is refused, and `bindCancel()` works, exactly as for the text arrays.

A bind whose parameters are all text sends one format code, as before; the
first binary parameter makes `bindEnd()` write a code for every parameter,
two bytes each, which the bind keeps free under `maxOutput` from then on.

Binary pays wherever the array is long. On PostgreSQL 18, with seven runs of
[`bench/postgres/arrays.mjs`](https://github.com/amritk/nish/blob/main/bench/postgres/arrays.mjs) (median, at
1,000 elements):

| measure | type | text | binary | cut |
| --- | --- | ---: | ---: | ---: |
| server CPU per Bind/Execute, `unnest($1)` | `int4` | 259.4 µs | 180.3 µs | 30%, within spread |
| server CPU per Bind/Execute, `unnest($1)` | `int8` | 357.4 µs | 176.2 µs | 51% |
| server CPU per Bind/Execute, `id = any($1)` | `int8` | 1255.4 µs | 1085.0 µs | within spread |
| client CPU per array encoded | `int4` | 52.3 µs | 5.60 µs | 89% |
| client CPU per array encoded | `int8` | 98.2 µs | 7.65 µs | 92% |
| client CPU per `array_agg` column decoded | `int8` | 62.6 µs | 10.3 µs | 84% |

The encode rows time the whole parameter both ways: a Bind holding the
array, cancelled, less a Bind holding one NULL.

At ten elements the server's cost is the same either way; where the
statement's own work dominates, as an index probe per element in
`id = any($1)` does, the format barely shows. Use binary for long `unnest`
batches and for any client that encodes many arrays; `paramIntArray` remains
for a statement whose parameter type is not `int4[]` or `int8[]`.

## Connecting over a Unix socket

A server on the same machine also listens on a Unix socket, and `psql`'s
`host=/var/run/postgresql` reaches it there. `pgTarget(host, port)` reads a
host and port the way `libpq` does, and `pgTargetUrl(url)` reads a
`postgres://` or `postgresql://` URL; each gives a `PgTarget` and opens
nothing. When `failure` is `PG_TARGET_OK`, a `unix` target is
`unixConnect(target.path)` ([`nish:net`](networking.md)), and any other is
`netAddress(addr, target.host, target.port)` and `tcpConnect(addr)`. Either
way the connection is the same `PgConnection`.

```ts nish:ok
import { PG_TARGET_OK, pgTargetUrl } from "nish/net/postgres";
import { netAddress, tcpConnect, unixConnect } from "nish:net";

export const main = (): i32 => {
  const target = pgTargetUrl("postgres://app@%2Fvar%2Frun%2Fpostgresql/app");
  if (target.failure !== PG_TARGET_OK) {
    return 2;
  }
  console.log(target.path); // /var/run/postgresql/.s.PGSQL.5432
  let fd: i32 = 0;
  if (target.unix) {
    fd = unixConnect(target.path);
  } else {
    const addr = new Array<u8>(18);
    netAddress(addr, target.host, target.port);
    fd = tcpConnect(addr);
  }
  return fd < 0 ? 1 : 0;
};
```

- A host starting with `/` is the socket's **directory**: the socket is
  `<host>/.s.PGSQL.<port>`, the name the server gives it. A path to the socket
  file itself is taken as a directory too, as `libpq` takes it, and names a
  socket that does not exist.
- A host starting with `@` is a Linux abstract socket, `@<name>/.s.PGSQL.<port>`.
- Any other host is TCP, and the target's `host` is it, unchanged.
  `pgTarget` does not percent-decode: `%2Ftmp` is a TCP host there.
- In a URL, the host, the port and the query are percent-decoded, once, so a
  directory is written `%2Fvar%2Frun%2Fpostgresql`, or given as
  `?host=/var/run/postgresql`. A `host` or `port` in the query overrides the
  one before the path; other keys are ignored. No port means 5432. An IPv6
  address is bracketed, `postgres://[::1]:5433/app`, and its `host` comes
  without the brackets.
- The user and password end at the first `@`, as in `libpq`. Write an `@` in
  a password as `%40`: a second raw `@` before the path is refused rather
  than read as part of the host.
- Refused, with `failure` saying why: another scheme or a query key with no
  `=` (`PG_TARGET_BAD_URL`); a `%` without two hex digits after it, `%00`, or
  escapes that decode to bytes that are not UTF-8, anywhere in the URL
  (`PG_TARGET_BAD_ESCAPE`); no host, more than one (a `,`), an unclosed `[`
  or text after its `]` other than `:port`, a raw `@` after the first or
  after a `?`, or a NUL byte anywhere (`PG_TARGET_BAD_HOST`); a port that is
  not 1 to 65535 (`PG_TARGET_BAD_PORT`); and a socket path longer than the
  107 bytes Linux holds, counted in bytes and never cut short
  (`PG_TARGET_TOO_LONG`). macOS holds 103: there `unixConnect` returns `-36`
  for a path between the two.
- An empty port, `?port=` or `?host=` is refused, where `libpq` takes an
  empty value as unset: leave the key out instead.

Over a socket the server can authenticate by `peer`, the operating system's
word for which user is connecting, or `trust`; either way it sends
`AuthenticationOk` without asking for the password, and the connection never
uses it ([below](#authentication)).

## Authentication

The password is a `Secret<u8[]>` ([`nish:secret`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#secrets-nishsecret)):
the connection keeps its own copy, so the caller wipes theirs at once, and it
wipes the copy once the proof is computed, or when the connection fails or is
disposed. The nonce is 18 random bytes from
the caller, so the connection itself reads no randomness.

The connection accepts `trust` and `scram-sha-256`, PostgreSQL's default
since version 14, and checks the server's signature before it believes the
server. It refuses a server that asks for a cleartext or `md5` password, and
fails with `PG_ERR_AUTH_UNSUPPORTED`: there is no TLS here, so the first would
send the password as it is, and the second sends a hash anyone who sees it can
replay. Set the role's password with `password_encryption = scram-sha-256`.

The password's bytes are used as they are, without SASLprep (RFC 4013), the
normalisation PostgreSQL applies to a non-ASCII password. An ASCII password
works; a non-ASCII one works only if it is already in SASLprep's form, and
otherwise the server refuses it.

## Failures and caps

`failure` says why a connection ended:

| Code | Name | Cause |
| --- | --- | --- |
| `1` | `PG_ERR_FRAME` | a message whose length or layout does not add up |
| `2` | `PG_ERR_TOO_BIG` | a message over `maxMessage`, or a row over `maxColumns` |
| `3` | `PG_ERR_UNEXPECTED` | a message the protocol does not allow at that point, COPY among them |
| `4` | `PG_ERR_AUTH_UNSUPPORTED` | cleartext, `md5`, GSS, SSPI, or a SASL mechanism other than SCRAM-SHA-256 |
| `5` | `PG_ERR_SCRAM` | a malformed SCRAM exchange, or iterations outside `minIterations`..`maxIterations` |
| `6` | `PG_ERR_SERVER_SIGNATURE` | the server does not know the password |
| `7` | `PG_ERR_SERVER` | a `FATAL` error, or any error before `PG_READY`; `lastError` has it |
| `8` | `PG_ERR_ENCODING` | a `client_encoding` other than `UTF8` |
| `9` | `PG_ERR_CLOSED` | you called `closed()`: the stream ended |
| `10` | `PG_ERR_SETTING` | a `DateStyle` that is not `ISO` alone or `ISO` then a comma (`ISO, MDY`), or a `TimeZone` other than `UTC`, at startup or after a `SET` |

The connection asks for `DateStyle=ISO` and `TimeZone=UTC` at startup, so that
`conn.text.timestamp` reads the time the server means; a session that changes
either fails rather than be misread.

The caps in `PgConfig` bound what a server can make the client hold or
compute: `maxMessage` (1 MiB), `maxColumns` (1664), `maxInFlight` (16), and
the SCRAM iteration count, 4096 to 100000; `maxOutput` (1 MiB) bounds what
the program can queue unsent. A cap out of range — `maxMessage` or
`maxOutput` under 1024, `maxInFlight` or `minIterations` under 1, and so on —
an empty `user`, a startup parameter holding a NUL, or a nonce shorter than 18
bytes is a mistake in the program, and the constructor panics.

## A pool

`PgPool` holds up to `size` connections to one server and a queue of requests
waiting for one. It is sans-IO like the connection: it says which slot needs a
socket, and your loop makes it and moves its bytes.

```ts
const pool = new PgPool(config, password, 4, 256); // 4 connections, 256 waiting requests
wipe(password); // the pool keeps its own copy until dispose()
pool.register("by_id", "select name from users where id = $1", [20]);
const fds: i32[] = [-1, -1, -1, -1]; // slot s's socket
const ticket: i32 = pool.request(); // PG_POOL_FULL when 256 wait

// Each turn of the loop: send what waits, then connect what is wanted.
for (let slot: i32 = pool.dispatch(); slot >= 0; slot = pool.dispatch()) {
  const conn = pool.connection(slot); // pool.ticket names the request
  conn.bindStart("by_id");
  conn.paramInt(toI64(42));
  conn.bindEnd();
  pool.send(); // ends the group: send(), not sync()
}
for (let slot: i32 = pool.wanted(); slot >= 0; slot = pool.wanted()) {
  const nonce = new Array<u8>(18);
  crypto.getRandomValues(nonce); // a fresh nonce for each connect
  pool.connect(slot, nonce);
  fds[slot] = tcpConnect(addr); // then pollAdd it under a token naming slot
}
// Then, for each slot s whose socket fds[s] was readable, read it and take
// its events as for one connection, with pool.next(s) and pool.ticket.
```

- **Requests.** `request()` queues a request and answers its ticket.
  `dispatch()` hands the oldest one to the ready connection with the fewest
  groups in flight, never more than `PgConfig.maxInFlight` on one. With
  `PgConfig.pack` set it hands it instead to the first ready connection with
  room, filling one to `maxInFlight` before using the next: fewer, fuller
  writes, which pays on a lossy link to the server. Build its
  group on `connection(slot)` and end it with `send()`. Until it is sent,
  `dispatch()` answers `PG_POOL_NONE`: a request handed out and never sent
  holds the pool.

  `send()` answers `false` when nothing was handed out, when
  a bind is still open (finish it and call again), and when no message of the
  group was written. Then a live connection drops the request, and a failed
  one keeps it and reports it `PG_LOST` with the rest. A connection is made only when
  the waiting requests outgrow the ones there are, one for every
  `maxInFlight` of them, up to `size`; each `dispatch()` that finds no room
  wants at most one more.
- **Statements.** A statement given to `register` is prepared on each
  connection in the same write as its first request, so a request binds it by
  name at once. Register them all before the first `connect`; after it,
  `register` answers `false`, as it does for a name or SQL holding a NUL and
  past 256 statements.
- **Events.** `next(slot)` answers what `PgConnection.next()` does, with
  `ticket` naming the request. An error fails only its own request's group:
  the other requests on the connection are answered.
- **Failures.** When a connection fails, `next(slot)` answers `PG_LOST` for
  each request it took with it, oldest first, then `PG_FAILED`: close the
  socket. After it, `next(slot)` answers `PG_NEED_MORE` until the slot is
  connected again, when a request next needs it. A connection that fails
  before it is ready, while no other is, takes the oldest waiting request
  with it, so a server that cannot be reached empties the queue rather than
  holds it. When a socket's connect fails, its read answers 0 or an error
  other than -11, or its write fails, call `connection(slot).closed()`.
- **Sockets.** The sockets are the program's: it closes one on `PG_FAILED`,
  and at the end. `dispose()` neither sends `Terminate` nor closes a socket;
  call `terminate()` on each connection, flush it and close its socket
  first.
- **The password.** `dispose()` wipes the pool's copy and every
  connection's; `passwordWiped()` says whether it is gone.

The constructor panics on a `size` outside 1 to 1024, on a `queueSize`
outside 1 to 2^20, and on a `maxInFlight` over 1024, as well as on what
`PgConnection` panics on. `connect` panics on a slot that wants no connection,
and after `dispose()`; `connection` and `next` on a slot outside 0 to
`size - 1` or one that never had a connection.

To drive a pool from an HTTP server's route handlers, let `PgCarrier` own
the sockets: [Querying from a route handler](#querying-from-a-route-handler).

## Batching keyed reads

A server that answers many requests for one row each — a user by id, an
article by slug — can send them as one execution instead of one each. A
`PgBatcher` queues those reads, and when a connection is free binds up to
`maxRequests` of them as one statement over an array of their keys:

```sql
select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord)
  cross join lateral (<select>) as t order by q.ord[, <orderBy>]
```

`<select>` is the query for one key, which it reads as `q.key`:
`select a.title from articles a where a.slug = q.key`. (Under [`sorted` false](#skipping-the-ordinal-sort), the `order by q.ord`
goes.) Each distinct key is
bound once however many requests ask for it, and each row goes back to every
one of them. The one exception is keys chosen to collide in the batcher's
table: past 1024 slots of probing a key is bound again rather than found,
and each copy is answered the same. Such keys also cost more per request;
see "Large batches" below.

`PG_BATCH_INT` keys are bound as a text `int8[]`, one `arrayInt` each. The
statement's `$1::int8[]` would take the [binary builder](#binary-integer-array-parameters)
as it is, which the benchmark puts at about a tenth of the client's encoding
CPU and, for a batch of 1,000 keys, a 51% cut in the server's on the `unnest`;
the batcher does not use it yet.

```ts
const config = new PgBatchConfig();
config.name = "article_by_slug";
config.keyType = PG_BATCH_TEXT; // PG_BATCH_INT (the default) binds int8 keys
config.select = "select a.id, a.title from articles a where a.slug = q.key";
config.maxRequests = 64;
const articles = new PgBatcher(config);
pool.register(articles.name, articles.sql, noTypes); // prepare `sql` under `name`

// Per request: the key is copied in, and the tag comes back with its answers.
if (!articles.addText(body, slugStart, slugLength, requestId)) {
  // The queue is full (queueSize requests, or queueBytes of text keys), the
  // key is longer than maxBytes allows, or it holds a NUL or is not UTF-8:
  // answer 503, or 400 for a bad key.
}

// Each pool request is one take, and its events name it by pool.ticket, so
// keep the run each ticket got. Tickets count up, so a ring of more slots
// than requests can be outstanding at once (connections plus queue) holds
// every live one.
const RING: i32 = 512;
const runs: i32[] = new Array<i32>(RING);

// When the loop has a connection for it:
const slot = pool.dispatch(); // after pool.request() while articles.waiting() > 0
runs[pool.ticket % RING] = articles.take(pool.connection(slot)); // a handle, or -1: nothing bound
pool.send();

// For each event: the pool's own name no request (pool.ticket is -1).
const run: i32 = pool.ticket >= 0 ? runs[pool.ticket % RING] : -1;
if (run >= 0) {
  if (event === PG_ROW) {
    articles.row(run, conn);
  } else if (event === PG_COMPLETE) {
    articles.end(run);
  } else if (event === PG_ERROR || event === PG_LOST) {
    articles.fail(run);
  }
  for (let e = articles.next(run); e !== PG_BATCH_NONE; e = articles.next(run)) {
    // articles.tag is the request; for PG_BATCH_ROW, conn's current row is its row.
  }
}
```

`next(run)` answers, for each request, a `PG_BATCH_ROW` for each of its rows,
then one last event: `PG_BATCH_DONE` after at least one row,
`PG_BATCH_MISSING` when its key had none, or `PG_BATCH_FAILED` when the
execution failed (the rows it had may be incomplete). Call it until it answers
`PG_BATCH_NONE` after every `row`, `end` and `fail`, before the connection's
next event: a row's columns are read from the connection, where they last only
until then.

### Skipping the ordinal sort

The `order by q.ord` is what lets a request's last event come early: once a
row for a later key arrives, every earlier key is finished. It costs the
server a Sort node over the whole result. Set `sorted` to `false` and the
statement has no `order by` at all, or ` order by <orderBy>` alone when
`orderBy` is set:

```sql
select t.*, q.ord from unnest($1::int8[]) with ordinality as q(key, ord)
  cross join lateral (<select>) as t[ order by <orderBy>]
```

```ts
config.sorted = false; // the default is true: ordered by q.ord, as above
```

Rows then come in whatever order the plan gives them, and each is answered
at once, a `PG_BATCH_ROW` for every request of its key. No last event comes
before the execution ends: after `end`, each request gets `PG_BATCH_DONE` if
its key had a row or `PG_BATCH_MISSING` if not, in key order, then request
order. A `fail` gives every request one `PG_BATCH_FAILED`, those whose key
already had rows too. So a request holds its rows until the whole batch is
done; choose this when the batch is answered as a whole anyway, or the sort
is what dominates the execution.

A non-empty `orderBy` still sorts the whole result by it, so the Sort node
stays. To drop every sort, leave `orderBy` empty and order a key's rows
yourself, as they arrive. The live suite's `explain` scenario
(`tests/postgres/live`) checks that the plan has no Sort node.

- **Caps.** `maxRequests` (32, at most 65536) bounds the requests one execution answers;
  `maxBytes` (32 KiB) the key array's text; `queueSize` (1024) the requests
  waiting, and `queueBytes` (64 KiB) their text keys; `runs` (16) the
  executions in flight at once. A cap out of range, an empty `name` or
  `select`, or a NUL in them or in `orderBy` panics in the constructor.
- **Large batches.** For ordinary keys, a take's cost per request stays
  flat as `maxRequests` grows: memory grows with the largest take so far,
  not with the cap, and finding a key's duplicate stops after 1024 probes,
  past which the key is simply bound again. Int keys built to share one
  table hash are the exception: each still costs at most 1024 probes, but
  from 1,024 to 65,536 such keys the measured time per key rose 2.3×
  (2.8 µs to 6.4 µs, against a 35% noise band), where spread keys stayed
  within noise. For a take of thousands of requests, raise the other
  caps with it: `queueSize` to at least `maxRequests`, `maxBytes` to fit
  every key's text (about 20 bytes an int8 key), the connection's `maxOutput`
  above `maxBytes`, and `maxMessage` if a single row is large.
- **Taking fewer.** `take` binds the oldest requests first and stops at the
  first whose key would pass `maxBytes`, or that the connection refuses for
  room under `maxOutput`; the rest stay queued for the next take. It answers
  -1 and writes nothing when nothing waits, every run is in flight, or the
  connection has no room even for the first key.

  `addText` refuses a key
  whose escaped text could never fit `maxBytes`, but one past what a
  connection could ever hold stays at the head of the queue. A take that
  fills `maxBytes` always fits a connection with nothing else unsent when
  `maxBytes + name.length + 32` is at most its `maxOutput`; leave more for
  whatever else the group queues.
- **Handles.** `take` answers a handle for the run, not a reused number: a
  run is free again once all its events are answered after `end` or `fail`,
  and its next take answers a new handle. A handle that is spent — its run
  answered, or taken again — makes `row`, `end` and `fail` do nothing and
  `next` answer `PG_BATCH_NONE`, and counts the call in `stray`; so a server
  that answers twice, or a connection lost after its answer, cannot touch the
  run's next batch.

  Only a caller's mistake panics: `row`, `end` or `fail`
  before `next(run)` answered `PG_BATCH_NONE`, a negative handle or one no
  take could answer, `addInt` on a text batcher, and `addText` on an int8 one
  or with a window outside its array.
- **Ordinals.** Rows are routed by the ordinal in their last column, which
  comes from the server. `row` refuses one that is NULL, not an integer, past
  the keys, or before the key the last row was for: it answers `false`,
  counts it in `refused`, and fails the run, so a confused server cannot hand
  one request's rows to another.
- **One key, one column.** A key is one `int8` or one `text`. A composite key
  — two columns — is out of its scope: encode it into one text key, or use
  `paramTextArray` and your own statement.

The batcher reads no clock. It takes what waits whenever it is asked, so a
loop that calls `take` as soon as a connection is free sends small batches
when traffic is light and large ones when it is heavy, without waiting. To
collect for a while first, let your loop decide when to ask: take when
`waiting()` reaches a size you choose, or when the oldest request has waited
longer than a window you time with your own clock, whichever comes first.

```ts
const BATCH_WINDOW_MS: i32 = 2;
let asked: boolean = false; // a request is queued and its dispatch has not come
const due = articles.waiting() >= 32 || (articles.waiting() > 0 && nowMs() - oldestAddedMs >= BATCH_WINDOW_MS);
if (due && !asked && pool.request() >= 0) {
  asked = true; // and false again on its dispatch, which takes, as above
}
// And pass min(timeout, the window left) to pollWait, so the loop wakes for it.
```

[`tests/postgres/live/live.ts`](https://github.com/amritk/nish/blob/main/tests/postgres/live/live.ts)'s
`batch` scenario drives three batchers through a pool against a live server.

### When to take: `PgBatchClock`

A fixed window costs latency when traffic is quiet and buys nothing when it
is heavy. A `PgBatchClock` decides for you, from the time you pass it in
microseconds; it reads no clock and allocates only when it is made. A batch is
due when either

- at least max(`minCount`, the moving average of recent batch sizes ×
  `factor`) items wait, or
- the oldest has waited `maxWaitUs`;

and, with the idle bypass on, at once when nothing is in flight and fewer than
`lightCount` items arrived in the last `lightWindowUs`. Under a backlog the
count is already there, so nothing waits on the timer, and a batch started by
count is never smaller than the average, so batches do not shrink while the
backlog lasts.

```ts
const timing = new PgBatchClockConfig();
// The defaults are the fixed window: 32 items or 10 ms, whatever the load.
timing.maxCount = config.maxRequests; // the batcher's own cap
timing.queueSize = config.queueSize;
timing.minCount = 16;
timing.factor = 1.1;
timing.lightCount = 8;
const clock = new PgBatchClock(timing);

// Per request, beside addText: the clock mirrors the batcher's queue.
if (articles.addText(body, slugStart, slugLength, requestId)) {
  clock.arrived(nowUs());
}

// When the loop has a connection: takeDue takes only when the clock says so.
runs[pool.ticket % RING] = articles.takeDue(pool.connection(slot), clock, nowUs(), pool.inFlight());

// And wake the loop for the timer: deadline() is -1 when nothing waits.
const deadline = clock.deadline();
```

| Setting | Default | What it does |
| --- | --- | --- |
| `maxCount` | 32 | The most items one batch takes; set it to the batcher's `maxRequests`. |
| `minCount` | 32 | The fewest that start a batch by count. |
| `factor` | 0 | The share of the recent average that must wait; 0 leaves it out. Above 1, batches grow until the timer bounds them. |
| `weight` | 0.25 | How far each batch moves the average, over 0 up to 1. |
| `maxWaitUs` | 10000 | The longest the oldest item waits, in µs. |
| `lightCount`, `lightWindowUs` | 0, 10000 | The idle bypass; 0 turns it off. |
| `queueSize` | 1024 | The most items waiting; the batcher's `queueSize`. |

A setting out of range panics in the constructor. After each start,
`average`, `lastSize`, `lastWaitUs` and `lastReason` — `PG_CLOCK_COUNT`,
`PG_CLOCK_AVERAGE`, `PG_CLOCK_TIMER` or `PG_CLOCK_IDLE` — are there for your
metrics, and `startsFor(reason)` counts the starts for each. `takeDue` panics
when the clock does not mirror the batcher: its waiting count is not
`waiting()`, or its `maxCount` is below `maxRequests`.

With several connections, `PgBatchTurns` lets one free connection collect
while the others execute: `push(now)` records an item and answers the slot to
wake only when its batch is due (`PG_TURNS_NONE` otherwise, `PG_TURNS_FULL`
when the queue is), `poll(now)` does the same at `deadline()`, and the woken
slot calls `started(slot, size, now)` or `release(slot)`, then
`finished(slot, now)` when its batch is done.

The fixed window stays the default until measurements against a live server
say otherwise. [`bench/pg-batch-clock.ts`](https://github.com/amritk/nish/blob/main/bench/pg-batch-clock.ts)
models a pool at three loads; there, the adaptive settings above match the
better of a 10 ms and a 30 ms window at each.

## Querying from a route handler

`nish/net/postgres-carrier` puts a pool on an
[`HttpHandler`](api-server.md)'s loop. `PgCarrier` connects the pool's
slots, reads and writes their sockets, and watches them from the handler's
own `wait`, so a route handler hands its request to the carrier and goes on
serving: a slow query holds only the requests waiting on it. It is a module
of its own because it reads sockets, the clock and the entropy source, and
`nish/net/postgres` reaches none of them.

```ts
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { PgBatchConfig, PgBatcher, PgConfig, PgConnection, PgPool, pgTarget } from "nish/net/postgres"
import {
  PG_CARRIER_BUILD, PG_CARRIER_DONE, PG_CARRIER_FAILED, PG_CARRIER_FULL,
  PG_CARRIER_MISSING, PG_CARRIER_NONE, PG_CARRIER_ROW, PgCarrier, PgCarrierLimits,
} from "nish/net/postgres-carrier"

const pool = new PgPool(config, password, 4, 256)
pool.register("article", "select body from articles where id = $1", [toI32(20)])
const handler = new HttpHandler(new HandlerLimits(), listener, router)
const carrier = new PgCarrier(new PgCarrierLimits(), pool, pgTarget("127.0.0.1", 5432), handler)
const users: i32 = carrier.attach(new PgBatcher(usersConfig))
// Whether query q's request was answered: a ROW answers it, and the final
// event answers only one that no row did.
const answered: boolean[] = new Array<boolean>(256)

while (running) {
  handler.wait(50)
  while (handler.ready()) {
    const req: HttpRequest = handler.take()
    const q: i32 = req.route === USER
      ? carrier.runInt(req, users, toI64(req.paramDecimal(0)), USER)
      : carrier.run(req, ARTICLE)
    if (q === PG_CARRIER_FULL) {
      handler.send(req, 503, text, none, 0, 0)
    }
  }
  let event: i32 = carrier.next()
  while (event !== PG_CARRIER_NONE) {
    if (event === PG_CARRIER_BUILD) {
      const conn: PgConnection = carrier.connection()
      conn.bindStart("article")
      conn.paramInt(toI64(carrier.request().paramDecimal(0)))
      conn.bindEnd()
      carrier.send()
    } else if (event === PG_CARRIER_ROW) {
      if (!answered[carrier.query]) {
        const conn: PgConnection = carrier.connection()
        handler.send(carrier.request(), 200, text, conn.inputBuffer(), conn.colStart(0), conn.colLength(0))
        answered[carrier.query] = true
      }
    } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING || event === PG_CARRIER_FAILED) {
      if (!answered[carrier.query]) {
        handler.send(carrier.request(), event === PG_CARRIER_FAILED ? 503 : 404, text, none, 0, 0)
      }
      answered[carrier.query] = false
    }
    event = carrier.next()
  }
}
carrier.close()
```

- **`run(req, tag)`** queues a plain query and answers its number at once,
  or `PG_CARRIER_FULL` when the carrier holds `queries` already. When a
  connection takes it, `next()` answers `PG_CARRIER_BUILD`: bind the
  statement on `connection()` and call `send()` before the next `next()`.
- **`runInt` and `runText`** queue a key for a batcher `attach` gave you
  (at most 8, attached before the pool connects). The carrier takes a batch
  whenever a connection is free and answers each key's rows to its own
  request; a key with no row is `PG_CARRIER_MISSING`.
- **Events.** A query's final event comes whether or not it had rows, so
  answer the request once: on its first row, or on the final event when no
  row came. Each query gets its rows (`PG_CARRIER_ROW`, read on
  `connection()` before the next call), then exactly one of
  `PG_CARRIER_DONE`, `PG_CARRIER_MISSING` and `PG_CARRIER_FAILED`. On each,
  `query` is the number `run` answered, `tag` what you passed, and
  `request()` the request to answer; they hold until the following `next()`,
  which frees the query.
- **Failures.** A connection that is refused, reset, closed or not
  authenticated within `connectTimeoutMs` (5000 by default) fails every query
  on it with `PG_CARRIER_FAILED`: `failure` is the connection's `PG_ERR_*`
  (9, closed, for a socket that failed) and `socketError` the socket's error,
  `-110` for the timeout. The next query makes a new connection. While no
  connection is up, each failed connect also fails the oldest waiting query,
  one per slot per turn, so give `wait` a timeout: a server that cannot be
  reached empties the queue over the following turns. A query the
  server refuses fails with `failure` 0 and its error on
  `connection().lastError`, after `PG_CARRIER_ERROR`.
- **Caps.** `PgCarrierLimits` sets `queries` (256) and `executions` (64), each
  at most 65536, before the carrier starts; nothing grows after, and once the
  connections are up nothing is allocated per query. `watch` is the id the
  carrier is watched under on the handler (0 to 15), if your program watches
  other descriptors.
- **The target** is a Unix socket or a numeric address: the carrier resolves
  no names.

There is no deadline on a query once its connection is up: bound a slow
statement with the server's `statement_timeout`. `close()` closes the
carrier's sockets; the pool's `dispose()` still wipes the password. Queries
in flight at `close()` get no further event, so answer their requests
yourself. After it, `run`, `runInt` and `runText` answer `PG_CARRIER_FULL`
and `next()` answers `PG_CARRIER_NONE`, and a second `close()` does nothing.

The constructor panics on a cap or `watch` id out of range, a target that failed or a host
name; `attach` past 8 batchers, after the pool connected, on a NUL in the
batcher's name or SQL, or past 256 statements; `runInt` and
`runText` on an id `attach` never gave; `request()` for a query run with no
request; `connection()` before an event named one; `send()` with no build
open; and `next()` with one still open.

[`tests/postgres/carrier.ts`](https://github.com/amritk/nish/blob/main/tests/postgres/carrier.ts) is a whole
program that serves HTTP while a query sleeps on a live server.

## Awaiting a query from a task

`nish/net/postgres-async` is a pool for an [`async`](../language/async.md) program: a
spawned task awaits its query, and while it waits on the socket the executor
runs the program's other tasks. It is three calls, not one, because a spawned
task may write only numbers into what it shares: `pgAsyncClaim` and
`pgAsyncRelease` mark a connection taken and free, and `pgAsyncQuery` builds
its result in the task's own memory.

```ts
import { spawn } from "nish:async"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import {
  PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncQuery, pgAsyncRelease,
} from "nish/net/postgres-async"

async function title(pool: PgAsyncPool, id: i32): Promise<void> {
  const ticket: i32 = await pgAsyncClaim(pool)
  if (ticket < 0) {
    return // -1: no live connection; -2: none came free within claimWaitMs
  }
  const params = new PgAsyncParams()
  params.int(id)
  const r = await pgAsyncQuery(pool, ticket, "select title from article where id = $1", params)
  pgAsyncRelease(pool, ticket, r.reusable)
  if (r.ok() && r.rows > 0) {
    console.log(r.text(0, 0))
  }
}

export async function main(): Promise<i32> {
  const config = new PgConfig()
  config.user = "app"
  const pool = new PgAsyncPool(4)
  const password = secret(passwordBytes())
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", 5432))
  wipe(password)
  spawn(title(pool, 1))
  spawn(title(pool, 2))
  // ... wait for the tasks, then pool.close()
  return live === pool.size ? 0 : 1
}
```

- **Run each query in a spawned task.** The task's memory, and every buffer,
  row and string its query built, is freed when the task ends, so a server
  that runs thousands of queries stays the same size. A query awaited in
  `main` keeps about 9 KB until `main` returns.
- **Claim, query, release, once each.** A ticket names one connection and one
  claim of it. Give it to `pgAsyncRelease` exactly once, with the result's
  `reusable`: a second release, or a ticket from before `close()`, panics, so
  two tasks never share a connection.
- **Waiting for a connection.** When all are claimed, `pgAsyncClaim` waits
  on the pool's wake, which a release rings, and answers -2 once
  `claimWaitMs` (5000 by default) has passed.
- **A result.** `ok()` is true when the server ran the statement; `failure`
  is the `PG_ERR_*` code (0 with `errorCode` and `errorMessage` for an error
  the server sent, 8 for a NUL in the SQL or a text parameter, 9 for a lost
  socket, with `socketError`). `rows` and `columns` count what came back;
  read a cell with `text`, `int` or `isNull`, which panic outside the result.
- **Caps.** `maxMessage` (1 MiB) bounds one message, `maxColumns`
  (1664) a row, `maxRows` (100000) and `maxResultBytes` (16 MiB: each row's
  bytes and 16 a cell, each command tag's and error's bytes) a result. Rows,
  tags and errors past `maxRows` or `maxResultBytes` are read and dropped,
  and the query fails 2 (`PG_ERR_TOO_BIG`) with the rows that fit. `maxMessage` and `maxResultBytes` take 1024 to 2^30-1,
  `maxColumns` 1 to 65535 and `maxRows` 1 to 2^24; `pgAsyncQuery` panics on
  a cap outside its range.
- **Reuse.** A connection goes back to the pool only when its query ended
  idle, changed no setting and left no bytes after its answer. A
  transaction left open, a `SET`, a lost socket, a frame no query expects,
  a message past `maxMessage` or a row past `maxColumns` closes it, so no
  task inherits another's session. `pgAsyncConnect` fills the slots that
  have no connection; call it again when `live()` falls.
- **The target** is a Unix socket or a numeric address: the pool resolves no
  names. Parameters go in text, never spliced into the SQL.

`pgAsyncConnect` gives each connection `connectWaitMs` (10000 by default) to
connect and finish its startup, and leaves a slot empty past it; `connects`
counts the connections it made. A query's wait has no deadline of its own: a
server that accepts and never answers holds the task awaiting it until the task is cancelled, by `cancelAfter` in
`nish:async` or by a server's `deadline`. A cancelled claim answers -3 and
holds nothing; a cancelled query fails with `socketError` -3 and its
connection is closed, since its answer would reach nobody, and the pool
dials another. The server is sent no CancelRequest, so bound a slow statement
with its `statement_timeout` as well. The constructor panics on a size outside 1..64, and
`pgAsyncConnect` on a target that failed or a host name.

A handler of [`nish/net/serve`](async-server.md#reaching-the-programs-state)
reaches the pool the same way: written as an arrow in `main`, it captures
`pool`, and each request's task claims, queries and releases, then answers
with a cell of the result, which is the task's own memory:

```ts
return await serve(8080, router, new ServeLimits(), async (req: Request): Promise<Response> => {
  const ticket: i32 = await pgAsyncClaim(pool)
  if (ticket < 0) {
    return new Response(503).text("no connection\n")
  }
  const params = new PgAsyncParams()
  params.int(req.paramNumber(0))
  const r = await pgAsyncQuery(pool, ticket, "select title from article where id = $1", params)
  pgAsyncRelease(pool, ticket, r.reusable)
  return r.ok() && r.rows > 0 ? new Response(200).text(r.text(0, 0)) : new Response(404)
})
```

### Pipelining statements from many tasks

A claim holds a connection for one task's whole round trip. For short
statements, let tasks share connections instead: register each statement once
with `pgAsyncPrepare`, then each task takes a seat on a connection, sends,
waits for its turn and reads its answer. Up to `depth` (8 by default, at most
16) statements from different tasks are in flight on one connection at once,
and each is parsed once a connection, then only bound and executed:

```ts nish:ok
import { spawn } from "nish:async"
import {
  PgAsyncParams, PgAsyncPool, pgAsyncAnswer, pgAsyncDone, pgAsyncPrepare, pgAsyncSeat, pgAsyncSend,
  pgAsyncTurn,
} from "nish/net/postgres-async"

async function title(pool: PgAsyncPool, statement: i32, id: i32): Promise<void> {
  const ticket: i32 = await pgAsyncSeat(pool, statement)
  if (ticket < 0) {
    return
  }
  const params = new PgAsyncParams()
  params.int(id)
  const sent: i32 = await pgAsyncSend(pool, ticket, params)
  const turn: i32 = await pgAsyncTurn(pool, ticket, sent)
  const r = await pgAsyncAnswer(pool, ticket, turn)
  pgAsyncDone(pool, ticket, turn, r.reusable)
  console.log(r.ok() && r.rows > 0 ? r.text(0, 0) : "none")
}

export async function main(): Promise<i32> {
  const pool = new PgAsyncPool(4)
  const byId: i32 = pgAsyncPrepare(pool, "select title from article where id = $1")
  // ... pgAsyncConnect as above ...
  for (let id: i32 = 1; id <= 100; id++) {
    spawn(title(pool, byId, id))
  }
  return 0
}
```

- **Five calls, in order, in the task.** `pgAsyncSeat` fixes the
  statement's place in the connection's order, so the task makes the other
  four calls straight after it, each once, with no other `await` between.
  `pgAsyncDone` spends the ticket; a ticket used after it, or a statement
  number `pgAsyncPrepare` did not give, panics.
- **Answers come back in order.** A statement the server refuses fails
  alone and the ones behind it are answered. A connection lost, sent a frame
  past a cap, or left out of step by a cancelled task fails every statement
  in flight on it with `PG_ERR_CLOSED` and is closed, so a slow statement
  delays the ones seated behind it: keep long or transactional work on
  `pgAsyncClaim`.
- **Waiting for a seat.** When every connection has `depth` in flight,
  `pgAsyncSeat` waits on the pool's wake, which an answered statement rings,
  and answers -2 after `claimWaitMs`; -1 when none is connected. Waiting
  tasks are seated in the order they began to wait, so a task that keeps
  asking cannot take every seat that frees.

## What it does not do

TLS, `COPY`, `LISTEN`/`NOTIFY` (a notification is read and dropped), a CancelRequest
for a cancelled query, binary-format parameters other than `int4[]` and `int8[]`,
binary results for a type other
than an integer, `bool`, `float8`, time, text or a one-dimensional `int2[]`,
`int4[]` or `int8[]`, so a `text[]`, a `numeric` and an array of more than
one dimension stay in text, a mix of text and binary columns in one execution,
and the simple query protocol. A pool
neither reads a clock nor retries: a request waits in its queue until a
connection takes it, and one lost with its connection is the program's to run
again.

A target names one host: there is no list of hosts to try in turn, and no
default socket directory for a URL with no host, which `libpq` would use.
The user, password and database in a URL are not read by `pgTargetUrl`; set
them on the `PgConfig`.

It does not insist on authentication: a server that answers
`AuthenticationOk` without asking for a password is believed, as
`libpq` does without `require_auth`. `conn.text.timestamp` checks a
timestamp's shape and year but not its month, day or time, which it takes on
the server's word.
