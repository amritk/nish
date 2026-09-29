// #275: a `const` whose initializer is refused is still declared, as the error
// type, so the refusal is the one diagnostic. Every later use below — a read,
// an index, a member, a method, a call, an operand, a template hole, a loop,
// a comparison with `null`, and a `let` given values only a context could
// type — used to be ``Unknown identifier `xs` `` or a message about `error`.
class P {
  x: number = 0
}

export const main = (): number => {
  const xs = new Array<integer<1, 9>>(4)
  const a = xs[0]
  const b = xs.length
  xs.push(1)
  const c = xs(1)
  const d = -xs + 2
  const s = `${xs}`
  for (const v of xs) {
    console.log(v)
  }
  const e = xs === null ? 1 : 2
  let y = xs
  y = null
  y = { x: 1 }
  y = []
  y = Ok(1)
  return a + b + c + d + e + s.length
}
