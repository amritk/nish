// WP34 N12: no processes on a wasm32 build.
export const start = (): i32 => spawn(["true"]);
