// `recvFd` writes the descriptor it kept into an i32[], so a u8[] is refused.
export const main = (): number => {
  const fd: u8[] = [0];
  return recvFd(3, new Array<u8>(4), 0, 4, fd);
};
