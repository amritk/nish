// WP34 N12: no processes on a wasm32 build.
export const reap = (): i32[] => waitPid(-1, 1);
