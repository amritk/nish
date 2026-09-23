// #161 with a class constraint: this module's `Base` shares `./lib`'s name and
// therefore its type id, and it is still a different class. A class constraint
// is met by that class alone, so the request is refused here, at the call.
import { f } from "./lib";

class Base {
  y: i32 = 0;
}

export const main = (): i32 => f(new Base());
