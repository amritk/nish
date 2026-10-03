// The Huffman primitives take a window too, and refuse one outside the
// buffer the same way, here with a negative offset.
//
// It panics, on stderr, with
//
//     hpackHuffmanDecode: the window [-1, -1 + 1) is outside a buffer of 1 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackHuffman, hpackHuffmanDecode } from "nish/net/hpack";

export const main = (): i32 => {
  const h = new HpackHuffman();
  const src: u8[] = [31];
  const out: u8[] = [];
  console.log(`a window of 1 byte: ${hpackHuffmanDecode(h, src, 0, 1, out)}`);
  console.log(`unreachable: ${hpackHuffmanDecode(h, src, -1, 1, out)}`);
  return 0;
};
