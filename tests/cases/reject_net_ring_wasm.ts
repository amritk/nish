// WP63 S2: `netRingState` is refused on wasm as every `nish:net` call is: a
// wasm32 build has no kernel to ask for io_uring.
export const state = (): i32 => netRingState();
