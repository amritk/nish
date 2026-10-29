// `netResolve` is refused on wasm as every `nish:net` call is: runtime-net.c
// is empty there, and a wasm32 build has no resolver to ask.
import { netResolve } from "nish:net";

export const resolve = (out: u8[]): i32 => netResolve(out, "localhost", 80, 0);
