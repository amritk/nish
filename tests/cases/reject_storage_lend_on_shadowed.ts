// WP50 §5.2: a callee lends its parameter on only to a function it names, so
// a parameter `g` shadowing a top-level `g` that only indexes is a value the
// lend cannot follow, and the outer lend is refused.
const S = new Array<i32>(8)

function g(a: Int32Array): void {
  a[0] = 1
}

function f(a: Int32Array, g: (x: i32[]) => void): void {
  g(a)
}

export const main = (): void => {
  f(S, (x: i32[]): void => {
    x.push(1)
  })
}
