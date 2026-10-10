// #442's other half: a value of a non-exported class reaches this module and
// its methods may be called (`package_hidden_method`), but the class itself
// is still the package's own. Importing it by name is refused.
import { Conn, Space } from "pkg_q";

export const main = (): i32 => {
  const space: Space = new Conn().space();
  return space.unsent(3);
};
