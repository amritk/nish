// WP33 NL8005's silences: an array with no element to differ, one that starts
// empty and grows, a typed array (zero-filled in JavaScript too), and an array
// whose element is neither a number nor a boolean. None of them may warn.
class Point {
  x: i32 = 0;
}

export const main = (): number => {
  const n = 3;
  const none = new Array<f64>(0);
  const grown: i32[] = [];
  for (let i = 0; i < n; i = i + 1) {
    grown.push(i);
  }
  const floats = new Float64Array(n);
  const points = new Array<Point | null>(n);
  console.log(none.length + grown[2] + floats.length + points.length);
  return 0;
};
