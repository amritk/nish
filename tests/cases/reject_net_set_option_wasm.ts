// `netSetOption` is refused on wasm as every `nish:net` call is, and the
// option id it is handed is only a number: reading one compiles anywhere,
// but runtime-net.c is empty there, so there is no socket to set it on.
import { NET_TCP_NODELAY, netSetOption } from "nish:net";

export const quick = (fd: i32): i32 => netSetOption(fd, NET_TCP_NODELAY, 1);
