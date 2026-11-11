// WP44: `fileReadAt` reads a regular file a window at a time into a `u8[]`
// the caller owns. The file is written first, then read back four bytes at a
// time from a running offset until a read answers 0, each window's bytes
// decoded and printed. `fileSize` agrees with what was written, and
// `fileClose` answers 0.
export function main(): number {
  const path = "build/test/file_read_at.txt";
  const text = "streamed a window at a time\n";
  const bytes: u8[] = [];
  for (let i = 0; i < text.length; i++) {
    bytes.push(toU8(text.charCodeAt(i)));
  }
  console.log(`wrote: ${writeFileBytesSync(path, bytes)}`);
  const fd = fileOpen(path);
  if (fd < 0) {
    console.log(`fileOpen ${fd}`);
    return 1;
  }
  console.log(`size: ${fileSize(fd)}`);
  const window: u8[] = new Array<u8>(4);
  let pos: i64 = 0;
  const pieces: string[] = [];
  let n = fileReadAt(fd, window, 0, 4, pos);
  while (n > 0) {
    pieces.push(String.fromBytes(window, 0, n));
    pos = pos + toI64(n);
    n = fileReadAt(fd, window, 0, 4, pos);
  }
  console.log(`last: ${n}`);
  console.log(`read: ${pos} bytes`);
  console.log(pieces.join(""));
  console.log(`closed: ${fileClose(fd)}`);
  return 0;
}
