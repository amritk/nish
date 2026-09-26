// WP31 §6: the rest of the entries, each checked with the same compare: an
// object-literal field, an array-literal element, `push`, an element store, an
// assignment to a field, a `return`, and the result of a compound assignment
// and of `++`, which compute in `i32` and enter the range again before they
// are stored. The literals in the array are inside the range and cost nothing.
interface Pixel {
  level: integer<0, 255>
}

class Cursor {
  pos: integer<0, 99> = 0

  advance(by: i32): void {
    this.pos = this.pos + by
    this.pos += 1
  }
}

const clamp = (big: boolean, v: i32): integer<-5, 5> => (big ? v : 0)

export const main = (): number => {
  const n = 3
  const p: Pixel = { level: n * 10 }
  const levels: integer<0, 9>[] = [1, n, 2]
  levels.push(n + 1)
  levels[0] = n + 5
  levels[1] += 1
  let total = 0
  for (const v of levels) {
    total = total + v
  }
  const c = new Cursor()
  c.advance(4)
  let count: integer<0, 9> = 0
  count++
  count += 2
  console.log(`${p.level} ${total} ${c.pos} ${clamp(true, -3)} ${count}`)
  return 0
}
