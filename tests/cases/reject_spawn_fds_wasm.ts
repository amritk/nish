// A wasm32 build has no processes to start, so it refuses `spawnWithFds` as it
// refuses `spawn`.
export const start = (): i32 => spawnWithFds(["true"], [3]);
