// WP34 N5: `--unchecked-indexing` drops the range check of `netRead` and
// `netWrite` with every other check, so the call is the whole lowering and
// the function keeps no `noreturn` callee.
export const echoOnce = (fd: i32, buf: u8[]): i32 => {
  const n = netRead(fd, buf, 0, buf.length);
  return n > 0 ? netWrite(fd, buf, 0, n) : n;
};
