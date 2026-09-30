// WP34 N5: the same refusal under an import, which renames the builtin rather
// than making another one.
import { netRead as readInto } from "nish:net";

export const once = (fd: i32, buf: u8[]): i32 => readInto(fd, buf, 0, 1);
