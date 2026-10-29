// `writeFileBytesSync(path, bytes)` writes a `u8[]` as it is, every one of the
// 256 byte values included, and answers the count. A second write truncates.
// A failure is a negative errno rather than `writeFileSync`'s exit: a missing
// directory is -2 and a path holding a NUL is -22 (`EINVAL`), refused before
// the file system is asked.
export function main(): number {
  const path = "build/test/io_write_file_bytes.bin";
  const bytes: u8[] = [];
  for (let i = 0; i < 256; i++) {
    bytes.push(toU8(i));
  }
  console.log(`wrote: ${writeFileBytesSync(path, bytes)}`);
  const back = readFileBytesSync(path);
  let same = back !== null && back.length === 256;
  if (back !== null && same) {
    for (let i = 0; i < back.length && i < bytes.length; i++) {
      if (back[i] !== bytes[i]) {
        same = false;
      }
    }
  }
  console.log(`read back: ${same}`);
  const short: u8[] = [0, 255];
  console.log(`truncated: ${writeFileBytesSync(path, short)}`);
  const again = readFileBytesSync(path);
  console.log(`length now: ${again === null ? -1 : again.length}`);
  console.log(`no directory: ${writeFileBytesSync("build/test/io_write_file_bytes_absent/x", short)}`);
  console.log(`nul in path: ${writeFileBytesSync("build/test/a\0b", short)}`);
  return 0;
}
