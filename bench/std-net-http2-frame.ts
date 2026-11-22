// HTTP/2 frames and HPACK (std/net/http2-frame.ts, std/net/hpack.ts) under an
// instruction count: `n` rounds that each parse a buffer of frames a server
// receives (a HEADERS frame whose block one HpackEncoder built for a request,
// a padded DATA frame, a SETTINGS and a WINDOW_UPDATE) with http2ReadHeader
// and http2ParseFrame, and decode each HEADERS block with one HpackDecoder,
// whose dynamic table the repeated blocks hit. It reaches the frame window,
// length and HPACK cursor reads whose panic sites the std/ ratchet counts, so
// a fix to one of them shows here as a count that holds or falls. It prints a
// sum over what it parsed.
import {
  H2_DEFAULT_MAX_FRAME,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_FRAME_HEADER_SIZE,
  H2_FRAME_HEADERS,
  H2_NO_ERROR,
  Http2Frame,
  http2ParseFrame,
  http2ReadHeader,
  http2WriteData,
  http2WriteHeaders,
  http2WriteSettings,
  http2WriteWindowUpdate,
} from "nish/net/http2-frame"
import {
  HPACK_INDEX_INCREMENTAL,
  HPACK_INDEX_WITHOUT,
  HPACK_OK,
  HpackDecoder,
  HpackEncoder,
} from "nish/net/hpack"

/** The bytes of `s`, one per code unit. */
const ascii = (s: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < s.length; i++) {
    out.push(toU8(s.charCodeAt(i)))
  }
  return out
}

export const main = (): i32 => {
  const n: i32 = 1000 // bench:n
  const fields: string[] = [
    ":method",
    "GET",
    ":scheme",
    "https",
    ":authority",
    "www.example.com",
    ":path",
    "/index.html?query=nish&page=2",
    "user-agent",
    "nish-bench/1.0 (x86_64-linux)",
    "accept",
    "text/html,application/xhtml+xml",
    "accept-encoding",
    "gzip, deflate, br",
    "cookie",
    "session=7f3a9c2e41b8d06a; theme=dark",
  ]
  const encoder = new HpackEncoder(4096)
  const blocks: u8[][] = []
  for (let b: i32 = 0; b < 2; b++) {
    const block: u8[] = []
    for (let i: i32 = 0; i + 1 < fields.length; i += 2) {
      const indexing: i32 = i === 14 ? HPACK_INDEX_WITHOUT : HPACK_INDEX_INCREMENTAL
      encoder.encodeField(block, ascii(fields[i]), ascii(fields[i + 1]), indexing, (i & 2) === 0)
    }
    blocks.push(block)
  }
  const body: u8[] = ascii('{"name":"nish","frames":[1,2,3,4,5,6,7,8],"padding":"................"}')
  const buf: u8[] = new Array<u8>(4096)
  let end: i32 = 0
  for (let b: i32 = 0; b < blocks.length; b++) {
    const block: u8[] = blocks[b]
    end = http2WriteHeaders(buf, end, 1 + 2 * b, block, 0, toI32(block.length), H2_FLAG_END_HEADERS, 0)
    end = http2WriteData(buf, end, 1 + 2 * b, body, 0, toI32(body.length), H2_FLAG_END_STREAM, 8)
  }
  end = http2WriteSettings(buf, end, [1, 3, 4, 5], [4096, 100, 1048576, 16384])
  end = http2WriteWindowUpdate(buf, end, 0, 983041)
  if (end < 0) {
    console.log("write failed")
    return 1
  }
  const frame = new Http2Frame()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const decoder = new HpackDecoder(4096, 65536)
    for (let repeat: i32 = 0; repeat < 4; repeat++) {
      let off: i32 = 0
      while (off < end) {
        if (!http2ReadHeader(frame, buf, off, end - off)) {
          console.log(`short header at ${off}`)
          return 1
        }
        const error: i32 = http2ParseFrame(frame, buf, off, H2_DEFAULT_MAX_FRAME)
        if (error !== H2_NO_ERROR) {
          console.log(`frame error ${error} at ${off}`)
          return 1
        }
        if (frame.type === H2_FRAME_HEADERS) {
          const status: i32 = decoder.decode(buf, frame.contentStart, frame.contentLength)
          if (status !== HPACK_OK) {
            console.log(`hpack error ${status} at ${off}`)
            return 1
          }
          for (let f: i32 = 0; f < decoder.names.length; f++) {
            sum += toI64(decoder.names[f].length + decoder.values[f].length)
          }
        }
        sum += toI64(frame.type + frame.length + frame.contentLength)
        off += H2_FRAME_HEADER_SIZE + frame.length
      }
    }
  }
  console.log(`${sum}`)
  return 0
}
