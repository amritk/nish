// WP44: a negative `pos`, and one where `pos + len` passes 2^63 - 1, answer
// -22 (`EINVAL`) before the kernel is asked. Under Node `fs.readSync` would
// take -1 to mean "from the current offset", so the shim refuses it first, as
// the C does. A read after `fileClose` answers -9 (`EBADF`), and so does a
// second close.
export function main(): number {
  const path = "build/test/file_read_at_pos.bin";
  const bytes: u8[] = [9, 8, 7];
  writeFileBytesSync(path, bytes);
  const fd = fileOpen(path);
  if (fd < 0) {
    console.log(`fileOpen ${fd}`);
    return 1;
  }
  const buf: u8[] = new Array<u8>(4);
  const negative: i64 = -1;
  console.log(`negative pos: ${fileReadAt(fd, buf, 0, 4, negative)}`);
  // 2^63 - 3, the largest i64 less 2, so a 4-byte read would end past it.
  const top: i64 = ~(toI64(1) << 63) - toI64(2);
  console.log(`pos + len past 2^63 - 1: ${fileReadAt(fd, buf, 0, 4, top)}`);
  const start: i64 = 0;
  console.log(`in range: ${fileReadAt(fd, buf, 0, 4, start)}`);
  console.log(`closed: ${fileClose(fd)}`);
  console.log(`read after close: ${fileReadAt(fd, buf, 0, 4, start)}`);
  console.log(`size after close: ${fileSize(fd)}`);
  console.log(`closed again: ${fileClose(fd)}`);
  return 0;
}
