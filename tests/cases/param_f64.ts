// Default and rest parameters under `--number-mode f64`, where `number` is a
// double: a fractional default, an earlier-parameter default, and a rest of
// doubles, held to unmodified Node by tests/differential/unmodified.js.

function mix(a: number, t: number = 0.25, b: number = a): number {
  return a + (b - a) * t
}

function mean(...xs: number[]): number {
  if (xs.length === 0) {
    return 0
  }
  let sum = 0
  for (const x of xs) {
    sum = sum + x
  }
  return sum / xs.length
}

class Gauge {
  level: number
  constructor(level: number = 1.5) {
    this.level = level
  }
  raise(by: number = 0.5): number {
    this.level = this.level + by
    return this.level
  }
}

export function main(): void {
  console.log(mix(2))
  console.log(mix(2, 0.5, 6))
  console.log(mix(2, 0.75))
  console.log(mean())
  console.log(mean(1, 2))
  console.log(mean(0.1, 0.2, 0.3))
  const g = new Gauge()
  console.log(g.raise())
  console.log(g.raise(2.25))
}
