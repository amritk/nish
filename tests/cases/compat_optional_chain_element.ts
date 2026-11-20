// WP28 C1, `optional-chaining`: `?.[i]` inside a chain that a member or a
// `??` default follows. The bounds check runs only when the array is there;
// a missing array takes the default, as in Node.
class Row {
  cells: string[];
  constructor(cells: string[]) {
    this.cells = cells;
  }
}

const width = (xs: string[] | null, i: number): number => xs?.[i].length ?? -1;

const cellCount = (r: Row | null): number => r?.cells.length ?? -1;

export const main = (): void => {
  console.log(`${width(["x", "yz"], 1)} ${width(null, 1)} ${width(["x"], 0)}`);
  console.log(`${cellCount(new Row(["a", "bc"]))} ${cellCount(null)}`);
};
