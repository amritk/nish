// The importer declares each exported table's header `external constant`
// and reads it by index, by `.length`, by `for...of` and through a
// `readonly` parameter, exactly as the module that holds it would.
import { HEX, STEPS, hidden } from "./tables"

const total = (xs: readonly i32[]): i32 => {
  let s = 0
  for (const x of xs) {
    s += x
  }
  return s
}

export const main = (): number => {
  const digits: string[] = []
  for (let i = 0; i < 16; i++) {
    const k = (i * 7) & 15
    digits.push(String.fromCharCode(toI32(HEX[k])))
  }
  console.log(digits.join(""))
  console.log(`${HEX.length} ${STEPS.length} ${STEPS[4]} ${total(STEPS)}`)
  console.log(`${hidden(toU8(7))}`)
  return STEPS[3]
}
