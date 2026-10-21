// WP34 N12: a wasm32 build has no host to measure the memory of.
export const bytes = (): i64 => totalMemory();
