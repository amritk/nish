// The RFC 1952 trailers of real files, against `Crc32.update`: each file is
// gzipped by the system's `gzip -n`, so the CRC-32 and ISIZE in the `.gz`'s
// last eight bytes come from zlib's code, not this one. Each must equal
// `Crc32.update` over the file's own bytes and its length, and
// `gzipDecompress` must give the file back. The files are a text file whose
// length is not a multiple of 16 (LICENSE), a long text file (the language
// reference, past 64 KiB), a DER certificate, and this program's own binary,
// so binary data past 64 KiB too. The "crc32 kernel" section of
// `tests/run.js` runs it with `NISH_CRC32` unset and `=soft`.
import { mkdirSync, readFileBytesSync } from "nish:fs"
import { spawnSyncTo } from "nish:process"
import { Crc32 } from "nish/compress/checksum"
import { gzipDecompress } from "nish/compress/gzip"

const DIR: string = "build/std_compress_gzip_files"

/** A little-endian u32 at `buf[at]`. */
const le32 = (buf: u8[], at: i32): u32 =>
  toU32(buf[at]) | (toU32(buf[at + 1]) << 8) | (toU32(buf[at + 2]) << 16) | (toU32(buf[at + 3]) << 24)

/** What the file's bytes are, as a bit set: 1 a zero byte in it, 2 past 64 KiB, 4 a length not a multiple of 16. */
const kinds = (src: u8[]): i32 => {
  const n: i32 = toI32(src.length)
  let zero: boolean = false
  for (let i: i32 = 0; !zero && i < n; i += 1) {
    zero = src[i] === toU8(0)
  }
  return (zero ? 1 : 0) | (n > 65536 ? 2 : 0) | (n % 16 !== 0 ? 4 : 0)
}

/** Gzips `file` with `gzip -n` as `name`.gz and holds its trailer to `Crc32.update`: the file's kinds, or -1. */
const held = (name: string, file: string): i32 => {
  const src = readFileBytesSync(file)
  if (src === null) {
    console.log(`${name}: cannot read ${file}`)
    return -1
  }
  const gz: string = `${DIR}/${name}.gz`
  const status: number = spawnSyncTo(["gzip", "-n", "-c", file], gz, `${DIR}/${name}.err`)
  const packed = readFileBytesSync(gz)
  if (status !== 0 || packed === null || packed.length < 18) {
    console.log(`${name}: gzip -n exited ${status}`)
    return -1
  }
  const n: i32 = toI32(src.length)
  const end: i32 = toI32(packed.length)
  const crc: u32 = le32(packed, end - 8)
  const size: u32 = le32(packed, end - 4)
  const ours: u32 = new Crc32().update(toU32(0), src, 0, n)
  const back: u8[] = new Array<u8>(n + 1)
  const got: i32 = gzipDecompress(packed, 0, end, back, 0, n + 1)
  let same: boolean = got === n
  for (let i: i32 = 0; same && i < n && i < toI32(back.length); i += 1) {
    same = back[i] === src[i]
  }
  if (crc !== ours || toI32(size) !== n || !same) {
    console.log(
      `${name}: gzip's trailer says crc ${toI64(crc)} isize ${toI64(size)}; Crc32.update says ${toI64(ours)} over ${n} bytes; gunzip ${same ? "round-trips" : `gave ${got} bytes, not the file`}`
    )
    return -1
  }
  console.log(`${name}: gzip's trailer is Crc32.update's, and gunzip gives the file back`)
  return kinds(src)
}

export const main = (): i32 => {
  mkdirSync("build")
  mkdirSync(DIR)
  const files: string[] = ["LICENSE", "docs/LANGUAGE.md", "tests/fuzz/corpus/x509-der/cert-openssl-rsa2048-leaf.der", process.argv[0]]
  const names: string[] = ["license", "language", "certificate", "self"]
  let bad: i32 = 0
  let seen: i32 = 0
  for (let i: i32 = 0; i < toI32(files.length) && i < toI32(names.length); i += 1) {
    const k: i32 = held(names[i], files[i])
    if (k < 0) {
      bad += 1
    } else {
      seen = seen | k
    }
  }
  // The set must still cover what it is for, whatever edits move the files' lengths.
  console.log(`a binary file: ${(seen & 1) !== 0}`)
  console.log(`a file past 64 KiB: ${(seen & 2) !== 0}`)
  console.log(`a length not a multiple of 16: ${(seen & 4) !== 0}`)
  return bad === 0 && seen === 7 ? 0 : 1
}
