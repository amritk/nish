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

The program below connects to a server on `127.0.0.1:5432`, prepares one
statement, runs it, and prints each row. The connection asks for nothing a
round trip does not need: the statement is prepared, bound and executed in one
write.

```ts nish:ok
import {
  PG_COMPLETE,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_NEED_MORE,
  PG_READY,
  PG_ROW,
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
        conn.prepare("by_id", "select id, name from users where id > $1", [20]);
        conn.bindStart("by_id");
        conn.paramInt(toI64(0));
        conn.bindEnd();
        conn.sync();
      } else if (event === PG_ROW) {
        console.log(`${conn.int(0)} ${conn.columnText(1)}`);
      } else if (event === PG_COMPLETE) {
        console.log(`${conn.tagRows()} rows`);
      } else if (event === PG_ERROR) {
        const e = conn.lastError;
        console.log(e === null ? "error" : `${e.code}: ${e.message}`);
      } else if (event === PG_GROUP_DONE) {
        code = conn.groupFailed ? 1 : 0;
        conn.terminate();
        netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart());
        running = false;
      } else if (event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure}`);
        running = false;
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
valid until the next `next()`. `int`, `bool` and `isNull` read a column where
it lies; `columnText` makes a string. `conn.text` decodes the rest in place:
`timestamp(b, start, length, out, at)` writes a `timestamptz` as
`2024-01-02T03:04:05.123Z` into `out`, and a `PgArrayWalker` walks a `text[]`
column element by element. A decoder that meets text it cannot read answers
`0`, `false` or `-1` and sets `conn.text.failed`.

## Statements, groups and pipelining

Every statement goes through the extended protocol, so parameters never meet
the SQL text:

- `prepare(name, sql, paramTypes)` parses and describes a statement. The types
  are OIDs, and `0` lets the server infer one.
- `bindStart(name)`, then one `paramInt`, `paramText`, `paramBytes`,
  `paramTextArray` or `paramNull` per parameter, then `bindEnd()`, runs it.
- `closeStatement(name)` frees it on the server.
- `sync()` ends the group.

The server answers groups in order, and an error skips only the rest of its own
group. Up to `PgConfig.maxInFlight` groups may wait for their answers at once:
send the next before the last is answered, and the round trips overlap.
`canSend()` says whether another group may start. A builder call that may not
run now — before `PG_READY`, past the cap, a `prepare` inside an open bind, a
name or SQL holding a NUL byte — answers `false` and writes nothing.

## Authentication

The password is a `Secret<u8[]>` ([`nish:secret`](../../LANGUAGE.md#nishsecret)):
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

The caps in `PgConfig` bound what a server can make the client hold or
compute: `maxMessage` (1 MiB), `maxColumns` (1664), `maxInFlight` (16), and
the SCRAM iteration count, 4096 to 100000.

## What it does not do

TLS, `COPY`, `LISTEN`/`NOTIFY` (a notification is read and dropped), query
cancellation, binary-format results and the simple query protocol. A pool is a
program's own: an array of connections and the loop above.
