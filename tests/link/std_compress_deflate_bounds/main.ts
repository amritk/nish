// The edges of `deflateBound`, `compressBound` and `fixedDeflateBound`: each
// answers its real bound for every `n` whose bound fits in i32, and -1 only
// past that, so a caller that adds framing to a trusted bound never meets a
// -1 it guarded against. Then `Deflater`'s pending `begin` refusal: the next
// writing call answers -1 once, and the call after it works again.
import { compressBound, deflateBound, Deflater, fixedDeflateBound } from "nish/compress/deflate"
import { gzipFixedBound } from "nish/compress/gzip"

console.log(`deflateBound: ${deflateBound(-1)} ${deflateBound(0)} ${deflateBound(2146664744)} ${deflateBound(2146664745)}`)
console.log(`compressBound: ${compressBound(2146664726)} ${compressBound(2146664727)}`)
console.log(`fixedDeflateBound: ${fixedDeflateBound(-1)} ${fixedDeflateBound(0)} ${fixedDeflateBound(1908874339)} ${fixedDeflateBound(1908874340)}`)
// GzipWriter's own guards sit inside these: 65,536 + 2,145,000,000 and
// gzipFixedBound's 1,908,874,323 both answer a real bound.
console.log(`under GzipWriter: ${deflateBound(2145065536) > 0} ${gzipFixedBound(1908874323) > 0}`)

const d: Deflater = new Deflater(1)
const src: u8[] = [104, 105, 104, 105, 104, 105]
const out: u8[] = new Array<u8>(compressBound(6))
d.reset()
d.begin(-1)
console.log(`refused begin, flush: ${d.flushBits(out, 0, toI32(out.length))}`)
console.log(`then flush: ${d.flushBits(out, 0, toI32(out.length))}`)
d.reset()
d.begin(-1)
console.log(`refused begin, bad range: ${d.compressRange(src, 4, 2, 0, true, out, 0, toI32(out.length))}`)
d.begin(0)
const end: i32 = d.compressRange(src, 0, 6, 0, true, out, 0, toI32(out.length))
console.log(`then a range: ${end >= 0}`)
