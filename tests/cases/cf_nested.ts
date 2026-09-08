function countPairs(n: number): number {
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if ((i + j) % 3 === 0) {
        count++;
      }
    }
  }
  return count;
}

function search(limit: number): number {
  let found = 0;
  let i = 0;
  while (i < limit) {
    i++;
    if (i % 2 === 0) continue;
    let j = 0;
    while (true) {
      j++;
      if (j * j > i) break;
    }
    found += j;
  }
  return found;
}

export function test(): number {
  return countPairs(6) * 100 + search(5);
}
