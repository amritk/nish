// Malformed HTTP/3 frames and QPACK sections are refused with the error code
// the protocol closes the connection with, never a panic (WP82 S6). Each input
// below once reached an index, slice or overflow site in
// `std/net/http3-frame.ts` or `std/net/qpack.ts`; now every one is answered
// as a value (a protocol code, -1 for a GOAWAY payload, 0 for a header not
// yet whole, or the header's size) and the program exits 0. (`--deny-panics` would still refuse the
// calls: they reach the kept panic on a window outside its buffer.)
import {
  Http3FrameHeader,
  Http3Settings,
  h3ReadFrameHeader,
  h3ReadIdPayload,
  h3ReadSettings,
} from "nish/net/http3-frame"
import { QpackDecoder } from "nish/net/qpack"

const bytes = (list: i32[]): u8[] => {
  const out: u8[] = new Array<u8>(list.length)
  let k: i32 = 0
  while (k < toI32(list.length) && k < toI32(out.length)) {
    out[k] = toU8(list[k] & 0xff)
    k += 1
  }
  return out
}

// A SETTINGS payload that ends inside a value: H3_FRAME_ERROR (0x106, 262).
const settings: u8[] = bytes([0x06, 0x40])
const read: i64 = h3ReadSettings(new Http3Settings(), settings, 0, toI32(settings.length))
console.log(`settings cut inside a value: ${read}`)

// A SETTINGS payload that ends inside an 8-byte identifier: H3_FRAME_ERROR.
const longId: u8[] = bytes([0xc0, 0x00, 0x00])
const readLong: i64 = h3ReadSettings(new Http3Settings(), longId, 0, toI32(longId.length))
console.log(`settings cut inside an identifier: ${readLong}`)

// A GOAWAY payload with a byte after its identifier: -1, H3_FRAME_ERROR.
const goaway: u8[] = bytes([0x04, 0x00])
console.log(`goaway with a trailing byte: ${h3ReadIdPayload(goaway, 0, toI32(goaway.length))}`)

// A frame header whose 8-byte length ends at the window: not whole, 0.
const h: Http3FrameHeader = new Http3FrameHeader()
const cut: u8[] = bytes([0x00, 0xff, 0xff, 0xff])
console.log(`header cut inside its length: ${h3ReadFrameHeader(h, cut, 0, toI32(cut.length))}`)

// A frame header claiming the largest length a varint holds: read, 9 bytes,
// with no sum past it taken here.
const huge: u8[] = bytes([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
const size: i32 = h3ReadFrameHeader(h, huge, 0, toI32(huge.length))
console.log(`header of length 2^62 - 1: ${size} bytes, length ${h.length}`)

// A field section whose Required Insert Count the empty table cannot reach:
// QPACK_DECOMPRESSION_FAILED (0x200, 512), refused on its prefix.
const required: u8[] = bytes([0x02, 0x00, 0x80])
const first: i64 = new QpackDecoder(4096).decode(required, 0, toI32(required.length))
console.log(`section requiring inserts never made: ${first}`)

// A field section of Required Insert Count 0 naming a dynamic entry:
// QPACK_DECOMPRESSION_FAILED, for QPACK_REASON_DYNAMIC (5).
const dynamicDecoder: QpackDecoder = new QpackDecoder(4096)
const dynamic: u8[] = bytes([0x00, 0x00, 0x80])
const refused: i64 = dynamicDecoder.decode(dynamic, 0, toI32(dynamic.length))
console.log(`section with a dynamic reference: ${refused}, reason ${dynamicDecoder.reason}`)

// An indexed field line past the static table's last entry (98).
const pastStatic: u8[] = bytes([0x00, 0x00, 0xff, 0x25])
const second: i64 = new QpackDecoder(4096).decode(pastStatic, 0, toI32(pastStatic.length))
console.log(`section past the static table: ${second}`)

// A literal whose length prefix runs past the section.
const longValue: u8[] = bytes([0x00, 0x00, 0x51, 0x7f, 0xff, 0xff, 0xff, 0x0f])
const third: i64 = new QpackDecoder(4096).decode(longValue, 0, toI32(longValue.length))
console.log(`section with a value past its end: ${third}`)

// An encoder stream inserting into a table of capacity 0:
// QPACK_ENCODER_STREAM_ERROR (0x201, 513).
const insert: u8[] = bytes([0xc0, 0x01, 0x61])
const stream: i64 = new QpackDecoder(4096).receiveEncoderStream(insert, 0, toI32(insert.length))
console.log(`insert into a zero-capacity table: ${stream}`)
