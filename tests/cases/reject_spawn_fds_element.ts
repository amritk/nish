// The descriptors `spawnWithFds` hands on are an i32[], so a u8[] is refused.
export const main = (): number => {
  const fds: u8[] = [3];
  return spawnWithFds(["true"], fds);
};
