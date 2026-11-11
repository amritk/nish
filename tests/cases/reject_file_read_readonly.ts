// WP44: `fileReadAt` writes the bytes it reads into its buffer, so a readonly
// u8[] is refused there as a store through it is.
const fill = (fd: i32, into: readonly u8[]): i32 => fileReadAt(fd, into, 0, 1, toI64(0));

export const main = (): number => fill(-1, [0]);
