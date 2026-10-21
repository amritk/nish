// `tcpListenFlags` with flag 2 is refused on wasm as every `nish:net` call is:
// the bit adds a socket option, not a way around the refusal, and
// runtime-net.c is empty there.
import { tcpListenFlags } from "nish:net";

export const quick = (): i32 => tcpListenFlags("127.0.0.1", 0, 4, 2);
