// WP34 N5, #357: the client half is refused on wasm as every `nish:net` call
// is: runtime-net.c is empty there, and a wasm32 build has no socket to ask.
export const result = (fd: i32): i32 => connectResult(fd);
