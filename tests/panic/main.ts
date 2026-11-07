// WP50 stage 3: how a wasm-host module panics, refuses re-entry and keeps its
// arena flat. Each export takes one way out: an index past the end, an
// overflow, a `panic`, an exit, an allocation `--memory 1` cannot hold, a
// host import that calls back into the module, a host import that throws.
import { boom, reenter } from "./host"

export const count = new Array<u32>(1)
export const cells = new Array<i32>(4)

/** Bump the counter; answers its new value. */
export const bump = (): u32 => {
  count[0] += 1
  return count[0]
}

/** Cell `i`: an index past 4 panics. */
export const cell = (i: i32): i32 => cells[i]

/** `a + b`, which panics on overflow. */
export const sum = (a: i32, b: i32): i32 => a + b

/** Panic with the page's own words. */
export const fail = (): void => {
  panic("the page asked")
}

/** Exit with `code`. */
export const leave = (code: i32): void => {
  process.exit(code)
}

/** Build an array of `n` cells in the arena; answers its last cell. */
export const fill = (n: i32): i32 => {
  const xs = new Array<i32>(n)
  for (let i = 0; i < n; i++) {
    xs[i] = i
  }
  return xs[n - 1]
}

/** Count a hundred, then ask the page, which calls back into the module. */
export const nested = (): u32 => {
  count[0] += 100
  return reenter()
}

/** Ask the page, which throws. */
export const thrown = (): void => {
  boom()
}
