// A default is a constant the call passes for an argument it leaves out, or
// an earlier parameter's value; the callee has no branch for it.
enum Mode {
  Plain,
  Loud,
}

function scale(x: number, by: number = 2): number {
  return x * by
}

function area(w: number, h: number = w): number {
  return w * h
}

function label(name: string, mode: Mode = Mode.Plain, end: string = "."): string {
  return mode === Mode.Loud ? `${name}!${end}` : `${name}${end}`
}

function within(x: number, lo: number = -1, hi: number = 1, open: boolean = false): boolean {
  return open ? x > lo && x < hi : x >= lo && x <= hi
}

function mix(a: f64, t: f64 = 0.5, big: i64 = 5000000000): f64 {
  return a * t + (big > 0 ? 1.0 : 0.0)
}

export function main(): void {
  console.log(scale(3))
  console.log(scale(3, 5))
  console.log(area(4))
  console.log(area(4, 2))
  console.log(label("a"))
  console.log(label("b", Mode.Loud))
  console.log(label("c", Mode.Loud, "?"))
  console.log(within(1))
  console.log(within(1, 0, 1, true))
  console.log(within(-2, -3))
  console.log(mix(4.0))
  console.log(mix(4.0, 0.25))
}
