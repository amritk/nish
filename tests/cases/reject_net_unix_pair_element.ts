// `unixSocketPair` writes its two descriptors into an i32[], as `pollWait`
// writes its tokens, so a u8[] is refused.
export const main = (): number => {
  const fds: u8[] = [0, 0];
  return unixSocketPair(NET_UNIX_STREAM, fds);
};
