// WP34 N5: `pollWait` writes a token and its events into `ready`, so a
// readonly i32[] is refused there.
const wait = (loop: i32, ready: readonly i32[]): i32 => pollWait(loop, ready, 0);

export const main = (): number => wait(-1, [0, 0]);
