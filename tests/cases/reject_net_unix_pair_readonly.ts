// `unixSocketPair` writes into its array, so a readonly i32[] is refused.
const pair = (fds: readonly i32[]): i32 => unixSocketPair(NET_UNIX_STREAM, fds);

export const main = (): number => pair([0, 0]);
