// WP34 N5: the readiness loop is refused on wasm as every `nish:net` call is:
// runtime-net.c is empty there, and a wasm32 build has no descriptor to watch.
export const loop = (): i32 => pollCreate();
