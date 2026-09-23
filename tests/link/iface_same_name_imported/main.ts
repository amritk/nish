// The positive half of #173: an importer that names `./lib`'s own `Shape`
// still converts a `Circle` to it implicitly, because that is the declaration
// `Circle` implements — here a `new` and the result of a call into `./lib`.
import { Circle, Shape, unit } from "./lib";

const areaOf = (s: Shape): f64 => s.area;

export const main = (): i32 => {
  const s: Shape = unit();
  console.log(s.area);
  return areaOf(new Circle()) === s.area ? 7 : 1;
};
