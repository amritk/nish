// WP34 N12: a wasm32 build has no host to count the cores of.
export const cores = (): i32 => availableParallelism();
