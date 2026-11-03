// A comparator may read the calling function's `const` locals: `sortWith` is
// a function, so its arrow argument is handed what it captures, as any other
// function's is. `k` is a captured scalar, and `rank` a captured array the
// comparator indexes. Each prints the same order under Node.

const show = (xs: i32[]): string => {
  let line = ""
  for (const x of xs) {
    line = line === "" ? `${x}` : `${line},${x}`
  }
  return line
}

export function main(): number {
  const k: i32 = 3
  const near: i32[] = [7, 1, 4, 2, 9, 3]
  // By distance from `k`; a tie keeps the earlier element first.
  near.sort((a, b) => Math.abs(a - k) - Math.abs(b - k))
  console.log(show(near))

  const rank: i32[] = [2, 0, 3, 1]
  const ids: i32[] = [0, 1, 2, 3, 1, 0]
  ids.sort((a, b) => rank[a] - rank[b])
  console.log(show(ids))

  // Both at once, descending: a captured scalar beside a captured array.
  const scale: i32 = -1
  const byRank: i32[] = [3, 2, 1, 0]
  byRank.sort((a, b) => scale * (rank[a] - rank[b]))
  console.log(show(byRank))
  return 0
}
