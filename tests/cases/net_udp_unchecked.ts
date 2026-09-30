// WP34 N5: `--unchecked-indexing` drops the range check of `udpSendTo` and
// `udpRecvFrom` with every other check, so the call is the whole lowering and
// the function keeps no `noreturn` callee.
export const echoOnce = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i32 => {
  const n = udpRecvFrom(fd, buf, 0, buf.length, from, meta);
  return n > 0 ? udpSendTo(fd, buf, 0, n, from, 0, meta[1]) : n;
};
