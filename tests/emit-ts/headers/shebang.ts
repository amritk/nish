#!/usr/bin/env -S nish run
// The import goes below the shebang and this header, so `#!` stays at byte 0.
const three: i32 = 3

export const main = (): number => {
  console.log(`${three + 1}`)
  return 0
}
