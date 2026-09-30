// WP33 R2: an element of an array spelled `Float64Array[]` is a `Float64Array`
// to TypeScript: an index into one, a `for...of` variable over one, a copy of
// either, a field declared `Int32Array[]`, an array literal of typed arrays,
// and `Array<Float64Array>`. The array itself grows: `rows.push` is not refused.
class Grid {
  rows: Int32Array[];
  constructor() {
    this.rows = [new Int32Array(2)];
  }
}

export const test = (): number => {
  const rows: Float64Array[] = [new Float64Array(2)];
  rows.push(new Float64Array(1));
  rows[0].push(1.0);
  for (const row of rows) {
    row.push(2.0);
  }
  const first = rows[1];
  first.pop();
  const g = new Grid();
  g.rows[0].pop();
  const inferred = [new Float32Array(2)];
  inferred[0].push(3.0);
  const generic: Array<Float64Array> = rows;
  generic[0].pop();
  return rows.length;
};
