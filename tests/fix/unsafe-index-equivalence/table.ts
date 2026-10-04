// The functions `main.ts` calls, in a module of their own so that the link
// cases are programs of two modules. Both are in the entry package, so the
// flag reaches both and `--fix` rewrites both.
export const histogram = (data: i32[], buckets: i32[]): void => {
  for (const x of data) {
    const b = x % buckets.length
    buckets[b] += 1
  }
}

export const weigh = (buckets: i32[], weights: f64[], names: string[]): string => {
  let best = 0
  let total: f64 = 0.0
  for (let i = 0; i < buckets.length; i++) {
    total = total + weights[buckets[i]]
    if (buckets[i] > buckets[best]) {
      best = i
    }
  }
  return `${names[best]} ${total}`
}
