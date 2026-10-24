// The record layer (`nish/net/tls/record`) over a peer's bytes, as a libFuzzer
// target: `fuzzOne` takes one input and keeps nothing past it, and a refusal is
// a negated alert, so a panic here is a finding (docs/security/tls.md).
//
// The first byte picks the reading direction's protection, by its low two
// bits: cleartext, or AES-128-GCM, ChaCha20-Poly1305 or AES-256-GCM installed
// from a fixed traffic secret (RFC 8448's client application secret, and a
// made-up 48-byte one for SHA-384). The second byte shapes the stream: its low
// two bits pick the largest chunk `TlsRecordReader.push` is handed (1, 5, 300
// or 17000 bytes), its top five bits seed the chunk sizes, and bit 2 picks
// what the rest of the input is.
//
// With bit 2 clear the rest is the stream itself, cut into chunks and every
// whole record opened, so a seed is a recorded stream with two bytes before
// it. Almost nothing authenticates that way, so with bit 2 set the rest is a
// script for a writer holding the same key, whose records are what the reader
// gets: that reaches everything `open` does after the tag checks. Each step
// is a type byte, a padding byte (times 64) and a length byte with that many
// content bytes, sealed as one record. A type byte of 255 is a KeyUpdate
// (both directions `advance`), and 254 is a length byte and that many raw
// bytes put on the stream unsealed, as an attacker on the path could.
//
// The reader drains after every chunk, as a connection does; a header it
// refuses ends the stream, since a connection closes there.
import { TLS_ALERT_INTERNAL_ERROR, tlsHexInto } from "nish/net/tls/codec"
import { TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"
import {
  TLS_MAX_PLAINTEXT,
  TLS_MAX_RECORD,
  TlsRecordProtection,
  TlsRecordReader,
  tlsRecordLength,
} from "nish/net/tls/record"

/** RFC 8448 §3's client_application_traffic_secret_0, the SHA-256 suites' key. */
const SECRET_SHA256: string = "9e40646ce79a7f9dc05af8889bce6552875afa0b06df0087f792ebb7c17504a5"

/** Forty-eight bytes for the SHA-384 suite, made up: any secret of the hash's length installs. */
const SECRET_SHA384: string =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"

/** The suite the low two bits of `byte` pick, or 0 for cleartext. */
const pickSuite = (byte: u8): i32 => {
  const which: i32 = toI32(byte) % 4
  if (which === 1) {
    return TLS_AES_128_GCM_SHA256
  }
  if (which === 2) {
    return TLS_CHACHA20_POLY1305_SHA256
  }
  return which === 3 ? TLS_AES_256_GCM_SHA384 : 0
}

/** A fresh copy of the fixed secret for `suite`: each direction gets its own, since `advance` writes over it. */
const secretFor = (suite: i32): u8[] => {
  const text: string = suite === TLS_AES_256_GCM_SHA384 ? SECRET_SHA384 : SECRET_SHA256
  const out: u8[] = new Array<u8>(toI32(text.length) >> 1)
  tlsHexInto(text, out, 0)
  return out
}

/** The largest chunk the low two bits of `byte` pick: one byte at a time, up to more than a whole record. */
const pickChunk = (byte: u8): i32 => {
  const which: i32 = toI32(byte) % 4
  if (which === 0) {
    return 1
  }
  if (which === 1) {
    return 5
  }
  return which === 2 ? 300 : 17000
}

/**
 * The reading side of one connection: the reader, the protection it opens
 * records under, where their content goes, and the chunk sizes the stream is
 * cut into. `dead` is set once the reader refuses a header, after which a
 * connection would have closed.
 */
class Receiver {
  reader: TlsRecordReader
  protection: TlsRecordProtection
  out: u8[]
  seed: i32
  maxChunk: i32
  chunks: i32 = 0
  dead: boolean = false

  constructor(seed: i32, maxChunk: i32) {
    this.reader = new TlsRecordReader()
    this.protection = new TlsRecordProtection()
    this.out = new Array<u8>(TLS_MAX_PLAINTEXT + 1)
    this.seed = seed
    this.maxChunk = maxChunk
  }
}

/** The next chunk size, 1 to `maxChunk`, from the seed and how many chunks came before. */
const nextChunk = (rx: Receiver): i32 => {
  rx.chunks = rx.chunks + 1
  const k: i32 = rx.chunks % 1000
  return ((rx.seed * 31 + k * 17 + ((k * k) % 97)) % rx.maxChunk) + 1
}

/** Opens and lets go every whole record the reader holds; a refused header ends the stream. */
const drain = (rx: Receiver): void => {
  const reader: TlsRecordReader = rx.reader
  while (!rx.dead) {
    const length: i32 = reader.next()
    if (length < 0) {
      rx.dead = true
      return
    }
    if (length === 0) {
      return
    }
    if (tlsRecordLength(reader.buffer, reader.start, length) !== length) {
      panic("tls-record: next() answered a length tlsRecordLength does not")
    }
    const got: i32 = rx.protection.open(reader.buffer, reader.start, length, rx.out, 0)
    if (got === -TLS_ALERT_INTERNAL_ERROR) {
      // The window and the room are the target's to get right, and both are.
      panic("tls-record: open refused a whole record the reader framed")
    }
    if (got > TLS_MAX_PLAINTEXT) {
      panic("tls-record: open answered more content than a record holds")
    }
    reader.consume(length)
  }
}

/** Puts `src[off .. off + len)` on the stream in the receiver's chunk sizes, draining after each. */
const feed = (rx: Receiver, src: u8[], off: i32, len: i32): void => {
  let at: i32 = off
  while (at < off + len && !rx.dead) {
    const size: i32 = nextChunk(rx)
    const take: i32 = size < off + len - at ? size : off + len - at
    const pushed: i32 = rx.reader.push(src, at, take)
    if (pushed < 0) {
      panic("tls-record: push refused a window inside its array")
    }
    at += pushed
    drain(rx)
    if (pushed === 0 && !rx.dead) {
      // A drained reader always has room for the next record, so taking
      // nothing here would stall a connection for good.
      panic("tls-record: the reader took no bytes after draining")
    }
  }
}

/** Runs the writer's script from `data[from]` (see the header), sealing each step under `writer` and feeding it to `rx`. */
const script = (
  rx: Receiver,
  writer: TlsRecordProtection,
  writeSecret: u8[],
  readSecret: u8[],
  data: u8[],
  from: i32
): void => {
  const n: i32 = toI32(data.length)
  const record: u8[] = new Array<u8>(TLS_MAX_RECORD)
  let at: i32 = from
  while (at < n && !rx.dead) {
    const type: i32 = toI32(data[at])
    at += 1
    if (type === 255) {
      if (writer.isProtected()) {
        writer.advance(writeSecret)
        rx.protection.advance(readSecret)
      }
      continue
    }
    if (type === 254) {
      if (at >= n) {
        return
      }
      const raw: i32 = toI32(data[at]) < n - at - 1 ? toI32(data[at]) : n - at - 1
      feed(rx, data, at + 1, raw)
      at += 1 + raw
      continue
    }
    if (at + 1 >= n) {
      return
    }
    const padding: i32 = toI32(data[at]) * 64
    const length: i32 = toI32(data[at + 1]) < n - at - 2 ? toI32(data[at + 1]) : n - at - 2
    at += 2
    const sealed: i32 = writer.seal(type, data, at, length, padding, record, 0)
    at += length
    if (sealed > 0) {
      feed(rx, record, 0, sealed)
    }
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  // Headers anywhere in the input, and windows a caller may not pass, which
  // are refused rather than read.
  for (let at: i32 = 0; at < n && at < 16; at++) {
    tlsRecordLength(data, at, n - at)
  }
  const before: i32 = tlsRecordLength(data, -1, 1)
  const after: i32 = tlsRecordLength(data, n, 1)
  if (before !== -TLS_ALERT_INTERNAL_ERROR || after !== -TLS_ALERT_INTERNAL_ERROR) {
    panic("tls-record: tlsRecordLength read a window outside its array")
  }
  if (n < 2) {
    return
  }
  const suite: i32 = pickSuite(data[0])
  const rx: Receiver = new Receiver(toI32(data[1]) >> 3, pickChunk(data[1]))
  const readSecret: u8[] = secretFor(suite)
  if (suite !== 0 && !rx.protection.install(suite, readSecret)) {
    panic("tls-record: the fixed key did not install")
  }
  if ((toI32(data[1]) >> 2) % 2 === 0) {
    feed(rx, data, 2, n - 2)
  } else {
    const writer: TlsRecordProtection = new TlsRecordProtection()
    const writeSecret: u8[] = secretFor(suite)
    if (suite !== 0) {
      writer.install(suite, writeSecret)
    }
    script(rx, writer, writeSecret, readSecret, data, 2)
  }
  rx.reader.reset()
}
