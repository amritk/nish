// The range entry points `nish/net/http-compress`'s body decoder reaches
// answer a misuse rather than panicking: `Inflater.inflateAll` and both
// decoders' `decompressRange` answer DEFLATE_ERR_WINDOW (-16) for a window
// outside its array or a negative limit, and `Crc32.ofRange` and
// `adler32Range` answer -1 for a range outside their array. Each in-range
// call beside them answers as before: an empty body's gzip and zlib
// streams decode to 0 bytes and the checksums of "abc" are the known ones.
import { Crc32, adler32Range } from "nish/compress/checksum"
import { DEFLATE_ERR_WINDOW, Inflater } from "nish/compress/deflate"
import { GzipDecompressor } from "nish/compress/gzip"
import { ZlibDecompressor } from "nish/compress/zlib"

const gz: u8[] = [31, 139, 8, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const zl: u8[] = [120, 156, 3, 0, 0, 0, 0, 1]
const raw: u8[] = [3, 0]
const abc: u8[] = [97, 98, 99]
const out: u8[] = new Array<u8>(8)

const gunzip: GzipDecompressor = new GzipDecompressor()
console.log(`gzip in range: ${gunzip.decompressRange(gz, 0, toI32(gz.length), out, 0, 8)}`)
console.log(`gzip end past src: ${gunzip.decompressRange(gz, 0, 21, out, 0, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`gzip off past end: ${gunzip.decompressRange(gz, 5, 4, out, 0, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`gzip negative off: ${gunzip.decompressRange(gz, -1, 4, out, 0, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`gzip at past out: ${gunzip.decompressRange(gz, 0, toI32(gz.length), out, 9, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`gzip negative limit: ${gunzip.decompressRange(gz, 0, toI32(gz.length), out, 0, -1) === DEFLATE_ERR_WINDOW}`)

const unzlib: ZlibDecompressor = new ZlibDecompressor()
console.log(`zlib in range: ${unzlib.decompressRange(zl, 0, toI32(zl.length), out, 0, 8)}`)
console.log(`zlib end past src: ${unzlib.decompressRange(zl, 0, 9, out, 0, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`zlib negative at: ${unzlib.decompressRange(zl, 0, toI32(zl.length), out, -1, 8) === DEFLATE_ERR_WINDOW}`)
console.log(`zlib negative limit: ${unzlib.decompressRange(zl, 0, toI32(zl.length), out, 0, -1) === DEFLATE_ERR_WINDOW}`)

const inf: Inflater = new Inflater()
console.log(`inflateAll in range: ${inf.inflateAll(raw, 0, 2, out, 0, 8)}`)
inf.reset()
console.log(`inflateAll input past src: ${inf.inflateAll(raw, 0, 3, out, 0, 8) === DEFLATE_ERR_WINDOW}`)
inf.reset()
console.log(`inflateAll output past out: ${inf.inflateAll(raw, 0, 2, out, 0, 9) === DEFLATE_ERR_WINDOW}`)
inf.reset()
console.log(`inflateAll op past outEnd: ${inf.inflateAll(raw, 0, 2, out, 5, 4) === DEFLATE_ERR_WINDOW}`)

const crc: Crc32 = new Crc32()
console.log(`crc32 abc: ${crc.ofRange(abc, 0, 3)}`)
console.log(`crc32 empty: ${crc.ofRange(abc, 3, 3)}`)
console.log(`crc32 end past buf: ${crc.ofRange(abc, 0, 4)}`)
console.log(`crc32 off past end: ${crc.ofRange(abc, 2, 1)}`)
console.log(`crc32 negative off: ${crc.ofRange(abc, -1, 1)}`)
console.log(`adler32 abc: ${adler32Range(abc, 0, 3)}`)
console.log(`adler32 empty: ${adler32Range(abc, 0, 0)}`)
console.log(`adler32 end past buf: ${adler32Range(abc, 0, 4)}`)
console.log(`adler32 off past end: ${adler32Range(abc, 2, 1)}`)
console.log(`adler32 negative off: ${adler32Range(abc, -1, 1)}`)
