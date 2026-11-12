// WP27 S4.1: A nullable layout argument is the literal `null` or a narrowed pointer, as for any foreign pointer.
declare class Clock {
  t: i64
}

declare function tick(c: Clock | null): i32

const pick = (some: boolean): Clock | null => (some ? new Clock() : null)

export const main = (): number => {
  return tick(pick(true))
}
