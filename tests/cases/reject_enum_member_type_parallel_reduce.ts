// NL2516: `parallelReduce` zero-fills the array of block results, so a fold
// answering a member type other than the 0 is refused at the call.
import { parallelReduce } from "nish/threads";

enum Kind {
  Scalar,
  Array,
}

const pick = (a: Kind.Array, b: Kind.Array): Kind.Array => b;

export const test = (): number => {
  const xs: Kind.Array[] = [Kind.Array];
  return parallelReduce(xs, pick, Kind.Array) === Kind.Array ? 1 : 0;
};
