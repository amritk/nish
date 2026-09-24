// #161's other half: the argument is this module's `Shape` itself, not an
// implementer. Types are interned by name, so the two `Shape`s share a type id
// and an id comparison would take one for the other. Since #193 that sharing is
// refused at the second declaration (NL3028), before the call is checked.
import { areaOf } from "./lib";

interface Shape {
  area: i32;
}

export const main = (): i32 => {
  const own: Shape = { area: 4 };
  return areaOf(own);
};
