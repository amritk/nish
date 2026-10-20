// `tcpListenFlags` is refused on wasm as every `nish:net` call is:
// runtime-net.c is empty there.
import { tcpListenFlags } from "nish:net";

export const shared = (): i32 => tcpListenFlags("127.0.0.1", 0, 4, 1);
