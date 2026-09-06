// Spectral norm (the Benchmarks Game shape) in f64 mode: number[] vectors,
// i32 indices, 10 power iterations over the n x n matrix A(i,j) whose entries
// are computed on the fly. Prints sqrt(vBv / vv), 1.274224153 for n = 1000.
// Compile with --number-mode f64.
function A(i: i32, j: i32): number {
  const ij = i + j;
  return 1 / toF64((ij * (ij + 1)) / 2 + i + 1);
}

function mulAv(n: i32, v: number[], av: number[]): void {
  for (let i: i32 = 0; i < n; i++) {
    let s = 0;
    for (let j: i32 = 0; j < n; j++) {
      s = s + A(i, j) * v[j];
    }
    av[i] = s;
  }
}

function mulAtv(n: i32, v: number[], atv: number[]): void {
  for (let i: i32 = 0; i < n; i++) {
    let s = 0;
    for (let j: i32 = 0; j < n; j++) {
      s = s + A(j, i) * v[j];
    }
    atv[i] = s;
  }
}

function mulAtAv(n: i32, v: number[], out: number[], tmp: number[]): void {
  mulAv(n, v, tmp);
  mulAtv(n, tmp, out);
}

export function main(): i32 {
  const N: i32 = 3000; // bench:n
  const u = new Array<number>(N);
  const v = new Array<number>(N);
  const tmp = new Array<number>(N);
  for (let i: i32 = 0; i < N; i++) {
    u[i] = 1;
  }
  for (let k: i32 = 0; k < 10; k++) {
    mulAtAv(N, u, v, tmp);
    mulAtAv(N, v, u, tmp);
  }
  let vBv = 0;
  let vv = 0;
  for (let i: i32 = 0; i < N; i++) {
    vBv = vBv + u[i] * v[i];
    vv = vv + v[i] * v[i];
  }
  console.log(Math.sqrt(vBv / vv));
  return 0;
}
