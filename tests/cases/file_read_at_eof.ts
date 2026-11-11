// WP44: a read at the end of the file answers 0, and so does one past it,
// natively (`pread` returns 0) and under Node (`bytesRead === 0`). A read
// that starts before the end and asks past it answers the bytes that are
// there. A `len` of 0 answers 0 without asking the file system.
export function main(): number {
  const path = "build/test/file_read_at_eof.bin";
  const bytes: u8[] = [1, 2, 3, 4, 5];
  writeFileBytesSync(path, bytes);
  const fd = fileOpen(path);
  if (fd < 0) {
    console.log(`fileOpen ${fd}`);
    return 1;
  }
  const buf: u8[] = new Array<u8>(8);
  const end: i64 = 5;
  console.log(`at the end: ${fileReadAt(fd, buf, 0, 8, end)}`);
  console.log(`past the end: ${fileReadAt(fd, buf, 0, 8, end + toI64(1000))}`);
  const near: i64 = 3;
  const tail = fileReadAt(fd, buf, 2, 6, near);
  console.log(`across the end: ${tail}, bytes ${buf[2]} ${buf[3]}`);
  const start: i64 = 0;
  console.log(`len 0: ${fileReadAt(fd, buf, 0, 0, start)}`);
  console.log(`closed: ${fileClose(fd)}`);
  return 0;
}
