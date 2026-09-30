// WP34 N5: runtime-net.c is empty on wasm, so every `nish:net` call is refused
// there, as the host builtins are.
export const listen = (): i32 => tcpListen("127.0.0.1", 0, 1);
