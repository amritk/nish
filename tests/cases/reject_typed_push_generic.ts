// #347: a generic's result is spelled with the argument that binds its `T`,
// so `first(rows)` over a `Float64Array[]` is a `Float64Array` to TypeScript,
// and so is a copy of it; the same holds for a `T` bound directly and for an
// element of a `T[]` result. The same call over an `f64[][]` is not refused:
// it is one instantiation, `first$f64[]`, but the spelling is the call's.
const first = <T>(xs: T[]): T => xs[0];
const same = <T>(x: T): T => x;
const wrap = <T>(x: T): T[] => [x];

export const test = (): number => {
  const rows: Float64Array[] = [new Float64Array(2)];
  first(rows).pop();
  const r = first(rows);
  r.push(1.0);
  same(new Int32Array(1)).push(1);
  wrap(new Float32Array(1))[0].pop();
  const plain: f64[][] = [[1.0]];
  first(plain).pop();
  return plain.length;
};
