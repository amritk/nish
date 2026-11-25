// A dynamic block whose literal/length code is over-subscribed only at the
// last length, 15: lengths 1 to 14 and two of length 15 fill the code, and
// a third length-15 symbol over-fills it. No step of the Kraft loop sees a
// negative count of free codes, so only the test after the loop refuses it,
// as DEFLATE_ERR_HUFFMAN (-5). The complete code beside it decodes, through
// the 15-bit codes. Node's zlib answers the same for both streams.
import { DEFLATE_ERR_HUFFMAN, deflateDecompress } from "nish/compress/deflate"

const complete: u8[] = [
  5, 224, 1, 130, 36, 73, 146, 36, 73, 2, 18, 139, 154, 71, 86, 207, 222, 255, 159, 123, 160, 255, 239, 255, 247, 255,
  251, 254, 255,
]
const over: u8[] = [
  5, 224, 1, 130, 36, 73, 146, 36, 73, 2, 18, 139, 154, 71, 86, 207, 222, 253, 255, 183, 7, 250, 255, 254, 127, 255,
  191, 15, 0, 0,
]

const out: u8[] = new Array<u8>(16)
const n: i32 = deflateDecompress(complete, 0, toI32(complete.length), out, 0, 16)
let text: string = ""
for (let i: i32 = 0; i < n; i += 1) {
  text = `${text} ${out[i]}`
}
console.log(`complete: ${n}:${text}`)
const r: i32 = deflateDecompress(over, 0, toI32(over.length), out, 0, 16)
console.log(`over-subscribed at 15: ${r} ${r === DEFLATE_ERR_HUFFMAN}`)
