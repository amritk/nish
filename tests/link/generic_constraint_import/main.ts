// Constrained templates imported and instantiated here, each at the type its
// constraint names: a `Shape` value this module builds, and a `Counter`.
// `areaOf$$Shape` and `twice$$Counter` are defined in `lib.ll` and declared
// in this module's IR.
import { areaOf, Counter, Shape, twice } from "./lib";

export const main = (): i32 => {
  const square: Shape = { area: 9 };
  console.log(`${areaOf(square)}`);
  console.log(`${twice(new Counter(40))}`);
  return 0;
};
