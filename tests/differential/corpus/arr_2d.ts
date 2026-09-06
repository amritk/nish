// 2D arrays: matrix multiplication, transpose, Pascal's triangle, jagged rows.
function multiply(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    const row = new Array<number>(b[0].length);
    for (let j = 0; j < b[0].length; j++) {
      let s = 0;
      for (let k = 0; k < b.length; k++) {
        s += a[i][k] * b[k][j];
      }
      row[j] = s;
    }
    out.push(row);
  }
  return out;
}

function show(m: number[][]): void {
  for (const row of m) {
    let line = "";
    for (const v of row) {
      line = `${line}${v} `;
    }
    console.log(line);
  }
}

export function main(): number {
  const a = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  const b = [
    [7, 8],
    [9, 10],
    [11, 12],
  ];
  show(multiply(a, b));
  show(multiply(b, a));
  const big = [
    [65536, 1],
    [1, 65536],
  ];
  show(multiply(big, big));
  const pascal: number[][] = [];
  for (let n = 0; n < 12; n++) {
    const row: number[] = [];
    for (let k = 0; k <= n; k++) {
      row.push(k === 0 || k === n ? 1 : pascal[n - 1][k - 1] + pascal[n - 1][k]);
    }
    pascal.push(row);
  }
  show(pascal);
  console.log(pascal[11][5]);
  console.log(pascal.length);
  console.log(pascal[7].length);
  const jagged: number[][] = [[], [1], [1, 2], []];
  let total = 0;
  for (const row of jagged) {
    total += row.length;
  }
  console.log(total);
  jagged[0].push(9);
  jagged[3].push(8);
  console.log(jagged[0][0] + jagged[3][0]);
  const grid: boolean[][] = [];
  for (let i = 0; i < 3; i++) {
    grid.push(new Array<boolean>(3));
  }
  grid[1][1] = true;
  console.log(grid[1][1]);
  console.log(grid[0][0]);
  return 0;
}
