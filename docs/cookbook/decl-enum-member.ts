enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

class Loop {
  readonly kind: Kind.While = Kind.While
  depth: i32 = 0
}

const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.If:
      return 10
    case Kind.While:
      return 20
    default:
      return 30
  }
}

export const main = (): number => {
  const loop = new Loop()
  const k: Kind.While = loop.kind
  console.log(`weight = ${weight(k)}`)
  return 0
}
