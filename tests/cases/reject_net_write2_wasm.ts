// `netWrite2` is refused on wasm as every `nish:net` call is: runtime-net.c
// is empty there, so there is no socket to send the two buffers on.
import { netWrite2 } from "nish:net";

export const both = (fd: i32, a: u8[], b: u8[]): i32 => netWrite2(fd, a, 0, 1, b, 0, 1);
