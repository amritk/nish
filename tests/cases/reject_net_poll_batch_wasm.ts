// NURING-40: the batch wait is refused on wasm as every `nish:net` call is:
// runtime-net.c is empty there, and a wasm32 build has no loop to wait on.
export const wait = (ready: i32[]): i32 => pollWaitBatch(0, ready, 0, 2, 10);
