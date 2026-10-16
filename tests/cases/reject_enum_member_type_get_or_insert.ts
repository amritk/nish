import { getOrInsert } from "nish/map";
// NL2519 through `getOrInsert`: the map binds its value to `Kind.Array`.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;
const scalar = (): Kind.Scalar => Kind.Scalar;

export const test = (c: boolean, k: Kind): number => {
  const a: Kind.Array = array();
  const b: Kind.Scalar = scalar();
  const m = new Map<string, Kind.Array>();
  const d = getOrInsert(m, "a", Kind.Scalar);
  return b;
};
