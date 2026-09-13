// A specifier that is neither relative nor a package name. An absolute path is
// a fact about the machine rather than about the program, so it is refused
// where a package name (WP21 S2) is not.
import { square } from "/usr/lib/math";

function f(): number {
  return square(1);
}
