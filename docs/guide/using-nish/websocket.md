# WebSocket

`nish/net/websocket` speaks WebSocket (RFC 6455): the opening handshake on
both sides and the frames that follow it. Like the rest of `nish/net` it is
*sans-IO*: it takes bytes and answers bytes and never opens a socket, so a
server runs it through `nish/net/http1-server` and a client over the
connection it opened itself, plain TCP from [`nish:net`](networking.md) or TLS
from [`nish/net/tls-tcp`](tls-client.md). It draws no randomness either: the
client's nonce and every mask key are yours to give, from
`crypto.getRandomValues`. It is imported like any other library module
([`export` and `import`](../../LANGUAGE.md#export-and-import)).

## Accepting a WebSocket on a server

An `Http1Connection` answers `H1_REQUEST` with the request's head in
`conn.parser`. `websocketOfferedProtocols(parser)` answers the subprotocols
the client offered (an empty list for none, null for a field that does not
parse); `conn.acceptWebSocket(protocol)` checks the rest of the handshake,
queues the 101 with its `Sec-WebSocket-Accept`, and answers 0. From then on
the slot's `next()` answers `H1_WS_MESSAGE` (the message in `conn.data`,
`conn.dataStart`, `conn.dataLength`, its opcode in `conn.opcode`) and
`H1_WS_CLOSE`; pings and closes are answered for you. Send with
`conn.sendFrame(fin, opcode, buf, off, len)` and end with
`conn.closeWebSocket(code)`.

```ts nish:ok
import { Http1Connection } from "nish/net/http1-server";
import { websocketOfferedProtocols } from "nish/net/websocket";

/** Accepts a WebSocket on `/chat`, choosing `chat` when the client offered it; false when the request was not one. */
export const acceptChat = (conn: Http1Connection): boolean => {
  if (!conn.parser.targetIs("/chat")) {
    return false;
  }
  const offered: string[] | null = websocketOfferedProtocols(conn.parser);
  if (offered === null) {
    return false;
  }
  let chosen: string = "";
  for (const name of offered) {
    if (name === "chat") {
      chosen = name;
    }
  }
  return conn.acceptWebSocket(chosen) === 0;
};

export const main = (): i32 => 0;
```

A request `acceptWebSocket` refuses (`H1_INVALID`) is yours to answer, with a
400, or a 426 for a version other than 13.

## Opening a WebSocket as a client

The client's side is six steps over a connection you opened:

1. **A nonce.** Fill 16 bytes with `crypto.getRandomValues`, a fresh 16 for
   each connection, and make the key: `websocketClientKey(nonce)` answers it,
   or null for a nonce that is not 16 bytes.
2. **The request.** `websocketUpgradeRequest(host, target, key, protocols)`
   answers the request's bytes, with `Host`, `Upgrade: websocket`,
   `Connection: Upgrade`, the key, version 13 and the protocols you offer
   (`[]` for none). It answers null for an empty host, an invalid key, or a
   protocol that is not a token or is offered twice, and nothing you pass can
   end a line. Send the bytes.
3. **Feed the response.** Read the answer with an `Http1ResponseParser`, and
   call `expectUpgrade()` after `expect`, before you feed it: a 101 is
   refused unless you did. Feed it until `next()` answers `HTTP1_HEAD`.
4. **Read the protocol.** `websocketCheckResponse(parser, key, offered)`
   checks the head and answers a `WsHandshake`: `error` is `WS_HS_OK` and
   `protocol` the one the server chose, or `""` for none. Anything else is a
   refusal (below): close the connection.
5. **Hand over the bytes.** `next()` then answers `HTTP1_END` and
   `HTTP1_UPGRADE`, and `tunnelBytes()` answers whatever the server sent past
   its head: its first frames, which can come in the same read. Feed them to a
   `new WsDecoder(false, maxMessage)` (false: a server's frames are not
   masked, and a masked one is refused), then feed it every read after.
6. **Mask every frame.** A client's frames must be masked, each with a fresh
   4-byte key: `websocketFrame(fin, opcode, payload, off, len, mask)` with
   `crypto.getRandomValues` filling `mask` for every frame. Never reuse one.

Over TLS, with `tlsConnect`:

```ts nish:ok
import { netAddress } from "nish:net";
import { HTTP1_HEAD, HTTP1_NEED_MORE } from "nish/net/http1";
import { Http1ResponseParser } from "nish/net/http1-client";
import { tlsConnect } from "nish/net/tls-tcp";
import {
  WS_HS_OK,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_TEXT,
  WsDecoder,
  WsHandshake,
  websocketCheckResponse,
  websocketClientKey,
  websocketFrame,
  websocketUpgradeRequest,
} from "nish/net/websocket";

/** The bytes of `text`, which is ASCII. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", 8443);
  const client = tlsConnect(addr, "localhost", ["http/1.1"], 5000);
  if (!client.open()) {
    return 1;
  }
  // 1. A fresh nonce, and its key.
  const nonce: u8[] = new Array<u8>(16);
  crypto.getRandomValues(nonce);
  const key: string | null = websocketClientKey(nonce);
  // 2. The request, offering chat.
  const offered: string[] = ["chat"];
  const request: u8[] | null = key === null ? null : websocketUpgradeRequest("localhost", "/chat", key, offered);
  if (key === null || request === null || client.writeAll(request, 0, toI32(request.length), 5000) < 0) {
    client.close();
    return 1;
  }
  // 3. Feed the response to a parser told to expect the switch.
  const response = new Http1ResponseParser(256, 4096, 32, toI64(1024), 1024);
  response.expect(false, false);
  response.expectUpgrade();
  const buf: u8[] = new Array<u8>(4096);
  let event: i32 = response.next();
  while (event === HTTP1_NEED_MORE) {
    const n: i32 = client.readWait(buf, 0, toI32(buf.length), 5000);
    if (n <= 0) {
      client.close();
      return 1;
    }
    response.feed(buf, 0, n);
    event = response.next();
  }
  // 4. Check it, and read the protocol.
  const answer: WsHandshake = event === HTTP1_HEAD ? websocketCheckResponse(response, key, offered) : new WsHandshake(-1, "");
  if (answer.error !== WS_HS_OK) {
    console.log(`refused: ${answer.error}`);
    client.close();
    return 1;
  }
  console.log(`protocol: ${answer.protocol === "" ? "none" : answer.protocol}`);
  // 5. What came past the head is the server's first frames.
  response.next();
  response.next();
  const decoder = new WsDecoder(false, 65536);
  const tunnel: u8[] = response.tunnelBytes();
  decoder.feed(tunnel, 0, toI32(tunnel.length));
  // 6. Every frame masked with a fresh key.
  const mask: u8[] = new Array<u8>(4);
  crypto.getRandomValues(mask);
  const hello: u8[] = ascii("hello");
  const frame: u8[] | null = websocketFrame(true, WS_OP_TEXT, hello, 0, toI32(hello.length), mask);
  if (frame === null || client.writeAll(frame, 0, toI32(frame.length), 5000) < 0) {
    client.close();
    return 1;
  }
  let got: i32 = decoder.next();
  while (got === WS_NEED_MORE) {
    const n: i32 = client.readWait(buf, 0, toI32(buf.length), 5000);
    if (n <= 0) {
      client.close();
      return 1;
    }
    decoder.feed(buf, 0, n);
    got = decoder.next();
  }
  if (got === WS_MESSAGE) {
    console.log(`the server sent ${decoder.dataLen} bytes`);
  }
  client.close();
  return 0;
};
```

Over plain TCP the steps are the same; only the reads and writes go to the
socket `nish:net` opened.

## Why a handshake is refused

`websocketCheckResponse` checks the server's head in RFC 6455 §4.1's order and
answers the first thing wrong. Each code is a constant of
`nish/net/websocket`:

| `error` | Code | Refused |
| --- | --- | --- |
| 0 | `WS_HS_OK` | nothing: the server accepted |
| 1 | `WS_HS_STATUS` | a status other than 101; a redirect is not followed, and `parser.status` says which it was |
| 2 | `WS_HS_VERSION` | a 101 that is not HTTP/1.1 |
| 3 | `WS_HS_UPGRADE` | no `Upgrade`, two, or one that is not `websocket` |
| 4 | `WS_HS_CONNECTION` | no `Connection` listing `upgrade` |
| 5 | `WS_HS_ACCEPT` | no `Sec-WebSocket-Accept`, two, or one that is not this key's |
| 6 | `WS_HS_EXTENSION` | any `Sec-WebSocket-Extensions`, since the client offers none |
| 7 | `WS_HS_PROTOCOL` | a protocol you did not offer, a list of them, or the field twice |

A refused handshake is not a WebSocket: close the connection.

## Where next

- [HTTP client](http-client.md) is the response parser the handshake reads.
- [TLS client](tls-client.md) opens the connection a `wss:` WebSocket runs over.
- [The standard library](standard-library.md) lists every module.
