// WP50 §5.2: a function-typed parameter that shadows a top-level function is
// a value, not that function, so storage passed to it is refused rather than
// lent on the strength of the top-level function's body.
const S = new Array<i32>(8)

function f(a: Int32Array): void {
  a[0] = 1
}

function apply(f: (a: i32[]) => void): void {
  f(S)
}

export const main = (): void => {
  apply((a: i32[]): void => {
    a.push(1)
  })
}
