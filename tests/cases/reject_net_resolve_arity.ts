// `netResolve` takes the family too: a lookup that left it out would have to
// pick one, and the caller is the one that knows which it can connect over.
import { netResolve } from "nish:net";

export const resolve = (out: u8[]): i32 => netResolve(out, "localhost", 80);
