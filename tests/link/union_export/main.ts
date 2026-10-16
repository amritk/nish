// A discriminated union exported with its variants: `Shape` is a parameter,
// a return, a local and an array element in the importer, a `Square` from
// `new` converts into it, and its tag reads as the exporter's enum.
import { Circle, isRound, Kind, pick, Shape, Square } from "./shapes";

export const main = (): number => {
  const shapes: Shape[] = [pick(true), pick(false), new Square()];
  let round = 0;
  for (const s of shapes) {
    if (isRound(s)) {
      round = round + 1;
    }
  }
  const c: Shape = pick(true);
  console.log(`${round} ${isRound(c)} ${shapes[1].kind === Kind.Square}`);
  return round === 1 ? 0 : 1;
};
