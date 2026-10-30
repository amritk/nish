// The byte round trip: every one of the 256 byte values reaches stdout and a
// file as it is, by two routes. `writeBytes` sends a `u8[]` range and
// `writeFileBytesSync` a whole one; `String.fromBytes` builds a string from
// the same bytes, unvalidated, and `write` and `writeFileSync` send its
// `{len, bytes}` as they are. `tests/run.js` ("io_write_bytes") compares
// stdout, the two copies, and both files with `io_write_bytes.bin` byte for
// byte. The string route is native-only: under `runtime/nish.mjs` each byte
// is one UTF-16 unit and a byte above 127 leaves as two, which the same check
// pins, and under `--emit-ts` the bytes decode as UTF-8, a byte that is not
// UTF-8 to U+FFFD.
export function main(): number {
  const bytes: u8[] = [];
  for (let i = 0; i < 256; i++) {
    bytes.push(toU8(i));
  }
  const sent = writeBytes(bytes, 0, 256);
  const text = String.fromBytes(bytes, 0, 256);
  write(text);
  writeFileSync("build/test/io_write_bytes_string.bin", text);
  const filed = writeFileBytesSync("build/test/io_write_bytes_array.bin", bytes);
  return sent === 256 && filed === 256 ? 0 : 1;
}
