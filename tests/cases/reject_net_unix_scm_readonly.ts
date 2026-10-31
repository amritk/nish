// `recvFd` writes the descriptor it kept into `fd`, so a readonly i32[] is
// refused.
const take = (fd: readonly i32[]): i32 => recvFd(3, new Array<u8>(4), 0, 4, fd);

export const main = (): number => take([0]);
