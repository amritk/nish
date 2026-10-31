// Labelled jumps out of the loops the emitter lowers on their own paths: a
// `for...of` over an array, a walk of a `Map`, and a labelled `switch` whose
// clauses fall through, each building strings a pass can release.
function labelsOverArrays(): string {
  const grid: i32[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
  let out = ""
  rows: for (const row of grid) {
    for (const v of row) {
      const tag = `v${v}`
      if (v % 3 === 2) continue rows
      if (v === 8) break rows
      out = out + tag
    }
    out = out + "|"
  }
  return out
}

function labelsOverMap(): i32 {
  const m = new Map<string, i32>()
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
  let sum: i32 = 0
  outer: for (let round: i32 = 0; round < 3; round++) {
    for (const k of m.keys()) {
      const v = m.get(k) ?? 0
      if (k === "b" && round === 1) continue outer
      if (k === "c" && round === 2) break outer
      sum = sum + v * (round + 1)
    }
  }
  return sum
}

function fallMix(n: i32): string {
  let s = ""
  for (let i: i32 = 0; i < n; i++) {
    const piece = `p${i}`
    sw: switch (i % 4) {
      case 0:
        s = s + piece
      case 1:
        if (i > 4) break sw
        s = s + "-"
        break
      case 2:
        s = s + "!"
      default:
        s = s + "."
    }
  }
  return s
}

// The outer loop's passes are scoped: `continue outer` and `break outer`
// release the pass they leave, as the end of the body does.
function labelledPasses(): number {
  let n = 0
  outer: for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const t = `x${i}${j}`
      if (j === 2) continue outer
      if (i === 3) break outer
      n = n + t.length
    }
  }
  return n
}

export function main(): void {
  console.log(labelsOverArrays())
  console.log(labelsOverMap())
  console.log(fallMix(9))
  console.log(labelledPasses())
}
