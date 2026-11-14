// WP27 S5: `cErrno` takes no arguments; it reads the errno of the last foreign call.
import { cErrno } from "nish:unsafe";

export function main(): i32 {
  return cErrno(1);
}
