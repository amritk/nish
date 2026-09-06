// Array literals and `new Array<T>(<literal>)` that do not outlive the function
// live on the stack: `%arr.hdr = alloca %struct.sts_array` plus
// `%arr.data = alloca [n x T]`. A `push` moves the data into the arena but
// the header stays valid; a returned array stays in the arena.
function weights(): number {
  const ws = [3, 5, 7];
  let total = 0;
  for (const w of ws) {
    total += w;
  }
  return total * ws.length;
}

function zeroed(): number {
  const zs = new Array<number>(4);
  zs[2] = 9;
  return zs[0] + zs[2];
}

function grown(): number {
  const xs = [1, 2];
  xs.push(3);
  xs.push(4);
  xs.push(5);
  return xs[4] + xs.length;
}

function escaped(): number[] {
  return [10, 20];
}

export function main(): number {
  console.log(weights());
  console.log(zeroed());
  console.log(grown());
  console.log(escaped()[1]);
  return 0;
}
