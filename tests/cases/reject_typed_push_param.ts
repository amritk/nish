// WP33 R2: a parameter declared `Float64Array` refuses `push`, though a caller may pass it an `f64[]`.
const grow = (xs: Float64Array): void => {
  xs.push(1.0);
};

export const test = (): number => {
  const ys: f64[] = [];
  grow(ys);
  return ys.length;
};
