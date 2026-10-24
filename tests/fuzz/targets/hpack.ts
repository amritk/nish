// The HPACK decoder (`nish/net/hpack`) over a peer's bytes, as a libFuzzer
// target: `fuzzOne` takes one input and keeps nothing past it, and a refusal is
// a return code, so a panic here is a finding (docs/security/http2.md).
//
// The first two bytes pick the SETTINGS_HEADER_TABLE_SIZE and the header-list
// limit from small and default sizes, so that eviction and the list limit are
// both reached. The rest is a sequence of header blocks, each one byte of
// length and then that many bytes (the last takes what is left), decoded by
// one `HpackDecoder` in turn so that the dynamic table carries from block to
// block as it does on a connection. A length byte of 255 is not a block: the
// byte after it is a new SETTINGS limit, acknowledged, which makes the decoder
// owe a size update. The whole input is also Huffman-decoded on its own.
import { HpackDecoder, HpackHuffman, hpackHuffmanDecode } from "nish/net/hpack"

/** One of four sizes, by the low two bits of `byte`: none, small, middling or `large`. */
const pick = (byte: u8, large: i32): i32 => {
  const which: i32 = toI32(byte) % 4
  if (which === 0) {
    return 0
  }
  if (which === 1) {
    return 64
  }
  return which === 2 ? 256 : large
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  const huffman: HpackHuffman = new HpackHuffman()
  const decoded: u8[] = []
  hpackHuffmanDecode(huffman, data, 0, n, decoded)
  if (n < 2) {
    return
  }
  const settings: i32 = pick(data[0], 4096)
  const listLimit: i32 = pick(data[1], 65536)
  const decoder: HpackDecoder = new HpackDecoder(settings, listLimit)
  let at: i32 = 2
  while (at < n) {
    const length: i32 = toI32(data[at])
    at += 1
    if (length === 255) {
      if (at < n) {
        decoder.setSettingsLimit(toI32(data[at]) * 16)
        at += 1
      }
      continue
    }
    const take: i32 = length < n - at ? length : n - at
    decoder.decode(data, at, take)
    at += take
  }
}
