// A malformed HPACK block is a handled error, never a panic: each block below
// is refused with the `HPACK_ERR_*` code RFC 7541 calls for, the decoder that
// refused it answers that code again, and a fresh decoder decodes a good block.
import {
  HPACK_ERR_HUFFMAN_EOS,
  HPACK_ERR_INDEX,
  HPACK_ERR_INTEGER_OVERFLOW,
  HPACK_ERR_SIZE_UPDATE_POSITION,
  HPACK_ERR_TABLE_SIZE,
  HPACK_ERR_TRUNCATED,
  HPACK_OK,
  HpackCursor,
  HpackDecoder,
  hpackDecodeInteger,
} from "nish/net/hpack"

const check = (name: string, got: i32, want: i32): boolean => {
  if (got === want) {
    console.log(`PASS ${name}`)
    return true
  }
  console.log(`FAIL ${name}: got ${got}, want ${want}`)
  return false
}

const refuse = (name: string, bytes: u8[], want: i32): boolean => {
  const decoder: HpackDecoder = new HpackDecoder(4096, 16384)
  const first: boolean = check(name, decoder.decode(bytes, 0, toI32(bytes.length)), want)
  const good: u8[] = [0x82]
  const again: boolean = check(`${name}, and the spent decoder answers it again`, decoder.decode(good, 0, 1), want)
  return first && again
}

export const main = (): i32 => {
  let ok: boolean = true
  // An indexed field whose integer continues past the block's end.
  ok = refuse("a truncated integer", [0xff], HPACK_ERR_TRUNCATED) && ok
  // An integer whose continuation bytes pass 2^31 - 1.
  ok = refuse("an integer past 2^31 - 1", [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f], HPACK_ERR_INTEGER_OVERFLOW) && ok
  // The largest integer HPACK reads, 2^31 - 1: a full 7-bit prefix and four continuation bytes.
  const largest: u8[] = [0xff, 0x80, 0xff, 0xff, 0xff, 0x07]
  ok = check("2^31 - 1 is read as an integer", hpackDecodeInteger(new HpackCursor(largest, 0, 6), 7), 2147483647) && ok
  // As an index it is read whole, then refused as past the table.
  ok = refuse("index 2^31 - 1", largest, HPACK_ERR_INDEX) && ok
  // Index 0 is not an entry (RFC 7541 §6.1).
  ok = refuse("index 0", [0x80], HPACK_ERR_INDEX) && ok
  // Index 70 with an empty dynamic table.
  ok = refuse("an index past the table", [0xc6], HPACK_ERR_INDEX) && ok
  // A literal whose string length runs past the block.
  ok = refuse("a string longer than its block", [0x40, 0x0a, 0x61], HPACK_ERR_TRUNCATED) && ok
  // A Huffman string holding the 30-bit EOS code (RFC 7541 §5.2).
  ok = refuse("a Huffman string with EOS", [0x40, 0x84, 0xff, 0xff, 0xff, 0xff, 0x00], HPACK_ERR_HUFFMAN_EOS) && ok
  // A table size update past the settings limit.
  ok = refuse("a size update past the limit", [0x3f, 0xe2, 0x1f], HPACK_ERR_TABLE_SIZE) && ok
  // A size update after a field (RFC 7541 §4.2).
  ok = refuse("a size update after a field", [0x82, 0x20], HPACK_ERR_SIZE_UPDATE_POSITION) && ok
  const fresh: HpackDecoder = new HpackDecoder(4096, 16384)
  const good: u8[] = [0x82, 0x86, 0x84]
  ok = check("a fresh decoder decodes :method GET, :scheme http, :path /", fresh.decode(good, 0, 3), HPACK_OK) && ok
  ok = check("as three fields", toI32(fresh.names.length), 3) && ok
  return ok ? 0 : 1
}
