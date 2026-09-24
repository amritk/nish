// #161 with a class constraint: this module's `Base` shares `./lib`'s name and
// therefore its type id, and it is still a different class. The call used to be
// refused because a class constraint is met by that class alone; since #193 the
// second `Base` is refused first, at its declaration (NL3028).
import { f } from "./lib";

class Base {
  y: i32 = 0;
}

export const main = (): i32 => f(new Base());
