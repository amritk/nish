// `peerCredentials` writes pid, uid and gid into an i32[], so a u8[] is refused.
export const main = (): number => {
  const out: u8[] = [0, 0, 0];
  return peerCredentials(3, out);
};
