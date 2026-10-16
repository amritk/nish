// The member at 0 is what a zero-filled slot holds, so `parallelMap`,
// `parallelFrom` and `parallelReduce` take a body answering `Kind.Scalar`;
// `parallelReduce` folds each block from the identity in a `let`, which keeps
// the identity's member type.
import { parallelFrom, parallelMap, parallelReduce } from "nish/threads";

enum Kind {
  Scalar,
  Array,
}

const pick = (acc: Kind.Scalar, x: Kind.Scalar): Kind.Scalar => x;

export const main = (): i32 => {
  const a = parallelMap([1, 2, 3], (x: i32): Kind.Scalar => Kind.Scalar);
  const b = parallelFrom(4, (i: i32): Kind.Scalar => Kind.Scalar);
  const src: Kind.Scalar[] = [Kind.Scalar, Kind.Scalar];
  const c: Kind.Scalar = parallelReduce(src, pick, Kind.Scalar);
  const scalar = a[0] === Kind.Scalar && b[3] === Kind.Scalar && c === Kind.Scalar;
  console.log(`${scalar} ${a.length} ${b.length}`);
  return 0;
};
