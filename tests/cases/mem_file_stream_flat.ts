// WP44 §6: none of the file builtins allocates from the arena. `fileOpen`
// passes the path's own bytes and `fileReadAt` writes only into the window
// it is handed, so streaming a file through one 64-byte window 10,000 times
// leaves `Arena.used()` where it started. Under Node `Arena.used()` is 0
// throughout, so the case prints the same lines there.
export function main(): number {
  const path = "build/test/mem_file_stream_flat.bin";
  const bytes: u8[] = [];
  for (let i = 0; i < 256; i++) {
    bytes.push(toU8(i));
  }
  writeFileBytesSync(path, bytes);
  const window: u8[] = new Array<u8>(64);
  const fd = fileOpen(path);
  if (fd < 0) {
    console.log(`fileOpen ${fd}`);
    return 1;
  }
  const before = Arena.used();
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const n = fileReadAt(fd, window, 0, 64, toI64(i % 4) * toI64(64));
    sum = sum + n + toI32(window[n - 1]);
  }
  const grown = Arena.used() - before;
  console.log(`sum: ${sum}`);
  console.log(grown === toI64(0) ? "flat" : `grows: ${grown}`);
  console.log(`closed: ${fileClose(fd)}`);
  return 0;
}
