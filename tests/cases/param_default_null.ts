// `null` is the default of a `T | null` parameter: a call that leaves the
// argument out passes the constant `null`, and the callee has no branch for it.
class Options {
  loud: boolean = true
}

function greet(name: string, opts: Options | null = null): string {
  return opts !== null && opts.loud ? `${name}!` : name
}

function total(xs: i32[] | null = null): i32 {
  let sum = 0
  if (xs !== null) {
    for (const x of xs) {
      sum = sum + x
    }
  }
  return sum
}

function suffix(base: string, end: string | null = null): string {
  return end !== null ? `${base}${end}` : base
}

class Box {
  label: string
  constructor(label: string | null = null) {
    this.label = label !== null ? label : "none"
  }
  tag(opts: Options | null = null): string {
    return greet(this.label, opts)
  }
}

export function main(): void {
  console.log(greet("a"))
  console.log(greet("b", new Options()))
  console.log(greet("c", null))
  console.log(total())
  console.log(total([1, 2, 3]))
  console.log(suffix("x"))
  console.log(suffix("x", "y"))
  console.log(new Box().label)
  console.log(new Box("lid").label)
  const b = new Box("top")
  console.log(b.tag())
  console.log(b.tag(new Options()))
}
