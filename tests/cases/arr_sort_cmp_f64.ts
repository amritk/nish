// `xs.sort(cmp)` in f64 mode: a comparator answering a fraction, one answering
// NaN (zero, so nothing moves), and 10,000 records with 97 distinct keys,
// whose ties must come out in their original order as they do under Node.

class Item {
  key: number
  tag: number
  constructor(key: number, tag: number) {
    this.key = key
    this.tag = tag
  }
}

const byKey = (a: Item, b: Item): number => a.key - b.key

export const main = (): void => {
  const xs = [0.5, 0.25, 0.75, 0.3, 0.1, 0.9, 0.2]
  xs.sort((a, b) => (a - b) / 4)
  console.log(`${xs[0]} ${xs[1]} ${xs[2]} ${xs[3]} ${xs[4]} ${xs[5]} ${xs[6]}`)
  const ys = [3, 1, 2, 4]
  ys.sort((a, b) => (a - b) * (0 / 0))
  console.log(`${ys[0]} ${ys[1]} ${ys[2]} ${ys[3]}`)
  const items: Item[] = []
  for (let i = 0; i < 10000; i++) {
    items.push(new Item((i * 7919) % 97, i))
  }
  items.sort(byKey)
  let sum = 0
  for (const item of items) {
    sum = (sum * 31 + item.key * 10007 + item.tag) % 1000000007
  }
  console.log(`${items[0].tag} ${items[1].tag} ${items[9999].key} ${items[9999].tag} ${sum}`)
}
