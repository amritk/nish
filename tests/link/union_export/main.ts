// A discriminated union imported without its variants: `Shape` is a
// parameter, a return, a local and an array element in the importer, an
// interface variant and a `Shape | null` cross the module boundary, and the
// tag reads as the exporter's enum.
import { dotAt, isRound, Kind, nth, pick, Shape } from "./shapes";

export const main = (): number => {
  const shapes: Shape[] = [pick(true), pick(false), dotAt(7)];
  let round = 0;
  for (const s of shapes) {
    if (isRound(s)) {
      round = round + 1;
    }
  }
  const c: Shape = pick(true);
  const last = nth(shapes, 2);
  const past = nth(shapes, 3);
  const dot = last !== null && last.kind === Kind.Dot;
  console.log(`${round} ${isRound(c)} ${shapes[1].kind === Kind.Square} ${dot} ${past === null}`);
  return round === 1 ? 0 : 1;
};
