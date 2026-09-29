// WP34 N5: `netRead` writes the bytes it reads into its buffer, so a readonly
// u8[] is refused there as a store through it is.
const drain = (fd: i32, into: readonly u8[]): i32 => netRead(fd, into, 0, 1);

export const main = (): number => drain(-1, [0]);
