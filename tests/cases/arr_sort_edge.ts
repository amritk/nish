// `xs.sort(cmp)` at its edges. A sort in a loop allocates only its scratch,
// which it gives back, so `Arena.used()` does not move. An array of arrays
// sorts by a key of each inner array. Where JavaScript leaves the order
// implementation-defined — a NaN element under `a - b`, or a comparator that
// is not a consistent order — only what any order keeps is printed: the
// length, the elements as a multiset, and that the receiver is answered.
// (Run in f64 mode, `.args`, for the NaN.)

const byFirst = (a: number[], b: number[]): number => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0)

export const main = (): void => {
  const xs: number[] = []
  for (let i = 0; i < 1000; i++) {
    xs.push((i * 7919) % 1009)
  }
  const before = Arena.used()
  for (let round = 0; round < 50; round++) {
    if (round % 2 === 0) {
      xs.sort((a, b) => a - b)
    } else {
      xs.sort((a, b) => b - a)
    }
  }
  console.log(`arena unchanged: ${Arena.used() === before} ${xs[0]} ${xs[999]}`)

  const rows: number[][] = [[3, 30], [1, 10], [2, 20], [1, 11], [3, 31], [0, 0]]
  rows.sort(byFirst)
  const parts: string[] = []
  for (const row of rows) {
    parts.push(`${row[0]}:${row[1]}`)
  }
  console.log(parts.join(" "))

  const fs: number[] = [3.5, 0 / 0, 1.5, 2.5, 0 / 0, 0.5]
  const same = fs.sort((a, b) => a - b) === fs
  let finite = 0
  let nans = 0
  for (const f of fs) {
    if (f !== f) {
      nans++
    } else {
      finite += f
    }
  }
  console.log(`nan: ${same} ${fs.length} ${finite} ${nans}`)

  const ws: number[] = []
  for (let i = 0; i < 200; i++) {
    ws.push((i * 31) % 17)
  }
  ws.sort((a, b) => ((a * 3 + b) % 5) - 2)
  let sum = 0
  for (const w of ws) {
    sum += w
  }
  console.log(`inconsistent: ${ws.length} ${sum}`)
}
