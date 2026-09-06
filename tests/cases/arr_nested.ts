function trace(m: number[][]): number {
  let t = 0;
  for (let i = 0; i < m.length; i++) {
    t += m[i][i];
  }
  return t;
}

export function main(): number {
  const m: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const row = new Array<number>(3);
    for (let j = 0; j < 3; j++) {
      row[j] = i * 3 + j;
    }
    m.push(row);
  }
  m[1][1] = 100;
  console.log(trace(m));
  console.log(m[2].length);
  const empty: number[][] = [[], [1]];
  console.log(empty[0].length);
  const grid: Array<number[]> = [];
  grid.push(new Array<number>(2));
  console.log(grid[0][1]);
  return 0;
}
