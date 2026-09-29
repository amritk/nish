// `Conn`'s right-hand side names a class nothing declares. It is resolved in
// `conn.ts`, and the mistake is reported there, even though the first module
// to ask for `Conn` is this one.
import { Conn } from "./conn";

const open = (c: Conn): i32 => (c === null ? 0 : 1);

export const main = (): number => open(null);
