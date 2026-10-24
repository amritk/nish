// NL8012: a generic no instance reaches is not typed by the checker, and an
// `i64` in its body is a `bigint` under Node, so `--emit-ts` writes it with a
// body that throws and says so.
const wide = <T>(xs: T[]): i64 => {
  return toI64(xs.length) + 1
}

export const main = (): number => 0
