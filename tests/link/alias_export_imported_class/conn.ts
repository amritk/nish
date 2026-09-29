// `Socket` is a class this module imported, and the alias's right-hand side
// is resolved here, in the module that wrote it, so `Conn` means the `Socket`
// of `./socket` in every module that imports `Conn`.
import { Socket } from "./socket";

export type Conn = Socket | null;

export const open = (fd: i32): Conn => (fd < 0 ? null : new Socket(fd));
