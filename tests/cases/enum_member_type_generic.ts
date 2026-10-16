// An enum member constant passed to a generic function enters a slot of its
// member type, wherever the argument sits: the type parameter bound by an
// array of the member type, a concrete member-typed parameter beside a type
// parameter, and `getOrInsert`'s value. An unannotated `let` keeps the member
// type of a value already of it, as tsc does, and widens a member constant to
// its enum, so the `let w` below takes another member.
import { getOrInsert } from "nish/map";

enum Kind {
  Scalar,
  Array,
}

function fold<T>(xs: T[], init: T): T {
  let acc: T = init;
  for (const x of xs) {
    acc = x;
  }
  return acc;
}

function first<T>(init: T, xs: T[]): T {
  return xs.length > 0 ? xs[0] : init;
}

function tag<T>(x: T, k: Kind.Array): Kind.Array {
  return k;
}

export const test = (): number => {
  const xs: Kind.Array[] = [Kind.Array];
  const a: Kind.Array = fold(xs, Kind.Array);
  const b: Kind.Array = first(Kind.Array, xs);
  const c: Kind.Array = tag(3, Kind.Array);
  const m = new Map<string, Kind.Array>();
  const d: Kind.Array = getOrInsert(m, "a", Kind.Array);
  const kept = a;
  let again = kept;
  const e: Kind.Array = again;
  let w = Kind.Array;
  w = Kind.Scalar;
  const same = a === b && b === c && c === d && d === e ? 10 : 0;
  return same + (w === Kind.Scalar ? 1 : 0) + m.size * 100;
};
