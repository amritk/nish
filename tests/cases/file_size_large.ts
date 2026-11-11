// WP44: positions and sizes are `i64`, so a file past 2^31 bytes is sized and
// read where the whole-file builtins cannot reach. `tests/run.js` makes
// `build/test/file_size_large.bin` sparse, 2^32 + 16 bytes of zeroes with
// `fs.truncateSync`, before the case runs; the last window reads its end.
export function main(): number {
  const fd = fileOpen("build/test/file_size_large.bin");
  if (fd < 0) {
    console.log(`fileOpen ${fd}`);
    return 1;
  }
  const size = fileSize(fd);
  console.log(`size: ${size}`);
  const buf: u8[] = [7, 7, 7, 7, 7, 7, 7, 7];
  const n = fileReadAt(fd, buf, 0, 8, size - toI64(4));
  console.log(`last window: ${n}, first byte ${buf[0]}, untouched ${buf[4]}`);
  console.log(`at the end: ${fileReadAt(fd, buf, 0, 8, size)}`);
  console.log(`closed: ${fileClose(fd)}`);
  return 0;
}
