// NURING-40: `pollWaitBatch` writes tokens and events into `ready`, so a
// readonly i32[] is refused there, as it is for `pollWait`.
const wait = (loop: i32, ready: readonly i32[]): i32 => pollWaitBatch(loop, ready, 0, 2, 10);

export const main = (): number => wait(-1, [0, 0]);
