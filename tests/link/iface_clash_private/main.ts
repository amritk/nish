// #193, the interface form: `./lib`'s `Shape` is private and this module
// declares its own. Both were one type id, so this `Shape` was passed to
// `nameOf` with no coercion, and `s.name` read past the one field it has. The
// refusal holds whether or not either declaration is exported, because the
// type is interned by name either way.
import { nameOf } from "./lib";

interface Shape {
  area: f64;
}

export const main = (): i32 => {
  const s: Shape = { area: toF64(2) };
  console.log(nameOf(s));
  return 0;
};
