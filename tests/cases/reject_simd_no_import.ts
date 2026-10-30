// The six vector types and their calls are names of `nish:simd` and of
// nothing else: a module that spells one without the import is refused, so
// the module's top says it works with vectors.
export const f = (xs: i32[]): i32x4 => {
  const v: i32x4 = loadI32x4(xs, 0);
  return replace(v, 0, 1);
};

export const g = (): f64x2 => splatF64x2(1.5);
