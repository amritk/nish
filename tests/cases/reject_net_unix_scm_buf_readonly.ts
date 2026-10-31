// `recvFd` reads its bytes into `buf`, so a readonly u8[] is refused.
const take = (buf: readonly u8[]): i32 => recvFd(3, buf, 0, 4, [0]);

export const main = (): number => take([0, 0, 0, 0]);
