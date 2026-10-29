# HTTP client

`nish/net/http1-client` is the client side of HTTP/1.1: it writes a request's
head and reads the response, bytes in and events out. It opens no socket and
knows no TLS: your program sends the bytes the writer answers, and feeds the
parser whatever it receives, cut anywhere. It is imported like any other
library module ([`export` and `import`](../../LANGUAGE.md#export-and-import)).
The event constants are shared with the server side and come from
`nish/net/http1`.

## A first request

```ts nish:ok
import { HTTP1_BODY, HTTP1_END, HTTP1_ERROR, HTTP1_HEAD, HTTP1_NEED_MORE, HTTP1_NO_BODY } from "nish/net/http1";
import { Http1ResponseParser, http1RequestHead } from "nish/net/http1-client";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

// Hands the parser every event its input holds, and answers whether the response ended.
const drain = (p: Http1ResponseParser): boolean => {
  let event: i32 = p.next();
  while (event !== HTTP1_NEED_MORE) {
    if (event === HTTP1_HEAD) {
      const type = p.header("content-type");
      console.log(`status ${p.status}, ${type === null ? "no type" : type}`);
    } else if (event === HTTP1_BODY) {
      console.log(`body: ${String.fromBytes(p.body, p.bodyOff, p.bodyOff + p.bodyLen)}`);
    } else if (event === HTTP1_END) {
      console.log(`end, keep-alive ${p.keepAlive()}`);
      return true;
    } else if (event === HTTP1_ERROR) {
      console.log(`refused with ${p.error}: ${p.errorText}`);
      return true;
    }
    event = p.next();
  }
  return false;
};

export const main = (): i32 => {
  const head = http1RequestHead("GET", "/hello", ["Host", "Accept"], ["example.com", "text/plain"], toI64(HTTP1_NO_BODY));
  if (head === null) {
    return 1;
  }
  console.log(String.fromBytes(head, 0, toI32(head.length)));

  // What a server might answer, arriving in two pieces.
  const reply = bytesOf("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\n\r\nhello");
  const p = new Http1ResponseParser(1024, 16384, 64, toI64(1048576), 4096);
  p.expect(false, false);
  p.feed(reply, 0, 20);
  drain(p);
  p.feed(reply, 20, toI32(reply.length) - 20);
  drain(p);
  return 0;
};
```

`http1RequestHead` answers the request line and the header section, `Host`
first and your fields after it in their order, or `null` for anything it
refuses. The parser is made once for a connection with its limits, told what
the request was with `expect`, and fed; `next()` answers one event at a time
until it answers `HTTP1_NEED_MORE`, which asks for more input. The events and
the body are the same however the response is cut: the first `drain` above
sees nothing, since the header section is not whole yet.

## The request head

The last argument says how the body is framed, and the writer adds the field
for it, after yours:

| `bodyLength` | The head ends with |
| --- | --- |
| `n`, 0 or more | `Content-Length: n` |
| `HTTP1_CHUNKED` (-1) | `Transfer-Encoding: chunked`; write each piece with `http1Chunk` and the end with `http1LastChunk`, from `nish/net/http1` |
| `HTTP1_NO_BODY` (-2) | neither, for a request without a body, such as a `GET` |

`http1WriteRequestHead(out, at, method, target, names, values, bodyLength)`
writes the same head into your own `u8[]` at `at` and answers the offset just
past it. It answers `HTTP1_NO_ROOM` when the head does not fit and
`HTTP1_REFUSED` for what `http1RequestHead` answers `null` for; either way it
writes nothing.

The writer refuses whatever would let one of your strings end a line or frame
the body on its own:

- a method that is not a token;
- a target that is not a form the method may send: a path starting with `/`
  or an absolute URL, `host:port` for `CONNECT`, `*` for `OPTIONS`; a target
  holding a space, a control byte, a non-ASCII byte or a `#`;
- a field name that is not a token, or a value holding CR, LF or another
  control byte;
- anything but exactly one `Host` field;
- your own `Content-Length` or `Transfer-Encoding`, which `bodyLength` writes;
- a `Connection` field that lists `upgrade`;
- `names` and `values` of different lengths, or a `bodyLength` below -2.

## The events

| Event | What it means |
| --- | --- |
| `HTTP1_INFORMATIONAL` | an interim 1xx response was read; `status` and the fields are its, and the final response follows. It comes from `nish/net/http1-client` |
| `HTTP1_HEAD` | the final response's status line and fields are in: `status`, `reason`, `minor` (the HTTP minor version), `names` and `values` (names in lowercase), `header(name)` (any case), `contentLength` (-1 without one) |
| `HTTP1_BODY` | some body bytes, de-chunked: `body[bodyOff .. bodyOff + bodyLen)`, valid until the next call |
| `HTTP1_END` | the response is complete, trailers included |
| `HTTP1_UPGRADE` | a `CONNECT` was answered with 2xx and the connection is a tunnel: `tunnelBytes()` answers what was fed past the head |
| `HTTP1_CLOSED` | the server closed the connection between responses |
| `HTTP1_ERROR` | the response is refused: `error` holds the code and `errorText` says why |

`HTTP1_UPGRADE`, `HTTP1_CLOSED` and `HTTP1_ERROR` are final: every later call
answers them again, and what is fed after them is dropped.

## How a response ends

- A response to `HEAD`, an interim 1xx, a 204 and a 304 have no body,
  whatever their fields say. Call `p.expect(true, false)` before a response to `HEAD`.
- A 2xx to `CONNECT` is a tunnel; call `p.expect(false, true)` first. It
  answers `HTTP1_HEAD`, then `HTTP1_END` with no body, then `HTTP1_UPGRADE`
  on the next call; `tunnelBytes()` means something only after
  `HTTP1_UPGRADE`, and answers what was fed past the head. Any other answer
  to `CONNECT` has a body like any response.
- `Transfer-Encoding: chunked` is de-chunked; `Content-Length` is that many
  bytes.
- Anything else is read until the server closes. Call `p.finish()` when the
  socket reports the close, then `next()` again.

A close anywhere else, inside a status line, the fields or a body, is the
error `HTTP1_E_TRUNCATED`, so a body cut short is never taken for a whole one.
`expect` holds for one response and is forgotten after its `HTTP1_END`, so a
program sending a second request on the connection calls it again.

`keepAlive()` answers whether the connection may carry the next request once
`HTTP1_END` has come: an HTTP/1.1 response unless `Connection` lists `close`,
an HTTP/1.0 response only when it lists `keep-alive`, and never a response
read until close, a tunnel or an error. On a kept-alive connection, keep
feeding the same parser; the next response follows the last.

## What the parser refuses

A response the parser cannot read in exactly one way is refused, never
repaired, since a client that repairs it differently from a proxy on the path
disagrees with it about where the next response starts. Each code is a
constant of `nish/net/http1-client`:

| `error` | Code | Refused |
| --- | --- | --- |
| 1 | `HTTP1_E_STATUS_LINE` | a malformed status line, or a status outside 100 to 599 |
| 2 | `HTTP1_E_VERSION` | an HTTP major version other than 1 |
| 3 | `HTTP1_E_BARE_LF` | a line ended by LF without CR |
| 4 | `HTTP1_E_FIELD` | a malformed field line: a folded line, whitespace before the colon, a control byte in a value |
| 5 | `HTTP1_E_SWITCH` | a 101, since this client never asks to switch protocols |
| 6 | `HTTP1_E_FRAMING` | `Transfer-Encoding` together with `Content-Length` |
| 7 | `HTTP1_E_CODING` | a transfer coding other than one `chunked`, last, or one in an HTTP/1.0 response |
| 8 | `HTTP1_E_LENGTH` | a `Content-Length` that is not one run of digits, or two that differ |
| 9 | `HTTP1_E_CHUNK` | a malformed chunk size, extension or chunk ending |
| 10 | `HTTP1_E_TRUNCATED` | the connection closed before the response ended |
| 11 | `HTTP1_E_STATUS_LINE_LIMIT` | a status line over `maxStatusLine` |
| 12 | `HTTP1_E_HEADER_LIMIT` | a header section over `maxHeaderBytes` |
| 13 | `HTTP1_E_COUNT_LIMIT` | more fields than `maxHeaders`, trailers included |
| 14 | `HTTP1_E_BODY_LIMIT` | a body over `maxBody`, refused before a byte of it is read when its length is declared |
| 15 | `HTTP1_E_TRAILER_LIMIT` | a trailer section over `maxTrailerBytes` |
| 16 | `HTTP1_E_CHUNK_LINE_LIMIT` | a chunk-size line over `HTTP1_MAX_CHUNK_LINE` (4,096 bytes) |
| 17 | `HTTP1_E_INFORMATIONAL_LIMIT` | more than `HTTP1_MAX_INFORMATIONAL` (32) interim responses to one request |

After an error the connection cannot be trusted: close it.

## Limits

`new Http1ResponseParser(maxStatusLine, maxHeaderBytes, maxHeaders, maxBody,
maxTrailerBytes)` takes every limit a server could push against. `maxBody` is
an `i64`; the rest are `i32`. A negative limit is taken as 0. What the parser
holds is what you fed and it has not handed out yet, which `buffered()`
answers: feed what the socket gave you, then drain `next()`, and the parser
never holds more than a line in progress.

Each response's reason phrase and fields are kept as strings in the arena
until your program resets it, at most `maxHeaderBytes` for each response.

## Where next

- [Networking](networking.md) opens the sockets these bytes travel over.
- [The standard library](standard-library.md) lists every module.
