// A terminal frame (std/term.ts's `Screen`) under an instruction count: each
// frame clears the screen and writes it full of text in several colours and
// attributes with `text`, then builds the escapes that bring the terminal up to
// date with `flush`. Half of each frame changes from the last (a moving
// column of text and a counter), so `flush` diffs as well as draws, and every
// other run of frames uses 256-colour output. A fix to a panic site the std/
// ratchet counts in those functions shows here as a count that holds or
// falls. It prints the total length of what the flushes returned.
import { ATTR_BOLD, ATTR_INVERSE, ATTR_NONE, COLOR_DEFAULT, Screen } from "nish/term"

/** A common terminal's size. */
const COLUMNS: i32 = 80
const ROWS: i32 = 24

/** Draws frame `k` into `screen`. */
const draw = (screen: Screen, k: i32): void => {
  screen.text(0, 0, `frame ${k}  score ${k * 7}`, 0xffd040, COLOR_DEFAULT, ATTR_BOLD)
  for (let row: i32 = 1; row < ROWS; row++) {
    const fg: i32 = ((row * 40) << 16) | ((row * 9) << 8) | 0x80
    const left: i32 = (k + row) % 20
    screen.text(left, row, "the quick brown fox jumps over", fg, 0x101830, ATTR_NONE)
    screen.text(40, row, "a static column, sent once", COLOR_DEFAULT, COLOR_DEFAULT, ATTR_NONE)
    if (row % 4 === 0) {
      screen.text(70, row, "█░ é", 0x40c0ff, 0x302040, ATTR_INVERSE)
    }
  }
}

export const main = (): i32 => {
  const n: i32 = 600 // bench:n
  const screen = new Screen(COLUMNS, ROWS, false)
  const palette = new Screen(COLUMNS, ROWS, true)
  let total: i64 = 0
  for (let k: i32 = 0; k < n; k++) {
    const s: Screen = (k / 50) % 2 === 0 ? screen : palette
    s.clear(COLOR_DEFAULT)
    draw(s, k)
    total += toI64(s.flush().length)
  }
  console.log(`${total}`)
  return 0
}
