// WP44: `fileOpen` answers the negated Linux errno on every platform. A
// missing file is -2, a directory -21 (opened, then refused and closed), a
// FIFO -22 (opened non-blocking, so it never waits for a writer, then
// refused), a socket -6 (`ENXIO`, which `open` answers for one), and an
// empty path or one holding a NUL -2, as the runtime refuses each before the
// file system is asked (under WASI, "" would name the preopened directory).
// `tests/run.js` makes the FIFO and the socket before the case runs.
export function main(): number {
  console.log(`missing: ${fileOpen("build/test/file_open_errors_absent")}`);
  console.log(`directory: ${fileOpen("build/test")}`);
  console.log(`fifo: ${fileOpen("build/test/file_open_errors.fifo")}`);
  console.log(`socket: ${fileOpen("build/test/file_open_errors.sock")}`);
  console.log(`nul in path: ${fileOpen("build/test/a\0b")}`);
  console.log(`empty path: ${fileOpen("")}`);
  return 0;
}
