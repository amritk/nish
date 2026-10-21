// WP34 N12: no processes on a wasm32 build.
export const stop = (pid: i32): i32 => kill(pid, 15);
