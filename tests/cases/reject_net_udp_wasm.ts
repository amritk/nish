// WP34 N5: the UDP calls are refused on wasm as every `nish:net` call is:
// runtime-net.c is empty there.
export const bind = (): i32 => udpBind("127.0.0.1", 0, 0);
