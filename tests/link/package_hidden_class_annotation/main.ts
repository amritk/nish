// #442: only the layout of a non-exported class travels with the value, not
// its name. Calling `unsent` on the value links (`package_hidden_method`);
// naming `Space` in an annotation is still refused, import or none.
import { Conn } from "pkg_q";

export const main = (): i32 => {
  const space: Space = new Conn().space();
  return space.unsent(3);
};
