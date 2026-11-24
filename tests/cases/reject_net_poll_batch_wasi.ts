// NURING-40: the WASI profile refuses the batch wait as wasm32 does: WASI's
// `poll_oneoff` has no io_uring to wait on and no loop to batch.
export const wait = (ready: i32[]): i32 => pollWaitBatch(0, ready, 0, 2, 10);
