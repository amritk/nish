// The client side of the WebSocket opening handshake (`nish/net/websocket`)
// over a server's bytes, as a libFuzzer target: the response goes through
// `Http1ResponseParser`, told to expect the upgrade, to `websocketCheckResponse`,
// and what follows an accepted head goes to a client's `WsDecoder`. `fuzzOne`
// takes one input and keeps nothing past it; a refusal is a `WS_HS_*` code or
// `HTTP1_ERROR`, so a panic here is a finding (docs/security/http1.md, which
// covers it).
//
// The first two bytes are settings and the rest is the response stream:
//
// - byte 0 is what the client offered: bit 0 `chat`, bit 1 `superchat`.
// - byte 1 is the size of the pieces the stream is cut into; 0 takes
//   everything at once.
//
// The key is RFC 6455's sample, `dGhlIHNhbXBsZSBub25jZQ==` (§1.3), made by
// `websocketClientKey` from its nonce, so that a seed can carry the right
// accept value. What the module promises is checked as it goes: an answer to
// any status but 101 is `WS_HS_STATUS`; an accepted head is a 101 to HTTP/1.1
// whose protocol is "" or one offered, and is followed by `HTTP1_END` and
// `HTTP1_UPGRADE`; the same head checked against another valid key is never
// accepted (a forged accept), and checked with nothing offered is accepted
// only when no protocol was chosen; and the tunnel's bytes decode as a
// server's frames, unmasked, with every text message UTF-8.
import { HTTP1_CLOSED, HTTP1_END, HTTP1_ERROR, HTTP1_HEAD, HTTP1_NEED_MORE, HTTP1_UPGRADE } from "nish/net/http1"
import { HTTP1_INFORMATIONAL, Http1ResponseParser } from "nish/net/http1-client"
import {
  WS_CLOSE,
  WS_ERROR,
  WS_HS_OK,
  WS_HS_PROTOCOL,
  WS_HS_STATUS,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_TEXT,
  WsDecoder,
  WsHandshake,
  websocketCheckResponse,
  websocketClientKey,
  websocketIsUtf8,
} from "nish/net/websocket"

/** RFC 6455's sample nonce, "the sample nonce", whose key is `dGhlIHNhbXBsZSBub25jZQ==`. */
const SAMPLE_NONCE: string = "the sample nonce"

/** Another valid key, whose accept value is not the sample's. */
const OTHER_KEY: string = "AQIDBAUGBwgJCgsMDQ4PEA=="

/** The protocols the first byte offers. */
const offeredBy = (config: i32): string[] => {
  const out: string[] = []
  if (config % 2 === 1) {
    out.push("chat")
  }
  if ((config / 2) % 2 === 1) {
    out.push("superchat")
  }
  return out
}

/** The sample nonce as bytes. */
const sampleNonce = (): u8[] => {
  const out: u8[] = new Array<u8>(16)
  for (let k: i32 = 0; k < 16; k += 1) {
    out[k] = toU8(SAMPLE_NONCE.charCodeAt(k))
  }
  return out
}

/** Reads the server's first frames, as the client would, until the decoder needs more or stops. */
const drainTunnel = (tunnel: u8[]): void => {
  const d: WsDecoder = new WsDecoder(false, 65536)
  d.feed(tunnel, 0, toI32(tunnel.length))
  let e: i32 = d.next()
  while (e !== WS_NEED_MORE && e !== WS_CLOSE && e !== WS_ERROR) {
    if (e === WS_MESSAGE && d.opcode === WS_OP_TEXT && !websocketIsUtf8(d.data, 0, d.dataLen)) {
      panic("websocket-client fuzz: a text message that is not UTF-8")
    }
    e = d.next()
  }
}

/** Checks the head the parser just read, and on an accepted 101 reads the tunnel. */
const checkHead = (p: Http1ResponseParser, key: string, offered: string[]): void => {
  const answer: WsHandshake = websocketCheckResponse(p, key, offered)
  if (p.status !== 101) {
    if (answer.error !== WS_HS_STATUS) {
      panic("websocket-client fuzz: an answer other than 101 is not WS_HS_STATUS")
    }
    return
  }
  const none: string[] = []
  const unoffered: WsHandshake = websocketCheckResponse(p, key, none)
  if (answer.error !== WS_HS_OK) {
    if (unoffered.error === WS_HS_OK) {
      panic("websocket-client fuzz: a head refused with protocols offered is accepted with none")
    }
    return
  }
  if (websocketCheckResponse(p, OTHER_KEY, offered).error === WS_HS_OK) {
    panic("websocket-client fuzz: the accept of one key is taken for another's")
  }
  if (p.minor !== 1) {
    panic("websocket-client fuzz: an accepted head that is not HTTP/1.1")
  }
  let known: boolean = toI32(answer.protocol.length) === 0
  for (const name of offered) {
    if (name === answer.protocol) {
      known = true
    }
  }
  if (!known) {
    panic("websocket-client fuzz: an accepted protocol the client did not offer")
  }
  const expected: i32 = toI32(answer.protocol.length) === 0 ? WS_HS_OK : WS_HS_PROTOCOL
  if (unoffered.error !== expected) {
    panic("websocket-client fuzz: with nothing offered, a chosen protocol is not refused")
  }
  if (p.next() !== HTTP1_END || p.next() !== HTTP1_UPGRADE || p.next() !== HTTP1_UPGRADE) {
    panic("websocket-client fuzz: an accepted head is not followed by HTTP1_END and HTTP1_UPGRADE")
  }
  drainTunnel(p.tunnelBytes())
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < 2) {
    return
  }
  const offered: string[] = offeredBy(toI32(data[0]))
  const size: i32 = toI32(data[1])
  const key: string | null = websocketClientKey(sampleNonce())
  if (key === null || key !== "dGhlIHNhbXBsZSBub25jZQ==") {
    panic("websocket-client fuzz: the sample nonce does not make RFC 6455's sample key")
  }
  const p: Http1ResponseParser = new Http1ResponseParser(256, 4096, 32, toI64(1024), 1024)
  p.expect(false, false)
  p.expectUpgrade()
  let at: i32 = 2
  while (true) {
    const e: i32 = p.next()
    if (e === HTTP1_HEAD) {
      checkHead(p, key, offered)
      return
    }
    if (e === HTTP1_ERROR || e === HTTP1_CLOSED || e === HTTP1_UPGRADE) {
      return
    }
    if (e === HTTP1_NEED_MORE) {
      if (at >= n) {
        return
      }
      const take: i32 = size === 0 || size > n - at ? n - at : size
      p.feed(data, at, take)
      at += take
    } else if (e !== HTTP1_INFORMATIONAL) {
      panic("websocket-client fuzz: an event before the head")
    }
  }
}
