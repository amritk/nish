// `xs.sort(cmp)` on an array of interface records, which are stored inline:
// each move copies a whole record. 200 records with 7 distinct keys go through
// insertion runs and merges, and ties must keep their original order as they
// do under Node. Strings sort by length, so words of one length are ties too.

interface Row {
  key: number
  tag: number
  weight: number
}

const byKey = (a: Row, b: Row): number => a.key - b.key

const byLength = (a: string, b: string): number => a.length - b.length

export const main = (): void => {
  const rows: Row[] = []
  for (let i = 0; i < 200; i++) {
    rows.push({ key: (i * 37) % 7, tag: i, weight: i * 3 + 1 })
  }
  const same = rows.sort(byKey) === rows
  let stable = true
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    if (a.key > b.key || (a.key === b.key && a.tag >= b.tag) || b.weight !== b.tag * 3 + 1) {
      stable = false
    }
  }
  console.log(`${same} ${stable} ${rows[0].tag} ${rows[1].tag} ${rows[199].key} ${rows[199].tag}`)
  const words = ["pear", "fig", "apple", "kiwi", "date", "fig", "banana"]
  words.sort(byLength)
  console.log(words.join(" "))
}
