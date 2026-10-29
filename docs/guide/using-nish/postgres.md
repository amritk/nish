# PostgreSQL

`nish/net/postgres` is a PostgreSQL client. It reads no socket: a
`PgConnection` writes the messages it wants sent into an output buffer, reads
the server's answers from an input buffer you fill, and tells you what
happened, one event at a time. Your program owns the socket
([`nish:net`](networking.md)) and the loop, so one loop can drive many
connections next to everything else it serves. It is imported like any other
library module ([`export` and `import`](../../LANGUAGE.md#export-and-import)).

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
every builder call. `int`, `bool` and `isNull` read a column where
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

## Statements, groups and pipelining

Every statement goes through the extended protocol, so parameters never meet
the SQL text:

- `prepare(name, sql, paramTypes)` parses and describes a statement. The types
  are OIDs, and `0` lets the server infer one.
- `bindStart(name)`, then one `paramInt`, `paramText`, `paramBytes`,
  `paramTextArray`, `paramIntArray`, `paramNull` or array (below) per
  parameter, then `bindEnd()`, runs it. `bindStartBinary(name)` does the
  same and asks for the rows in [binary](#binary-results).
- `closeStatement(name)` frees it on the server.
- `sync()` ends the group.

The server answers groups in order, and an error skips only the rest of its own
group. Up to `PgConfig.maxInFlight` groups may wait for their answers at once:
send the next before the last is answered, and the round trips overlap.
`canSend()` says whether another group may start. A builder call that may not
run now — before `PG_READY`, past the cap, a `prepare` inside an open bind, a
`param...` call or `bindEnd()` with no bind open, a `paramBytes` window
outside its array, a name or SQL holding a NUL byte, or a message that would
put more than `PgConfig.maxOutput` bytes (1 MiB) waiting to be sent — answers
`false` and writes nothing. `sync()` and `terminate()` are never refused for
room. Send what is queued and call `sent(n)`, and the room comes back.

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
bind, array and all, unsent, as if `bindStart` had never been called. While an
array is open, `sync()`, `prepare`, `closeStatement` and `bindStart` answer
`false`, as with any open bind. Using an array out of order
is a bug, so it panics: an element or `arrayEnd()` with no `arrayStart()`, a
second `arrayStart()`, or any other `param...` call or `bindEnd()` before
`arrayEnd()`. So do an `arrayElement` window outside its array and a
`paramIntArray` range outside `values`.

In a group that fails, `PG_DESCRIBED` still comes once for each `prepare` the
server parsed before the error: count them to know which statements exist (a
named one outlives its group) and which to prepare again. The connection does
not track names: a second `prepare("x")` while `x` exists fails its group with
SQLSTATE `42P05`, so keep names unique or `closeStatement` first.

## Authentication

The password is a `Secret<u8[]>` ([`nish:secret`](../../LANGUAGE.md#secrets-nishsecret)):
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
  groups in flight, never more than `PgConfig.maxInFlight` on one; build its
  group on `connection(slot)` and end it with `send()`. Until it is sent,
  `dispatch()` answers `PG_POOL_NONE`: a request handed out and never sent
  holds the pool. `send()` answers `false` when nothing was handed out, when
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

[`tests/postgres/carrier.ts`](../../../tests/postgres/carrier.ts) is a whole
program: one `pollWait` loop holding the pool's sockets beside an HTTP server,
which answers requests while a query is in flight.

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
`select a.title from articles a where a.slug = q.key`. Each distinct key is
bound once however many requests ask for it, and each row goes back to every
one of them.

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

- **Caps.** `maxRequests` (32, at most 1024) bounds the requests one execution answers;
  `maxBytes` (32 KiB) the key array's text; `queueSize` (1024) the requests
  waiting, and `queueBytes` (64 KiB) their text keys; `runs` (16) the
  executions in flight at once. A cap out of range, an empty `name` or
  `select`, or a NUL in them or in `orderBy` panics in the constructor.
- **Taking fewer.** `take` binds the oldest requests first and stops at the
  first whose key would pass `maxBytes`, or that the connection refuses for
  room under `maxOutput`; the rest stay queued for the next take. It answers
  -1 and writes nothing when nothing waits, every run is in flight, or the
  connection has no room even for the first key. `addText` refuses a key
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
  run's next batch. Only a caller's mistake panics: `row`, `end` or `fail`
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

[`tests/postgres/live/live.ts`](../../../tests/postgres/live/live.ts)'s
`batch` scenario drives three batchers through a pool against a live server.

## What it does not do

TLS, `COPY`, `LISTEN`/`NOTIFY` (a notification is read and dropped), query
cancellation, binary-format parameters, binary results for a type other
than an integer, `bool`, `float8`, time or text, a mix of text and binary
columns in one execution, and the simple query protocol. A pool
neither reads a clock nor retries: a request waits in its queue until a
connection takes it, and one lost with its connection is the program's to run
again.

It does not insist on authentication: a server that answers
`AuthenticationOk` without asking for a password is believed, as
`libpq` does without `require_auth`. `conn.text.timestamp` checks a
timestamp's shape and year but not its month, day or time, which it takes on
the server's word.
